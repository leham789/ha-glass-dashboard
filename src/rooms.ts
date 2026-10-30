import type { HassEntity, HomeAssistant } from './ha.js';
import { groupMembers, isLightOn } from './light-colour.js';

/**
 * Everything a room tile shows, worked out from HA's areas: which lights are
 * in the room, how many are on, and one line of context.
 */
export interface RoomLight {
  id: string;
  name: string;
  on: boolean;
}

export interface RoomSummary {
  areaId: string;
  name: string;
  lights: RoomLight[];
  onCount: number;
  /** One line under the name: an open door, the climate, a door, media or motion. */
  meta: string;
  /** Something needs attention (a door or window is open). */
  alert: boolean;
  /** The room's temperature in °, when it has a sensor. */
  temperature?: number;
  /** The room's humidity in %, when it has a sensor. */
  humidity?: number;
  /** Every entity this summary read, so a card only re-renders when one changes. */
  watch: string[];
}

const OPENING_CLASSES = new Set(['door', 'window', 'garage_door', 'opening']);
const MOTION_CLASSES = new Set(['motion', 'occupancy', 'presence']);

/** The area an entity belongs to: its own, or else its device's. */
export function areaOf(hass: HomeAssistant, entityId: string): string | undefined {
  const entry = hass.entities?.[entityId];
  if (!entry) return undefined;
  return entry.area_id ?? (entry.device_id ? hass.devices?.[entry.device_id]?.area_id ?? undefined : undefined);
}

/** Visible, user-facing entities in an area (hidden and config/diagnostic ones are left out). */
export function areaEntityIds(hass: HomeAssistant, areaId: string): string[] {
  return Object.keys(hass.states).filter((id) => {
    const entry = hass.entities?.[id];
    return entry && !entry.hidden && !entry.entity_category && areaOf(hass, id) === areaId;
  });
}

export function roomSummary(hass: HomeAssistant, areaId: string, exclude: string[] = []): RoomSummary {
  const area = hass.areas?.[areaId];
  const name = area?.name ?? areaId;
  const ids = areaEntityIds(hass, areaId).filter((id) => !exclude.includes(id));
  const lights = roomLights(hass, ids, name);
  const members = lights.flatMap((l) => groupMembers(hass.states[l.id]) ?? []);
  const chosen = [area?.temperature_entity_id, area?.humidity_entity_id].filter((id): id is string => !!id);
  const temperature = numberState(hass.states[area?.temperature_entity_id ?? pickSensor(hass, ids, 'temperature') ?? '']);
  const humidity = numberState(hass.states[area?.humidity_entity_id ?? pickSensor(hass, ids, 'humidity') ?? '']);
  return {
    areaId,
    name,
    lights,
    onCount: lights.filter((l) => l.on).length,
    ...roomMeta(hass, ids, name, climateText(temperature, humidity)),
    temperature,
    humidity,
    watch: [...ids, ...members, ...chosen],
  };
}

export interface LightGroup {
  name: string;
  lights: RoomLight[];
}

/**
 * Every light in the home, grouped by area in HA's area order (lights with no
 * area last, as "Other"), each counted once as in roomSummary.
 */
export function lightsByArea(hass: HomeAssistant, excludeAreas: string[] = []): LightGroup[] {
  const groups: LightGroup[] = Object.values(hass.areas ?? {})
    .filter((a) => !excludeAreas.includes(a.area_id))
    .map((a) => ({ name: a.name, lights: roomSummary(hass, a.area_id).lights }))
    .filter((g) => g.lights.length);

  const placed = new Set(groups.flatMap((g) => g.lights.map((l) => l.id)));
  const loose = Object.keys(hass.states).filter((id) => {
    if (!id.startsWith('light.') || placed.has(id) || hass.entities?.[id]?.hidden) return false;
    const area = areaOf(hass, id);
    return !area || !excludeAreas.includes(area);
  });
  // Leave out groups whose lights are already listed.
  const others = loose.filter(
    (id) => !(groupMembers(hass.states[id]) ?? []).some((m) => placed.has(m) || loose.includes(m)),
  );
  if (others.length) {
    groups.push({
      name: 'Other',
      lights: others.map((id) => ({ id, name: shortName(hass.states[id], ''), on: isLightOn(hass.states[id], hass.states) })),
    });
  }
  return groups;
}

/**
 * Lights in the room, counted once each: a group (such as a Hue room) is left
 * out when its own lights are already in the room, so "4 of 6" counts bulbs.
 */
function roomLights(hass: HomeAssistant, ids: string[], areaName: string): RoomLight[] {
  const lightIds = ids.filter((id) => id.startsWith('light.'));
  const inRoom = new Set(lightIds);
  return lightIds
    .filter((id) => !(groupMembers(hass.states[id]) ?? []).some((m) => inRoom.has(m)))
    .map((id) => ({
      id,
      name: shortName(hass.states[id], areaName),
      on: isLightOn(hass.states[id], hass.states),
    }));
}

function roomMeta(
  hass: HomeAssistant,
  ids: string[],
  areaName: string,
  climate: string,
): { meta: string; alert: boolean } {
  const of = (cls: Set<string>) =>
    ids.filter((id) => id.startsWith('binary_sensor.') && cls.has(hass.states[id].attributes.device_class));

  const openings = of(OPENING_CLASSES);
  const open = openings.find((id) => hass.states[id].state === 'on');
  if (open) return { meta: `${sentence(shortName(hass.states[open], ''))} open`, alert: true };

  if (climate) return { meta: climate, alert: false };

  if (openings.length) return { meta: `${sentence(shortName(hass.states[openings[0]], ''))} shut`, alert: false };

  const media = ids.find((id) => id.startsWith('media_player.') && hass.states[id].state !== 'unavailable');
  if (media) return { meta: `${shortName(hass.states[media], areaName)} ${hass.states[media].state}`, alert: false };

  const motion = of(MOTION_CLASSES)[0];
  if (motion) return { meta: hass.states[motion].state === 'on' ? 'Motion' : 'No motion', alert: false };

  return { meta: '', alert: false };
}

/** "18.0° · 82%" from a room's temperature and humidity. */
function climateText(t?: number, h?: number): string {
  const parts = [];
  if (t !== undefined) parts.push(`${t.toFixed(1)}°`);
  if (h !== undefined) parts.push(`${Math.round(h)}%`);
  return parts.join(' · ');
}

/**
 * When an area has no sensor chosen in HA, prefer a dedicated room sensor over
 * one that belongs to a bigger device (a 3D printer's nozzle, a server's disks):
 * the sensor whose device has the fewest entities wins.
 */
function pickSensor(hass: HomeAssistant, ids: string[], deviceClass: string): string | undefined {
  const candidates = ids.filter(
    (id) =>
      id.startsWith('sensor.') &&
      hass.states[id].attributes.device_class === deviceClass &&
      numberState(hass.states[id]) !== undefined,
  );
  const sizes = deviceSizes(hass);
  const deviceSize = (id: string) => sizes.get(hass.entities[id]?.device_id ?? '') ?? Infinity;
  return candidates.sort((a, b) => deviceSize(a) - deviceSize(b))[0];
}

// Entities per device, worked out once per entity registry (it rarely changes).
const deviceSizeCache = new WeakMap<object, Map<string, number>>();
function deviceSizes(hass: HomeAssistant): Map<string, number> {
  let sizes = deviceSizeCache.get(hass.entities);
  if (!sizes) {
    sizes = new Map();
    for (const e of Object.values(hass.entities ?? {})) {
      if (e.device_id) sizes.set(e.device_id, (sizes.get(e.device_id) ?? 0) + 1);
    }
    deviceSizeCache.set(hass.entities, sizes);
  }
  return sizes;
}

function numberState(entity?: HassEntity): number | undefined {
  const n = Number(entity?.state);
  return entity && entity.state !== '' && Number.isFinite(n) ? n : undefined;
}

/**
 * Drops the room's name from the front or back of an entity's name:
 * "Living Room TV Strip" → "TV Strip", "Sonos Kitchen" → "Sonos".
 * Also drops a trailing "Contact"/"Sensor": "Back Door Contact" → "Back Door".
 */
export function shortName(entity: HassEntity | undefined, areaName: string): string {
  const full: string = entity?.attributes.friendly_name ?? entity?.entity_id ?? '';
  let name = full;
  if (areaName) {
    const room = areaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    name = name.replace(new RegExp(`^${room}\\s+|\\s+${room}$`, 'i'), '');
  }
  name = name.replace(/\s+(contact|sensor)$/i, '').trim();
  return name || full;
}

/** "Back Door" → "Back door". */
function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

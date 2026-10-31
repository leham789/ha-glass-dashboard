import type { HassEntity, HomeAssistant } from './ha.js';
import { isUnavailable } from './ha.js';
import { ago } from './time.js';

/**
 * Sensors that go quiet. A Zigbee sensor that drops off often isn't marked
 * unavailable: Home Assistant keeps its last value, so a room says 18.0° for
 * hours after the sensor died. A reading counts as not reporting once HA
 * hasn't heard from it for longer than it should, by kind.
 */
export const DEFAULT_QUIET_HOURS: Record<string, number> = {
  // climate sensors report every few minutes, so two quiet hours means something's wrong
  temperature: 2,
  humidity: 2,
  atmospheric_pressure: 2,
  // many Zigbee contacts only check in every few hours while nothing opens, so they get longer
  door: 12,
  window: 12,
  garage_door: 12,
  opening: 12,
  // batteries report rarely
  battery: 24,
};

/**
 * Hours a sensor can be quiet before it counts, by sensor type ("door") or
 * for one sensor ("binary_sensor.back_door"). Raised from any card's
 * quiet_hours option, for the whole dashboard, when a sensor is fine but
 * just reports less often than the default expects.
 */
let overrides: Record<string, number> = {};

/** From a card's config: quiet_hours: { door: 24, binary_sensor.back_door: 48 }. */
export function setQuietHours(hours?: Record<string, number>): void {
  if (hours && typeof hours === 'object') overrides = { ...overrides, ...hours };
}

/**
 * The dashboard's current hass, so heardAt can look at a sensor's device. Set by
 * every card as it draws.
 */
let current: HomeAssistant | undefined;
export function useHass(hass: HomeAssistant): void {
  current = hass;
}

// Each device's "Last seen" sensor, worked out once per entity registry.
const lastSeenCache = new WeakMap<object, Map<string, string>>();
function lastSeenSensors(hass: HomeAssistant): Map<string, string> {
  let map = lastSeenCache.get(hass.entities);
  if (!map) {
    map = new Map();
    for (const e of Object.values(hass.entities ?? {})) {
      if (e.device_id && /^sensor\..*_last_seen$/.test(e.entity_id)) map.set(e.device_id, e.entity_id);
    }
    lastSeenCache.set(hass.entities, map);
  }
  return map;
}

/**
 * When the sensor was last heard from. Zigbee2MQTT's "Last seen" sensor on the
 * same device is the truth (the radio's own time) and wins when it's there and
 * enabled. Otherwise HA's own times, which reset when HA restarts, so a sensor
 * that died a month ago can look like it was heard at the last restart.
 */
export function heardAt(e: HassEntity): string {
  const hass = current;
  const device = hass?.entities?.[e.entity_id]?.device_id;
  const seenId = device ? lastSeenSensors(hass!).get(device) : undefined;
  const seen = seenId ? hass!.states[seenId]?.state : undefined;
  if (seen && !Number.isNaN(Date.parse(seen))) return seen;
  return e.last_reported || e.last_updated || e.last_changed;
}

/** The kinds of sensor this applies to: how long each can be quiet before it counts. */
export function quietLimit(e?: HassEntity): number | undefined {
  if (!e || !(e.entity_id.startsWith('sensor.') || e.entity_id.startsWith('binary_sensor.'))) return undefined;
  const dc = e.attributes.device_class as string;
  if (DEFAULT_QUIET_HOURS[dc] === undefined && overrides[e.entity_id] === undefined) return undefined;
  return overrides[e.entity_id] ?? overrides[dc] ?? DEFAULT_QUIET_HOURS[dc];
}

/** True when a sensor still has a value but HA hasn't heard from it for longer than its limit. */
export function isQuiet(e?: HassEntity, now = Date.now()): boolean {
  const hours = quietLimit(e);
  if (!e || hours === undefined || isUnavailable(e)) return false;
  return now - Date.parse(heardAt(e)) > hours * 3_600_000;
}

/** "Last heard 3 h ago", "Last heard 3 weeks ago", "Last heard 1 month ago" */
export function lastHeard(e: HassEntity): string {
  const at = heardAt(e);
  const days = (Date.now() - Date.parse(at)) / 86_400_000;
  if (days < 7) return `Last heard ${ago(at)}`;
  if (days < 30) return `Last heard ${Math.floor(days / 7) === 1 ? '1 week' : `${Math.floor(days / 7)} weeks`} ago`;
  const months = Math.floor(days / 30);
  return `Last heard ${months === 1 ? '1 month' : `${months} months`} ago`;
}

/**
 * Every device the cards read that's gone quiet, longest-quiet first: one entry per device (a climate
 * sensor's temperature and humidity together), plus how many devices are watched in all.
 */
export function quietSensors(hass: HomeAssistant): { quiet: HassEntity[][]; watched: number } {
  const deviceOf = (e: HassEntity) => hass.entities?.[e.entity_id]?.device_id ?? e.entity_id;
  const watched = Object.values(hass.states).filter((e) => quietLimit(e) !== undefined && !hass.entities?.[e.entity_id]?.hidden);
  const byDevice = new Map<string, HassEntity[]>();
  for (const e of watched.filter((x) => isQuiet(x))) byDevice.set(deviceOf(e), [...(byDevice.get(deviceOf(e)) ?? []), e]);
  const quiet = [...byDevice.values()].sort((a, b) => Date.parse(heardAt(a[0])) - Date.parse(heardAt(b[0])));
  return { quiet, watched: new Set(watched.map(deviceOf)).size };
}

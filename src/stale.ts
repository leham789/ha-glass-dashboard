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

/** When HA last heard from the sensor: every check-in, even when the value didn't change. */
export function heardAt(e: HassEntity): string {
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

/** "Last heard 3 h ago" */
export function lastHeard(e: HassEntity): string {
  return `Last heard ${ago(heardAt(e))}`;
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

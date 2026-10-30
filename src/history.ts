import type { HomeAssistant } from './ha.js';

/** HA's compact history format: state and last-updated time in epoch seconds. */
interface Point {
  s: string;
  lu: number;
}

export interface DailyUsage {
  /** Use in each hour of today, 00:00 first (hours still to come are 0). */
  hours: number[];
  today: number;
  /** Use yesterday up to this time of day, for a fair comparison. */
  yesterdaySoFar: number;
}

/**
 * Today's use, hour by hour, from an energy sensor that counts up (kWh today,
 * resetting at midnight, or a meter total that never resets).
 */
export async function dailyUsage(hass: HomeAssistant, entityId: string, now = new Date()): Promise<DailyUsage> {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(midnight.getTime() - 86_400_000);
  const result = await hass.callWS<Record<string, Point[]>>({
    type: 'history/history_during_period',
    start_time: yesterday.toISOString(),
    end_time: now.toISOString(),
    entity_ids: [entityId],
    minimal_response: true,
    no_attributes: true,
    significant_changes_only: false,
  });
  const points = (result[entityId] ?? [])
    .map((p) => ({ t: p.lu * 1000, v: Number(p.s) }))
    .filter((p) => Number.isFinite(p.v));

  const hours = Array.from({ length: 24 }, (_, h) => {
    const from = midnight.getTime() + h * 3_600_000;
    return from > now.getTime() ? 0 : usageBetween(points, from, Math.min(from + 3_600_000, now.getTime()));
  });
  return {
    hours,
    today: usageBetween(points, midnight.getTime(), now.getTime()),
    yesterdaySoFar: usageBetween(points, yesterday.getTime(), now.getTime() - 86_400_000),
  };
}

/**
 * How much a counting-up sensor rose between two times. A drop means the
 * counter reset (as "today" sensors do at midnight), so the new value counts.
 */
function usageBetween(points: { t: number; v: number }[], from: number, to: number): number {
  let total = 0;
  let last = [...points].reverse().find((p) => p.t <= from)?.v;
  for (const p of points) {
    if (p.t <= from || p.t > to) continue;
    if (last !== undefined) total += p.v >= last ? p.v - last : p.v;
    last = p.v;
  }
  return total;
}

/**
 * Hourly time-weighted averages of a numeric sensor over the last `hours`
 * hours, oldest first (the current, unfinished hour last). Hours with no
 * reading are 0.
 */
export async function hourlyAverages(hass: HomeAssistant, entityId: string, hours: number): Promise<number[]> {
  const end = Date.now();
  const start = new Date(end);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() - (hours - 1));

  const result = await hass.callWS<Record<string, Point[]>>({
    type: 'history/history_during_period',
    start_time: start.toISOString(),
    end_time: new Date(end).toISOString(),
    entity_ids: [entityId],
    minimal_response: true,
    no_attributes: true,
    significant_changes_only: false,
  });

  const points = (result[entityId] ?? [])
    .map((p) => ({ t: p.lu * 1000, v: Number(p.s) }))
    .filter((p) => Number.isFinite(p.v));

  const buckets: number[] = [];
  for (let h = 0; h < hours; h++) {
    const from = start.getTime() + h * 3_600_000;
    const to = Math.min(from + 3_600_000, end);
    let weighted = 0;
    let covered = 0;
    points.forEach((p, i) => {
      // Each reading holds until the next one.
      const a = Math.max(p.t, from);
      const b = Math.min(points[i + 1]?.t ?? end, to);
      if (b > a) {
        weighted += p.v * (b - a);
        covered += b - a;
      }
    });
    buckets.push(covered ? weighted / covered : 0);
  }
  return buckets;
}

/** One recorded state: its time (ms) and the state as HA reports it. */
export interface StatePoint {
  t: number;
  s: string;
}

/** Every recorded state of an entity since `start`, oldest first. */
export async function stateHistory(hass: HomeAssistant, entityId: string, start: Date): Promise<StatePoint[]> {
  const result = await hass.callWS<Record<string, Point[]>>({
    type: 'history/history_during_period',
    start_time: start.toISOString(),
    end_time: new Date().toISOString(),
    entity_ids: [entityId],
    minimal_response: true,
    no_attributes: true,
    significant_changes_only: false,
  });
  return (result[entityId] ?? []).map((p) => ({ t: p.lu * 1000, s: p.s }));
}

/**
 * The stretches of time an entity spent in each state, as fractions (0–1) of
 * the window from `start` to now. The state at `start` is the first point's.
 */
export function spans(points: StatePoint[], start: Date): { from: number; to: number; s: string }[] {
  const t0 = start.getTime();
  const span = Date.now() - t0;
  return points.map((p, i) => ({
    from: Math.max(0, (p.t - t0) / span),
    to: Math.min(1, ((points[i + 1]?.t ?? Date.now()) - t0) / span),
    s: p.s,
  }));
}

/** Use on each of the last `days` days (today last), from a counting-up energy sensor. */
export async function usageByDay(hass: HomeAssistant, entityId: string, days: number, now = new Date()): Promise<number[]> {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(midnight.getTime() - (days - 1) * 86_400_000 - 3_600_000);
  const points = (await stateHistory(hass, entityId, start))
    .map((p) => ({ t: p.t, v: Number(p.s) }))
    .filter((p) => Number.isFinite(p.v));
  return Array.from({ length: days }, (_, i) => {
    const from = midnight.getTime() - (days - 1 - i) * 86_400_000;
    return usageBetween(points, from, Math.min(from + 86_400_000, now.getTime()));
  });
}

/** Every recorded state of an entity since `start`, with its attributes (for thermostats and the like). */
export async function attributeHistory(
  hass: HomeAssistant,
  entityId: string,
  start: Date,
): Promise<{ t: number; s: string; a: Record<string, any> }[]> {
  const result = await hass.callWS<Record<string, { s: string; a?: Record<string, any>; lu: number }[]>>({
    type: 'history/history_during_period',
    start_time: start.toISOString(),
    end_time: new Date().toISOString(),
    entity_ids: [entityId],
    minimal_response: false,
    no_attributes: false,
    significant_changes_only: false,
  });
  let last: Record<string, any> = {};
  // HA only repeats attributes when they change, so carry the last ones forward.
  return (result[entityId] ?? []).map((p) => ({ t: p.lu * 1000, s: p.s, a: (last = p.a ?? last) }));
}

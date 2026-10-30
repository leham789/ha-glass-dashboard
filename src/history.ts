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

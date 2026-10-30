import type { HassEntity } from './ha.js';

export interface Collection {
  date: Date;
  bins: string[];
}

const DAY = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Midnight today, local time. */
export function today(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export const daysUntil = (date: Date, now = new Date()) => Math.round((date.getTime() - today(now).getTime()) / DAY);

/**
 * Upcoming collections from bin sensors, earliest first. Understands the usual
 * Waste Collection Schedule set-ups:
 * - one sensor per bin whose state is a date or a number of days ("2", "in 2 days")
 * - a sensor with `daysTo` (and optionally `types`) attributes
 * - a sensor whose attributes are dates mapping to bin names ("upcoming" details)
 */
export function collections(entities: HassEntity[], now = new Date()): Collection[] {
  const byDay = new Map<number, Set<string>>();
  const add = (date: Date, bins: string[]) => {
    if (daysUntil(date, now) < 0) return;
    const key = date.getTime();
    const set = byDay.get(key) ?? new Set();
    bins.forEach((b) => set.add(b));
    byDay.set(key, set);
  };

  for (const e of entities) {
    if (!e || e.state === 'unavailable' || e.state === 'unknown') continue;
    const a = e.attributes;
    const name = binName(a.friendly_name ?? e.entity_id);

    const dated = Object.entries(a).filter(([k, v]) => ISO_DATE.test(k) && typeof v === 'string');
    if (dated.length) {
      for (const [k, v] of dated) add(parseDay(k), splitTypes(v as string));
      continue;
    }
    if (typeof a.daysTo === 'number') {
      add(addDays(today(now), a.daysTo), Array.isArray(a.types) ? a.types.map(binName) : [name]);
      continue;
    }
    const day = ISO_DATE.test(e.state.slice(0, 10)) ? parseDay(e.state.slice(0, 10)) : undefined;
    if (day) {
      add(day, [name]);
      continue;
    }
    const n = /today/i.test(e.state) ? 0 : /tomorrow/i.test(e.state) ? 1 : Number(e.state.match(/\d+/)?.[0]);
    if (Number.isFinite(n)) add(addDays(today(now), n), [name]);
  }

  return [...byDay.entries()].sort(([a], [b]) => a - b).map(([t, bins]) => ({ date: new Date(t), bins: [...bins] }));
}

/** Dot colour from the bin's name: green, red, grey/black, blue, brown, yellow. */
export function binColour(name: string): string {
  const n = name.toLowerCase();
  if (/green|garden|food|organic/.test(n)) return '#4FA65B';
  if (/red/.test(n)) return '#D9473A';
  if (/blue|recycl|paper/.test(n)) return '#3B7DD8';
  if (/brown/.test(n)) return '#8A5A3B';
  if (/yellow|plastic/.test(n)) return '#E5B22D';
  return '#8A8D94';
}

/** "Green Bin Collection" → "Green". */
function binName(text: string): string {
  const name = String(text).replace(/\b(bins?|collection|waste)\b/gi, '').replace(/\s+/g, ' ').trim();
  return name || String(text);
}

function splitTypes(text: string): string[] {
  return text.split(/\s*(?:,|&|\band\b)\s*/i).filter(Boolean).map(binName);
}

function parseDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

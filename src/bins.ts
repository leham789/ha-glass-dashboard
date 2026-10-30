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
 * - an `upcoming` attribute listing { date, type } for each collection
 * - attributes that are dates mapping to bin names ("upcoming" details format)
 * - a `daysTo` attribute, with the bins named in the state ("Red Bin, Blue Bin in 3 days")
 * - one sensor per bin whose state is a date or a number of days ("2", "in 2 days")
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

    const upcoming = Array.isArray(a.upcoming)
      ? a.upcoming.filter((u: unknown) => u && typeof u === 'object' && ISO_DATE.test(String((u as any).date)))
      : [];
    if (upcoming.length) {
      for (const u of upcoming) add(parseDay(u.date), [binName(u.type ?? name)]);
      continue;
    }
    const dated = Object.entries(a).filter(([k, v]) => ISO_DATE.test(k) && typeof v === 'string');
    if (dated.length) {
      for (const [k, v] of dated) add(parseDay(k), splitTypes(v as string));
      continue;
    }
    // "Red Bin, Blue Bin in 3 days": the bins are named before when.
    const when = e.state.match(/^(.*?)\s*(?:\bin\s+(\d+)\s+days?|\b(today)|\b(tomorrow))\s*$/i);
    if (typeof a.daysTo === 'number') {
      add(addDays(today(now), a.daysTo), when?.[1] ? splitTypes(when[1]) : [name]);
      continue;
    }
    const day = ISO_DATE.test(e.state.slice(0, 10)) ? parseDay(e.state.slice(0, 10)) : undefined;
    if (day) {
      add(day, [name]);
      continue;
    }
    const n = when ? (when[3] ? 0 : when[4] ? 1 : Number(when[2])) : /^\d+$/.test(e.state.trim()) ? Number(e.state) : NaN;
    if (Number.isFinite(n)) add(addDays(today(now), n), when?.[1] ? splitTypes(when[1]) : [name]);
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

const COLOURS = /\b(green|red|grey|gray|black|blue|brown|yellow|purple)\b/i;

/**
 * A bin's short name: its colour when it has one ("140L Food & Garden (Green
 * Lid)" → "Green", "Red Bin" → "Red"), otherwise without "bin"/"collection".
 */
function binName(text: string): string {
  const colour = String(text).match(COLOURS)?.[1];
  if (colour) return colour.charAt(0).toUpperCase() + colour.slice(1).toLowerCase();
  const name = String(text).replace(/\b(bins?|collection|waste)\b/gi, '').replace(/\s+/g, ' ').trim();
  return name || String(text);
}

/** Bin names separated by commas (not "&", which appears inside names like "Food & Garden"). */
function splitTypes(text: string): string[] {
  return text.split(/\s*,\s*/).filter(Boolean).map(binName);
}

function parseDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

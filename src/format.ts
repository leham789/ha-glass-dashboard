import type { HassEntity } from './ha.js';

const CURRENCY: Record<string, string> = { GBP: '£', EUR: '€', USD: '$' };

/**
 * A sensor's value as people say it: "£3.59", "20.4p per kWh", "15.3 kWh",
 * "408 W", "612". Returns the value and any words that belong after it.
 */
export function formatValue(e: HassEntity): { value: string; after: string } {
  const n = Number(e.state);
  const unit = String(e.attributes.unit_of_measurement ?? '').trim();
  if (!Number.isFinite(n)) return { value: e.state, after: '' };
  const [money, per] = unit.split('/').map((s) => s.trim());
  const symbol = CURRENCY[money?.toUpperCase()];
  if (symbol && per) {
    return n < 1 && symbol === '£' ? { value: `${(n * 100).toFixed(1)}p`, after: `per ${per}` } : { value: `${symbol}${n.toFixed(2)}`, after: `per ${per}` };
  }
  if (symbol) return { value: `${symbol}${n.toFixed(2)}`, after: '' };
  const decimals = Math.abs(n) >= 100 || Number.isInteger(n) ? 0 : 1;
  return { value: unit ? `${n.toFixed(decimals)} ${unit}` : n.toFixed(decimals), after: '' };
}

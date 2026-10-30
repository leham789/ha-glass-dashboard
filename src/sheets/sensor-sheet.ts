import { html, nothing, type PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { GlassEntitySheet, type Fact, type Tone } from './entity-sheet.js';
import type { ChartBand } from '../elements/glass-history-chart.js';
import '../elements/glass-history-chart.js';
import { type HassEntity, isUnavailable } from '../ha.js';
import { type StatePoint, dailyUsage, spans, stateHistory, usageByDay } from '../history.js';
import type { IconName } from '../icons.js';
import { LOW_BATTERY } from '../batteries.js';
import { batteryIcon } from '../climate.js';
import { formatValue } from '../format.js';
import { ago, clock, duration } from '../time.js';

type Range = '24 h' | '7 days';
type Shape = 'line' | 'bars' | 'timeline' | 'none';

const OPENINGS = new Set(['door', 'window', 'opening', 'garage_door']);
const MOTION = new Set(['motion', 'occupancy', 'presence']);

interface Chart {
  shape: Shape;
  values: number[];
  bands: ChartBand[];
  fadedFrom: number;
  min: number;
  max: number;
  hi: string;
  lo: string;
  x: [string, string];
  facts: Fact[];
}

/**
 * The sheet for anything that is just a reading: temperature, humidity, energy,
 * batteries, bins, doors and windows. Replaces HA's more-info for sensor and
 * binary_sensor. The chart follows the sensor: a line for measurements, bars
 * for energy that counts up, a timeline for on/off sensors.
 */
@customElement('glass-sensor-sheet')
export class GlassSensorSheet extends GlassEntitySheet {
  @state() private range: Range = '24 h';
  @state() private chart?: Chart;
  private loadedFor = '';

  protected iconFor(e: HassEntity): IconName {
    const dc = e.attributes.device_class;
    if (e.entity_id.startsWith('binary_sensor.')) {
      if (OPENINGS.has(dc)) return e.state === 'on' ? 'door-open' : 'door-closed';
      if (MOTION.has(dc)) return 'person-standing';
      return 'power';
    }
    if (dc === 'temperature') return 'thermometer';
    if (dc === 'humidity') return 'droplet';
    if (dc === 'energy' || dc === 'power') return 'zap';
    if (dc === 'gas') return 'flame';
    if (dc === 'monetary') return 'pound-sterling';
    if (dc === 'battery') return batteryIcon(Number(e.state) || 0);
    if (dc === 'timestamp' || dc === 'date') return 'calendar';
    return 'gauge';
  }

  protected iconBgFor(e: HassEntity): string {
    const dc = e.attributes.device_class;
    if (dc === 'energy' || dc === 'power') return 'var(--glass-accent)';
    if (dc === 'battery') return '#CDB8F5';
    if (dc === 'humidity') return '#9CC3F2';
    return '#F7C2A4';
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    const key = `${this.entityId}|${this.range}`;
    if (this.hass && this.entity && key !== this.loadedFor) {
      this.loadedFor = key;
      this.load().catch(() => (this.chart = undefined));
    }
  }

  private shape(e: HassEntity): Shape {
    if (e.entity_id.startsWith('binary_sensor.')) return 'timeline';
    const a = e.attributes;
    if (!Number.isFinite(Number(e.state)) && !isUnavailable(e)) return 'none';
    if (a.state_class === 'total_increasing' || (a.device_class === 'energy' && a.state_class !== 'measurement')) return 'bars';
    return 'line';
  }

  private async load() {
    const e = this.entity!;
    const shape = this.shape(e);
    const week = this.range === '7 days';
    const start = new Date(Date.now() - (week ? 7 : 1) * 86_400_000);
    const x: [string, string] = week ? [weekday(start), weekday(new Date(Date.now() - 3.5 * 86_400_000))] : [hhmm(start), hhmm(new Date(Date.now() - 12 * 3_600_000))];
    const unit = String(e.attributes.unit_of_measurement ?? '');
    const base: Chart = { shape, values: [], bands: [], fadedFrom: Infinity, min: 0, max: 1, hi: '', lo: '', x, facts: [] };
    if (shape === 'none') {
      this.chart = base;
    } else if (shape === 'bars') {
      if (week) {
        const days = await usageByDay(this.hass!, e.entity_id, 7);
        const max = Math.max(...days, 0.1);
        const busiest = days.indexOf(Math.max(...days));
        const total = days.reduce((a, b) => a + b, 0);
        this.chart = {
          ...base, values: days, max, hi: `${round(max)} ${unit}`,
          facts: [
            { label: 'Daily average', value: round(total / 7) },
            { label: 'Busiest day', value: weekday(new Date(Date.now() - (6 - busiest) * 86_400_000)) },
            { label: 'This week', value: `${round(total)}` },
          ],
        };
      } else {
        const u = await dailyUsage(this.hass!, e.entity_id);
        const nowHour = new Date().getHours();
        const max = Math.max(...u.hours, 0.1);
        this.chart = {
          ...base, values: u.hours, fadedFrom: nowHour + 1, max, hi: `${round(max)} ${unit}`, x: ['00:00', '12:00'],
          facts: [
            { label: 'By now yesterday', value: round(u.yesterdaySoFar) },
            { label: 'Busiest hour', value: `${String(u.hours.indexOf(max)).padStart(2, '0')}:00` },
            { label: 'Today', value: round(u.today) },
          ],
        };
      }
    } else {
      const points = await stateHistory(this.hass!, e.entity_id, start);
      if (shape === 'timeline') {
        const on = spans(points, start).filter((sp) => sp.s === 'on');
        const opens = points.filter((p, i) => p.s === 'on' && points[i - 1]?.s !== 'on' && p.t >= start.getTime());
        const span = Date.now() - start.getTime();
        const longest = Math.max(0, ...on.map((sp) => (sp.to - sp.from) * span));
        const verb = OPENINGS.has(e.attributes.device_class) ? 'Opened' : 'On';
        this.chart = {
          ...base,
          bands: on.map((sp) => ({ from: sp.from, to: sp.to, colour: '#E0683A', opacity: 0.75 })),
          facts: [
            { label: verb, value: `${opens.length} ${opens.length === 1 ? 'time' : 'times'}` },
            { label: 'Longest', value: longest ? duration(new Date(Date.now() - longest).toISOString()) : '—' },
            week ? { label: 'Per day', value: `${Math.round(opens.length / 7)}` } : { label: 'First', value: opens[0] ? clock(new Date(opens[0].t).toISOString()) : '—' },
          ],
        };
      } else {
        const values = resample(points, start, week ? 84 : 48);
        const nums = points.map((p) => Number(p.s)).filter(Number.isFinite);
        const lo = nums.length ? Math.min(...nums) : 0;
        const hi = nums.length ? Math.max(...nums) : 1;
        const battery = e.attributes.device_class === 'battery';
        const pad = Math.max(0.5, (hi - lo) * 0.2);
        const min = battery ? 0 : Math.floor(lo - pad);
        const max = battery ? 100 : Math.ceil(hi + pad);
        const u = unit === '°C' || unit === '°F' ? '°' : unit === '%' ? '%' : ` ${unit}`;
        const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
        this.chart = {
          ...base, values, min, max, hi: `${max}${u}`, lo: `${min}${u}`,
          facts: battery
            ? [
                { label: week ? '7 days ago' : '24 h ago', value: nums.length ? `${Math.round(nums[0])}%` : '—' },
                { label: week ? 'Per week' : 'Per day', value: nums.length ? `${signed(Math.round(nums[nums.length - 1] - nums[0]))}%` : '—' },
                { label: 'Lowest', value: `${Math.round(lo)}%` },
              ]
            : [
                { label: 'Lowest', value: `${round(lo)}${u}` },
                { label: 'Highest', value: `${round(hi)}${u}` },
                { label: 'Average', value: `${round(avg)}${u}` },
              ],
        };
      }
    }
  }

  protected renderBody() {
    const e = this.entity;
    if (!e) return html``;
    const off = this.unavailable;
    const binary = e.entity_id.startsWith('binary_sensor.');
    const dc = e.attributes.device_class;
    let value: string | undefined;
    let unit = '';
    let caption: string;
    let pill: { text: string; tone: Tone } | undefined;

    if (off) {
      caption = binary ? this.sinceLine('Not reporting') : this.sinceLine();
      pill = { text: binary ? 'Unknown' : 'Unavailable', tone: 'neutral' };
    } else if (binary) {
      const on = e.state === 'on';
      value = OPENINGS.has(dc) ? (on ? 'Open' : 'Shut') : MOTION.has(dc) ? (on ? 'Motion' : 'Clear') : on ? 'On' : 'Off';
      caption = on ? `${value} for ${duration(e.last_changed)} · since ${clock(e.last_changed)}` : `Since ${clock(e.last_changed)}`;
    } else {
      const n = Number(e.state);
      if (Number.isFinite(n)) {
        const raw = String(e.attributes.unit_of_measurement ?? '');
        const f = formatValue(e);
        if (f.value.startsWith('£') || f.value.startsWith('€') || f.value.startsWith('$') || f.value.endsWith('p')) {
          value = f.value;
          unit = f.after;
        } else {
          value = Math.abs(n) >= 100 || Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1);
          unit = raw;
        }
        if (dc === 'battery' && n < LOW_BATTERY) pill = { text: 'Low', tone: 'attention' };
      } else {
        value = dateWords(e.state) ?? e.state;
      }
      caption = `Updated ${ago(e.last_updated || e.last_changed)}`;
    }

    const c = this.chart;
    return html`
      ${this.renderReading(value, unit, caption, pill)}
      ${c && c.shape !== 'none'
        ? html`<div class="card">
              <div class="card-head">
                <h2>History</h2>
                <span class="segmented" role="group" aria-label="Range">
                  ${(['24 h', '7 days'] as Range[]).map(
                    (r) => html`<button type="button" class=${r === this.range ? 'on' : ''} aria-pressed=${r === this.range ? 'true' : 'false'} @click=${() => (this.range = r)}>${r}</button>`,
                  )}
                </span>
              </div>
              <glass-history-chart
                .kind=${c.shape as 'line' | 'bars' | 'timeline'}
                .values=${c.values}
                .bands=${c.bands}
                .fadedFrom=${c.fadedFrom}
                .min=${c.min}
                .max=${c.max}
                .hiLabel=${c.hi}
                .loLabel=${c.lo}
                .xLabels=${c.x}
                .label=${`${this.sheetTitle} history`}
              ></glass-history-chart>
            </div>
            ${this.renderFacts(c.facts)}`
        : nothing}
    `;
  }
}

/** The value at the end of each of `n` equal steps from `start` to now. */
function resample(points: StatePoint[], start: Date, n: number): number[] {
  const nums = points.map((p) => ({ t: p.t, v: Number(p.s) })).filter((p) => Number.isFinite(p.v));
  const t0 = start.getTime();
  const step = (Date.now() - t0) / n;
  let i = 0;
  let last = nums[0]?.v ?? 0;
  return Array.from({ length: n + 1 }, (_, k) => {
    const t = t0 + k * step;
    while (i < nums.length && nums[i].t <= t) last = nums[i++].v;
    return last;
  });
}

const round = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(1));
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const hhmm = (d: Date) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const weekday = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short' });

/** "2026-11-04" → "Tomorrow" / "Tue 4 Nov", for date sensors such as bins. */
function dateWords(state: string): string | undefined {
  const t = Date.parse(state);
  if (!/^\d{4}-\d{2}-\d{2}/.test(state) || !Number.isFinite(t)) return undefined;
  const d = new Date(t);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-sensor-sheet': GlassSensorSheet;
  }
}

import { css, html, type CSSResultGroup, type PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { GlassEntitySheet, type Tone } from './entity-sheet.js';
import type { ChartBand } from '../elements/glass-history-chart.js';
import '../elements/glass-history-chart.js';
import { spans, stateHistory } from '../history.js';
import { clock, duration } from '../time.js';

const HOME = '#2FB457';
const ZONE = '#3B7DD8';
const AWAY = '#8A8D94';

/**
 * Replaces HA's person pop-up (from the avatar on Home): where someone is
 * (home, a zone's name, or away), since when, today's timeline and their
 * phone's battery. No map: the zone name says enough on a phone.
 */
@customElement('glass-person-sheet')
export class GlassPersonSheet extends GlassEntitySheet {
  @state() private bands: ChartBand[] = [];
  @state() private today: { left?: number; back?: number; homeMs: number } = { homeMs: 0 };
  private loadedFor = '';

  protected get sheetSubtitle(): string {
    const tracker = this.trackerName();
    return tracker ? `${tracker} · Home Assistant app` : '';
  }

  protected renderIcon() {
    const e = this.entity;
    const picture: string | undefined = e?.attributes.entity_picture;
    const tone = this.where().tone;
    return html`<span class="avatar" style=${picture ? `background-image: url("${picture}")` : ''}>
      ${picture ? '' : (e?.attributes.friendly_name ?? '?').charAt(0)}
      <span class="presence" style="background: ${tone === 'success' ? HOME : tone === 'info' ? ZONE : AWAY}"></span>
    </span>`;
  }

  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const e = this.entity;
    if (e) this.sheetTitle = String(e.attributes.friendly_name ?? '').split(' ')[0] || this.sheetTitle;
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.hass && this.entity && this.loadedFor !== this.entityId) {
      this.loadedFor = this.entityId;
      this.load().catch(() => undefined);
    }
  }

  private async load() {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const points = await stateHistory(this.hass!, this.entityId, midnight);
    const s = spans(points, midnight);
    this.bands = s.map((sp) => ({
      from: sp.from,
      to: sp.to,
      colour: sp.s === 'home' ? HOME : sp.s === 'not_home' || sp.s === 'unknown' ? AWAY : ZONE,
      opacity: sp.s === 'home' ? 0.6 : sp.s === 'not_home' ? 0.35 : 0.55,
    }));
    const left = points.find((p, i) => i > 0 && p.s !== 'home' && points[i - 1].s === 'home');
    const back = [...points].reverse().find((p, i, arr) => p.s === 'home' && arr[i + 1] && arr[i + 1].s !== 'home');
    const span = Date.now() - midnight.getTime();
    const homeMs = s.filter((sp) => sp.s === 'home').reduce((n, sp) => n + (sp.to - sp.from) * span, 0);
    this.today = { left: left?.t, back: back?.t, homeMs };
  }

  /** The phone that tracks this person, e.g. "iPhone". */
  private trackerName(): string {
    const id: string | undefined = this.entity?.attributes.source;
    return id ? String(this.hass?.states[id]?.attributes.friendly_name ?? '').replace(/^.*?'s\s+/i, '') : '';
  }

  /** The tracking phone's battery, from the companion app's battery sensor on the same device. */
  private phoneBattery(): string {
    const source: string | undefined = this.entity?.attributes.source;
    const device = source ? this.hass?.entities?.[source]?.device_id : undefined;
    if (!device) return '—';
    const id = Object.keys(this.hass!.states).find(
      (s) => this.hass!.entities?.[s]?.device_id === device && this.hass!.states[s].attributes.device_class === 'battery' && s.startsWith('sensor.'),
    );
    return id ? `${Math.round(Number(this.hass!.states[id].state))}%` : '—';
  }

  private where(): { word?: string; tone: Tone } {
    const st = this.entity?.state;
    if (!st || st === 'unknown' || st === 'unavailable') return { tone: 'neutral' };
    if (st === 'home') return { word: 'Home', tone: 'success' };
    if (st === 'not_home') return { word: 'Away', tone: 'neutral' };
    return { word: st, tone: 'info' };
  }

  protected renderBody() {
    const e = this.entity;
    if (!e) return html``;
    const { word } = this.where();
    const t = this.today;
    const caption = word ? `Since ${clock(e.last_changed)}` : `Phone not reporting since ${clock(e.last_changed)}`;
    const at = (ms?: number) => (ms ? clock(new Date(ms).toISOString()) : '—');
    return html`
      ${this.renderReading(word, '', caption, word ? undefined : { text: 'Unknown', tone: 'neutral' })}
      <div class="card">
        <div class="card-head">
          <h2>Today</h2>
          <span class="note">Home ${duration(new Date(Date.now() - t.homeMs).toISOString())}</span>
        </div>
        <glass-history-chart kind="timeline" .bands=${this.bands} .xLabels=${['00:00', '12:00'] as [string, string]} label="Where ${this.sheetTitle} was today"></glass-history-chart>
        <div class="legend">
          <span><i style="background: rgba(47, 180, 87, 0.6)"></i>Home</span>
          <span><i style="background: rgba(59, 125, 216, 0.55)"></i>A zone</span>
          <span><i style="background: rgba(138, 141, 148, 0.35)"></i>Away</span>
        </div>
      </div>
      ${this.renderFacts([
        { label: 'Left', value: at(t.left) },
        { label: 'Back', value: at(t.back) },
        { label: 'Phone', value: this.phoneBattery() },
      ])}
    `;
  }

  static styles: CSSResultGroup = [
    GlassEntitySheet.styles,
    css`
      .avatar {
        position: relative;
        flex: none;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: var(--glass-ink) center / cover;
        color: var(--glass-on-ink);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      }
      .presence {
        position: absolute;
        right: 0;
        bottom: 0;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid var(--glass-sheet);
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-person-sheet': GlassPersonSheet;
  }
}

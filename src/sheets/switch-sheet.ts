import { css, html, nothing, type CSSResultGroup, type PropertyValues } from 'lit';
import '../elements/glass-button.js';
import { nil } from '../elements/nil.js';
import { customElement, state } from 'lit/decorators.js';
import { GlassEntitySheet, type Fact } from './entity-sheet.js';
import type { ChartBand, ChartKey } from '../elements/glass-history-chart.js';
import '../elements/glass-history-chart.js';
import { type HassEntity, isUnavailable } from '../ha.js';
import { dailyUsage, spans, stateHistory } from '../history.js';
import type { IconName } from '../icons.js';
import { clock, duration, hoursMinutes, todayLabels } from '../time.js';
import { haptic } from '../motion.js';

/**
 * Replaces HA's pop-up for switches and smart plugs (switch, input_boolean):
 * On / Off with the switch, what a plug is using now and today (from its own
 * power and energy sensors, when it has them) and today's on/off timeline.
 */
@customElement('glass-switch-sheet')
export class GlassSwitchSheet extends GlassEntitySheet {
  @state() private bands: ChartBand[] = [];
  @state() private facts: Fact[] = [];
  private loadedFor = '';

  protected iconFor(): IconName {
    return 'plug';
  }

  protected iconBgFor(e: HassEntity): string {
    return e.state === 'on' ? 'var(--glass-accent)' : 'var(--glass-neutral-tint)';
  }

  /** The plug's own sensor with this device_class (power or energy), if it has one. */
  private sibling(deviceClass: string): HassEntity | undefined {
    const device = this.hass?.entities?.[this.entityId]?.device_id;
    if (!device) return undefined;
    const id = Object.keys(this.hass!.states).find(
      (s) => s.startsWith('sensor.') && this.hass!.entities?.[s]?.device_id === device && this.hass!.states[s].attributes.device_class === deviceClass,
    );
    return id ? this.hass!.states[id] : undefined;
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    const e = this.entity;
    // Reload when the switch changes, so the timeline includes it.
    const key = `${this.entityId}|${e?.last_changed}`;
    if (this.hass && e && key !== this.loadedFor) {
      this.loadedFor = key;
      this.load().catch(() => undefined);
    }
  }

  private async load() {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const points = await stateHistory(this.hass!, this.entityId, midnight);
    const on = spans(points, midnight).filter((sp) => sp.s === 'on');
    this.bands = on.map((sp) => ({ from: sp.from, to: sp.to, colour: 'var(--glass-go)', opacity: 0.6 }));
    const span = Date.now() - midnight.getTime();
    const times = points.filter((p, i) => p.s === 'on' && points[i - 1]?.s !== 'on' && p.t >= midnight.getTime()).length;
    const longest = Math.max(0, ...on.map((sp) => (sp.to - sp.from) * span));
    const power = this.sibling('power');
    if (power) {
      const watts = (await stateHistory(this.hass!, power.entity_id, midnight)).map((p) => Number(p.s)).filter(Number.isFinite);
      this.facts = [
        { label: 'Switched on', value: `${times} ${times === 1 ? 'time' : 'times'}` },
        { label: 'Peak', value: watts.length ? `${Math.round(Math.max(...watts))} W` : nil },
        { label: 'Lowest', value: watts.length ? `${round(Math.min(...watts))} W` : nil },
      ];
    } else {
      const lastOff = [...points].reverse().find((p) => p.s === 'off');
      this.facts = [
        { label: 'Switched on', value: `${times} ${times === 1 ? 'time' : 'times'}` },
        { label: 'Longest', value: longest ? duration(new Date(Date.now() - longest).toISOString()) : nil },
        { label: 'Last off', value: lastOff ? clock(new Date(lastOff.t).toISOString()) : nil },
      ];
    }
    this.onToday = on.reduce((n, sp) => n + (sp.to - sp.from) * span, 0);
    const energy = this.sibling('energy');
    this.usedToday = energy ? (await dailyUsage(this.hass!, energy.entity_id)).today : undefined;
    this.loaded = true;
  }

  @state() private onToday = 0;
  @state() private usedToday?: number;
  @state() private loaded = false;

  protected renderBody() {
    const e = this.entity;
    if (!e) return html``;
    const off = this.unavailable;
    const on = e.state === 'on';
    const power = this.sibling('power');
    const energy = this.sibling('energy');
    return html`
      <div class="reading">
        <span class="left">
          <glass-number size="display" .value=${off ? '' : on ? 'On' : 'Off'} ?grey=${!on}></glass-number>
          <span class="caption">${off ? this.sinceLine() : `Since ${clock(e.last_changed)}`}</span>
        </span>
        <span class="right">
          ${off ? this.renderPill('Unavailable', 'neutral') : nothing}
          <glass-switch ?checked=${on} label="Power"
            ?disabled=${off} @change=${() => (haptic('light'), this.hass!.callService('homeassistant', on ? 'turn_off' : 'turn_on', { entity_id: e.entity_id }))}></glass-switch>
        </span>
      </div>
      ${power || energy
        ? html`<div class="pair">
            <span class="tile"><span class="label">Using now</span><glass-number size="small" .value=${power && !isUnavailable(power) ? `${round(Number(power.state))}` : ''} unit="W"></glass-number></span>
            <span class="tile"><span class="label">Used today</span><glass-number
                size="small"
                .value=${energy && this.usedToday !== undefined ? this.usedToday.toFixed(2) : ''}
                unit=${energy?.attributes.unit_of_measurement ?? 'kWh'}
                .loading=${energy && this.usedToday === undefined && !this.loaded ? 64 : undefined}
              ></glass-number></span>
          </div>`
        : nothing}
      <div class="card">
        <div class="card-head">
          <h2>Today</h2>
          <span class="note">On ${hoursMinutes(this.onToday)}</span>
        </div>
        <glass-history-chart
          kind="timeline"
          ?loading=${!this.loaded}
          .bands=${this.bands}
          .xLabels=${todayLabels()}
          .key=${[
            { label: 'On', look: 'box', colour: 'var(--glass-go)', opacity: 0.6 },
            { label: 'Off', look: 'box', colour: 'rgba(var(--glass-line-rgb), 0.06)' },
          ] as ChartKey[]}
          label="When ${this.sheetTitle} was on today"
        ></glass-history-chart>
      </div>
      ${this.facts.length ? this.renderFacts(this.facts) : this.loaded ? nothing : this.renderFacts(['Switched on', this.sibling('power') ? 'Peak' : 'Longest', this.sibling('power') ? 'Lowest' : 'Last off'].map((label) => ({ label, value: html`<span class="skel" style="width: 48px; height: 0.8em; margin: 0.1em 0;"></span>` })))}
    `;
  }

  static styles: CSSResultGroup = [
    GlassEntitySheet.styles,
    css`
      .right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 12px;
        padding-bottom: 8px;
      }
      .right .pill {
        margin: 0;
      }
      .pair {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
    `,
  ];
}

const round = (n: number) => (!Number.isFinite(n) ? '—' : Math.abs(n) >= 10 ? n.toFixed(0) : n.toFixed(1));

declare global {
  interface HTMLElementTagNameMap {
    'glass-switch-sheet': GlassSwitchSheet;
  }
}

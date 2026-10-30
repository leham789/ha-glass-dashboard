import { css, html, nothing, type CSSResultGroup, type PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { GlassEntitySheet, type Fact } from './entity-sheet.js';
import type { ChartBand } from '../elements/glass-history-chart.js';
import '../elements/glass-history-chart.js';
import type { HassEntity } from '../ha.js';
import { dailyUsage, spans, stateHistory } from '../history.js';
import type { IconName } from '../icons.js';
import { clock, duration } from '../time.js';

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
    this.bands = on.map((sp) => ({ from: sp.from, to: sp.to, colour: '#2FB457', opacity: 0.6 }));
    const span = Date.now() - midnight.getTime();
    const times = points.filter((p, i) => p.s === 'on' && points[i - 1]?.s !== 'on' && p.t >= midnight.getTime()).length;
    const longest = Math.max(0, ...on.map((sp) => (sp.to - sp.from) * span));
    const power = this.sibling('power');
    if (power) {
      const watts = (await stateHistory(this.hass!, power.entity_id, midnight)).map((p) => Number(p.s)).filter(Number.isFinite);
      this.facts = [
        { label: 'Switched on', value: `${times} ${times === 1 ? 'time' : 'times'}` },
        { label: 'Peak', value: watts.length ? `${Math.round(Math.max(...watts))} W` : '—' },
        { label: 'Lowest', value: watts.length ? `${round(Math.min(...watts))} W` : '—' },
      ];
    } else {
      const lastOff = [...points].reverse().find((p) => p.s === 'off');
      this.facts = [
        { label: 'Switched on', value: `${times} ${times === 1 ? 'time' : 'times'}` },
        { label: 'Longest', value: longest ? duration(new Date(Date.now() - longest).toISOString()) : '—' },
        { label: 'Last off', value: lastOff ? clock(new Date(lastOff.t).toISOString()) : '—' },
      ];
    }
    this.onToday = on.reduce((n, sp) => n + (sp.to - sp.from) * span, 0);
    const energy = this.sibling('energy');
    this.usedToday = energy ? (await dailyUsage(this.hass!, energy.entity_id)).today : undefined;
  }

  @state() private onToday = 0;
  @state() private usedToday?: number;

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
          <span class="value ${off || !on ? 'none' : ''}"><span class="big">${off ? html`<i class="nil"></i>` : on ? 'On' : 'Off'}</span></span>
          <span class="caption">${off ? this.sinceLine() : `Since ${clock(e.last_changed)}`}</span>
        </span>
        <span class="right">
          ${off ? this.renderPill('Unavailable', 'neutral') : nothing}
          <button
            type="button"
            role="switch"
            class="switch ${on ? 'on' : ''}"
            aria-checked=${on ? 'true' : 'false'}
            aria-label="Power"
            ?disabled=${off}
            @click=${() => this.hass!.callService('homeassistant', on ? 'turn_off' : 'turn_on', { entity_id: e.entity_id })}
          ></button>
        </span>
      </div>
      ${power || energy
        ? html`<div class="pair">
            <span class="tile"><span class="label">Using now</span><span class="fv">${power ? `${round(Number(power.state))} W` : '—'}</span></span>
            <span class="tile"><span class="label">Used today</span><span class="fv">${energy && this.usedToday !== undefined ? `${this.usedToday.toFixed(2)} ${energy.attributes.unit_of_measurement ?? 'kWh'}` : '—'}</span></span>
          </div>`
        : nothing}
      <div class="card">
        <div class="card-head">
          <h2>Today</h2>
          <span class="note">On ${duration(new Date(Date.now() - this.onToday).toISOString())}</span>
        </div>
        <glass-history-chart kind="timeline" .bands=${this.bands} .xLabels=${['00:00', '12:00'] as [string, string]} label="When ${this.sheetTitle} was on today"></glass-history-chart>
        <div class="legend">
          <span><i style="background: rgba(47, 180, 87, 0.6)"></i>On</span>
          <span><i style="background: rgba(var(--glass-line-rgb), 0.06)"></i>Off</span>
        </div>
      </div>
      ${this.facts.length ? this.renderFacts(this.facts) : nothing}
    `;
  }

  static styles: CSSResultGroup = [
    GlassEntitySheet.styles,
    css`
      .right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 10px;
        padding-bottom: 6px;
      }
      .right .pill {
        margin: 0;
      }
      .pair {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
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

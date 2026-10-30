import { css, html, nothing, type CSSResultGroup, type PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { GlassEntitySheet } from './entity-sheet.js';
import '../elements/glass-history-chart.js';
import '../cards/thermostat-dial/thermostat-dial.js';
import type { GlassThermostatDial } from '../cards/thermostat-dial/thermostat-dial.js';
import type { IconName } from '../icons.js';
import { attributeHistory } from '../history.js';

interface Day {
  temps: number[];
  targets: number[];
  runs: { from: number; to: number }[];
  ranMs: number;
}

const POINTS = 48;

/**
 * Replaces HA's thermostat pop-up: the same dial card as on Heating & Energy
 * (with the thermostat's presets, when it has any), then the last 24 hours of
 * room temperature, target and when the heating ran.
 */
@customElement('glass-heating-sheet')
export class GlassHeatingSheet extends GlassEntitySheet {
  @state() private day?: Day;
  private loadedFor = '';
  private dial?: GlassThermostatDial;

  protected iconFor(): IconName {
    return 'thermometer';
  }

  protected iconBgFor(): string {
    return '#F7C2A4';
  }

  /** "Heat · comfort" above the dial, in place of the thermostat's name (the title has it). */
  private modeLine(): string {
    const e = this.entity;
    if (!e || this.unavailable) return this.sinceLine();
    if (e.state === 'off') return 'Heating is off';
    const mode = e.state === 'heat' ? 'Heat' : e.state.charAt(0).toUpperCase() + e.state.slice(1);
    const preset = e.attributes.preset_mode;
    return preset && preset !== 'none' ? `${mode} · ${String(preset).toLowerCase()}` : mode;
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.dial && this.hass) {
      this.dial.setConfig({ type: 'custom:glass-thermostat-dial', entity: this.entityId, name: this.modeLine(), show_presets: true });
      this.dial.hass = this.hass;
    }
    if (this.hass && this.entity && this.loadedFor !== this.entityId) {
      this.loadedFor = this.entityId;
      this.load().catch(() => undefined);
    }
  }

  private async load() {
    const start = new Date(Date.now() - 86_400_000);
    const points = await attributeHistory(this.hass!, this.entityId, start);
    const span = Date.now() - start.getTime();
    const temps: number[] = [];
    const targets: number[] = [];
    let i = 0;
    let cur = points[0];
    for (let k = 0; k <= POINTS; k++) {
      const t = start.getTime() + (k / POINTS) * span;
      while (i < points.length && points[i].t <= t) cur = points[i++];
      temps.push(Number(cur?.a.current_temperature) || 0);
      targets.push(cur?.s === 'off' ? 0 : Number(cur?.a.temperature) || 0);
    }
    const runs: { from: number; to: number }[] = [];
    points.forEach((p, k) => {
      if (p.a.hvac_action !== 'heating') return;
      const to = points[k + 1]?.t ?? Date.now();
      runs.push({ from: Math.max(0, (p.t - start.getTime()) / span), to: (to - start.getTime()) / span });
    });
    this.day = { temps, targets, runs, ranMs: runs.reduce((n, r) => n + (r.to - r.from) * span, 0) };
  }

  protected renderBody() {
    const e = this.entity;
    if (!e) return html``;
    if (!this.dial) {
      this.dial = document.createElement('glass-thermostat-dial');
      this.dial.setConfig({ type: 'custom:glass-thermostat-dial', entity: e.entity_id, name: this.modeLine(), show_presets: true });
      this.dial.hass = this.hass;
    }
    const d = this.day;
    const known = d ? [...d.temps, ...d.targets].filter((v) => v > 0) : [];
    const lo = known.length ? Math.floor(Math.min(...known) - 1) : 15;
    const hi = known.length ? Math.ceil(Math.max(...known) + 1) : 21;
    const h = d ? Math.floor(d.ranMs / 3_600_000) : 0;
    const m = d ? Math.round((d.ranMs % 3_600_000) / 600_000) * 10 : 0;
    const now = new Date();
    return html`
      ${this.dial}
      ${d
        ? html`<div class="card">
            <div class="card-head">
              <h2>Last 24 hours</h2>
              <span class="note">Heating ran ${h} h${m ? ` ${m} m` : ''}</span>
            </div>
            <glass-history-chart
              kind="line"
              .values=${d.temps.map((v) => v || lo)}
              .target=${d.targets.map((v) => v || lo)}
              .runs=${d.runs}
              .min=${lo}
              .max=${hi}
              .hiLabel=${`${hi}°`}
              .loLabel=${`${lo}°`}
              .xLabels=${[hhmm(new Date(now.getTime() - 86_400_000)), hhmm(new Date(now.getTime() - 43_200_000))] as [string, string]}
              label="Room temperature and target over the last 24 hours"
            ></glass-history-chart>
            <div class="legend">
              <span><i class="room"></i>Room</span>
              <span><i class="target"></i>Target</span>
              <span><i style="background: rgba(224, 104, 58, 0.12)"></i>Heating on</span>
            </div>
          </div>`
        : nothing}
    `;
  }

  static styles: CSSResultGroup = [
    GlassEntitySheet.styles,
    css`
      .legend i.room {
        width: 14px;
        height: 2px;
        border-radius: 1px;
        background: var(--glass-ink);
      }
      .legend i.target {
        width: 14px;
        height: 0;
        border-radius: 0;
        border-top: 2px dashed #e0683a;
      }
    `,
  ];
}

const hhmm = (d: Date) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

declare global {
  interface HTMLElementTagNameMap {
    'glass-heating-sheet': GlassHeatingSheet;
  }
}

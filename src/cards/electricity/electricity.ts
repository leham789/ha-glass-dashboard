import { GlassSheet } from '../../elements/glass-sheet.js';
import '../../sheets/energy-sheet.js';
import type { GlassEnergySheet } from '../../sheets/energy-sheet.js';
import '../../elements/glass-meters.js';
import '../../elements/glass-number.js';
import { css, html, nothing, type PropertyValues } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, isUnavailable, registerCard } from '../../ha.js';
import { type DailyUsage, dailyUsage } from '../../history.js';
import { comparison, formatValue } from '../../format.js';
import '../../elements/glass-icon.js';
import './electricity-editor.js';

export interface ElectricityConfig extends LovelaceCardConfig {
  /** Energy that counts up: kWh today, or the meter's total. */
  energy: string;
  /** Today's cost, e.g. from your supplier's integration (optional). */
  cost?: string;
  title?: string;
  /** Electricity (green) or gas (the heating colours, with a flame). */
  fuel?: 'electricity' | 'gas';
}

const DOTS = 10;
const REFRESH_MS = 10 * 60 * 1000;

/**
 * Today's electricity or gas: what it's cost, how much you've used and how that
 * compares with yesterday by this time, and an hour-by-hour dot chart that
 * fills up to now and stays faint after.
 */
@customElement('glass-electricity')
export class GlassElectricity extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: ElectricityConfig;
  @state() private usage?: DailyUsage;
  private sheet?: GlassEnergySheet;
  @state() private loading = true;
  private timer?: number;

  static getConfigElement() {
    return document.createElement('glass-electricity-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<ElectricityConfig> {
    return { energy: Object.keys(hass.states).find((id) => hass.states[id].attributes.device_class === 'energy') ?? '' };
  }

  setConfig(config: ElectricityConfig): void {

    this.needs = undefined;
    if (!config.energy) return this.setUp(config, 'Choose an energy sensor');
    const changed = config.energy !== this.config?.energy;
    this.config = config;
    if (changed && this.hass) this.load();
  }

  getCardSize(): number {
    return 5;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    ensureFonts();
    this.timer = window.setInterval(() => this.load(), REFRESH_MS);
  }

  disconnectedCallback(): void {
    window.clearInterval(this.timer);
    super.disconnectedCallback();
  }

  protected firstUpdated(): void {
    if (this.needs) return;
    this.load();
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (this.needs) return true;
    // Keep an open Energy pop-up current.
    if (this.sheet?.isConnected && this.hass) this.sheet.hass = this.hass;
    if (!changed.has('hass') || changed.size > 1 || !this.config) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    const ids = [this.config.energy, this.config.cost].filter(Boolean) as string[];
    return !old || ids.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  private async load() {
    if (!this.hass || !this.config?.energy) return;
    try {
      this.usage = await dailyUsage(this.hass, this.config.energy);
    } catch {
      this.usage = undefined;
    }
    this.loading = false;
  }

  render() {
    if (this.needs) return this.renderSetup('zap');
    if (!this.config || !this.hass) return nothing;
    if (!this.hass.states[this.config.energy]) return this.renderMissing(this.config.energy);
    const cost = this.config.cost ? this.hass.states[this.config.cost] : undefined;
    const u = this.usage;
    // While today's history loads: soft bars where the number and line go (Shared states). No history at all: the grey dash.
    const wait = this.loading && !u;
    const big = cost && !isUnavailable(cost) ? formatValue(cost).value : u ? `${u.today.toFixed(1)} kWh` : '';
    const compare = u && u.yesterdaySoFar > 0 ? comparison(u.today, u.yesterdaySoFar) : '';
    const line = [cost && u ? `${u.today.toFixed(1)} kWh` : '', compare].filter(Boolean).join(' · ');
    const nowHour = new Date().getHours();
    const gas = this.config.fuel === 'gas';
    const fuel = gas ? 'Gas' : 'Electricity';

    return html`<section aria-labelledby="h" class=${gas ? 'gas' : ''}>
      <button type="button" class="open" aria-label="${fuel} details" @click=${this.openEnergy}></button>
      <span class="top">
        <span class="head">
          <h2 id="h">${this.config.title ?? `${fuel} today`}</h2>
          <glass-number size="dial-s" .value=${big} .loading=${wait && !big ? 132 : undefined}></glass-number>
          ${line ? html`<span class="line">${line}</span>` : wait ? html`<span class="skel" style="width: 160px; height: 12px; margin: 4px 0;"></span>` : nothing}
        </span>
        <span class="icon" aria-hidden="true"><glass-icon name=${gas ? 'flame' : 'zap'} size="18" stroke="1.7"></glass-icon></span>
      </span>
      <glass-dot-chart
        class="chart"
        role="img"
        aria-label="${fuel} use each hour today"
        .values=${Array.from({ length: 24 }, (_, h) => u?.hours[h] ?? 0)}
        levels=${DOTS}
        dot="6"
        .now=${nowHour}
        ?loading=${!u}
      ></glass-dot-chart>
      <span class="axis"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></span>
    </section>`;
  }

  /** Our Energy pop-up, with today's use already loaded. */
  private openEnergy = () => {
    const c = this.config!;
    if (this.sheet?.isConnected) return;
    const sheet = (this.sheet = GlassSheet.open<GlassEnergySheet>('glass-energy-sheet', this.hass!, this));
    sheet.energy = c.energy;
    sheet.cost = c.cost ?? '';
    sheet.fuel = c.fuel ?? 'electricity';
    sheet.usage = this.usage;
  };

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      .top,
      .chart,
      .axis {
        pointer-events: none;
      }
      /* the whole card is the button; what's drawn on it lets taps through */
      .open {
        all: unset;
        position: absolute;
        inset: 0;
        border-radius: inherit;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .open:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      section {
        --glass-skel: var(--glass-chart-dot-empty); /* loading bars on the coloured card */
        position: relative;
        box-sizing: border-box;
        padding: var(--glass-space-edge);
        border-radius: var(--glass-radius-card);
        background: var(--glass-energy);
        box-shadow: var(--glass-tile-shadow);
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      section.gas {
        background: var(--glass-gas);
        box-shadow: var(--glass-tile-shadow);
      }
      .gas .axis {
        color: var(--glass-gas-ink);
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      .head {
        display: flex;
        flex-direction: column;
        color: #fff;
      }
      h2 {
        margin: 0;
        font-size: var(--glass-text-body);
        font-weight: 400;
      }
      .line {
        font-size: var(--glass-text-caption);
      }
      .icon {
        width: 44px;
        height: 44px;
        flex: none;
        border-radius: 50%;
        background: var(--glass-chart-dot);
        color: var(--glass-on-chart-dot);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .chart {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        height: 104px;
      }
      .axis {
        display: flex;
        justify-content: space-between;
        font-size: var(--glass-text-small);
        color: var(--glass-chart-dot);
      }
    `,
  ];
}

/** "11% more than yesterday", "3% less than yesterday", "same as yesterday". */
registerCard({
  type: 'glass-electricity',
  name: 'Glass · Energy today',
  description: 'Today’s electricity or gas: cost and use, compared with yesterday, with an hourly dot chart.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-electricity': GlassElectricity;
  }
}

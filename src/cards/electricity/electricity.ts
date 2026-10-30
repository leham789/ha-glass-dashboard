import { css, html, nothing, type PropertyValues } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, openMoreInfo, registerCard } from '../../ha.js';
import { type DailyUsage, dailyUsage } from '../../history.js';
import { formatValue } from '../../format.js';
import '../../elements/glass-icon.js';
import './electricity-editor.js';

export interface ElectricityConfig extends LovelaceCardConfig {
  /** Energy that counts up: kWh today, or the meter's total. */
  energy: string;
  /** Today's cost, e.g. from your supplier's integration (optional). */
  cost?: string;
  title?: string;
}

const DOTS = 10;
const REFRESH_MS = 10 * 60 * 1000;

/**
 * Today's electricity: what it's cost, how much you've used and how that
 * compares with yesterday by this time, and an hour-by-hour dot chart that
 * fills up to now and stays faint after.
 */
@customElement('glass-electricity')
export class GlassElectricity extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: ElectricityConfig;
  @state() private usage?: DailyUsage;
  private timer?: number;

  static getConfigElement() {
    return document.createElement('glass-electricity-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<ElectricityConfig> {
    return { energy: Object.keys(hass.states).find((id) => hass.states[id].attributes.device_class === 'energy') ?? '' };
  }

  setConfig(config: ElectricityConfig): void {
    if (!config.energy) throw new Error('Choose an energy sensor');
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
    this.load();
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
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
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const cost = this.config.cost ? this.hass.states[this.config.cost] : undefined;
    const u = this.usage;
    const big = cost ? formatValue(cost).value : u ? `${u.today.toFixed(1)} kWh` : '–';
    const compare = u && u.yesterdaySoFar > 0 ? comparison(u.today, u.yesterdaySoFar) : '';
    const line = [cost && u ? `${u.today.toFixed(1)} kWh` : '', compare].filter(Boolean).join(' · ');
    const nowHour = new Date().getHours();
    const max = Math.max(...(u?.hours ?? [0]), 0.001);

    return html`<section aria-labelledby="h">
      <span class="top">
        <span class="head">
          <h2 id="h">${this.config.title ?? 'Electricity today'}</h2>
          <span class="big">${big}</span>
          ${line ? html`<span class="line">${line}</span>` : nothing}
        </span>
        <button type="button" class="icon" aria-label="Electricity details" @click=${() => openMoreInfo(this, this.config!.energy)}>
          <glass-icon name="zap" size="18" stroke="1.7"></glass-icon>
        </button>
      </span>
      <span class="chart" role="img" aria-label="Electricity use each hour today">
        ${Array.from({ length: 24 }, (_, h) => {
          const level = u && h <= nowHour ? Math.round(((u.hours[h] ?? 0) / max) * DOTS) : 0;
          return html`<span class="col">${Array.from({ length: DOTS }, (_, k) => html`<span class="d ${k < level ? 'on' : ''}"></span>`)}</span>`;
        })}
      </span>
      <span class="axis"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></span>
    </section>`;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      section {
        box-sizing: border-box;
        padding: var(--glass-space-edge);
        border-radius: var(--glass-radius-card);
        background: linear-gradient(165deg, #7e9a2c 0%, #a6c23a 50%, #d2ee6a 100%);
        box-shadow: 0 20px 44px rgba(120, 150, 40, 0.25);
        display: flex;
        flex-direction: column;
        gap: 18px;
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
      .big {
        font-size: 56px;
        font-weight: 200;
        letter-spacing: -2px;
        line-height: 1.05;
      }
      .line {
        font-size: var(--glass-text-caption);
      }
      .icon {
        all: unset;
        width: 44px;
        height: 44px;
        flex: none;
        border-radius: 50%;
        background: var(--glass-ink);
        color: var(--glass-on-ink);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .icon:focus-visible {
        outline: 2px solid #fff;
        outline-offset: 2px;
      }
      .chart {
        height: 104px;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
      }
      .col {
        display: flex;
        flex-direction: column-reverse;
        gap: 4px;
      }
      .d {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.35);
      }
      .d.on {
        background: var(--glass-ink);
      }
      .axis {
        display: flex;
        justify-content: space-between;
        font-size: var(--glass-text-small);
        color: var(--glass-ink);
      }
    `,
  ];
}

/** "11% more than yesterday", "3% less than yesterday", "same as yesterday". */
function comparison(today: number, yesterday: number): string {
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  if (pct === 0) return 'same as yesterday';
  return `${Math.abs(pct)}% ${pct > 0 ? 'more' : 'less'} than yesterday`;
}

registerCard({
  type: 'glass-electricity',
  name: 'Glass · Electricity today',
  description: 'Today’s cost and use, compared with yesterday, with an hourly dot chart.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-electricity': GlassElectricity;
  }
}

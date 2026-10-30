import { css, html, nothing, type PropertyValues } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, isUnavailable, navigate, openMoreInfo, registerCard } from '../../ha.js';
import { hourlyAverages } from '../../history.js';
import '../../elements/glass-icon.js';
import './energy-tiles-editor.js';

export interface EnergyTilesConfig extends LovelaceCardConfig {
  /** The heating thermostat, e.g. climate.living_room. */
  climate?: string;
  /** Power right now, in W or kW. */
  power?: string;
  /** Sensors with today's cost, added together (e.g. electricity and gas). */
  cost_entities?: string[];
  /** Words after the cost, e.g. "elec + gas". */
  cost_label?: string;
  /** Both tiles open this view (Heating & Energy). */
  navigation_path?: string;
}

const CHART_HOURS = 12;
const CHART_DOTS = 7;
const REFRESH_MS = 10 * 60 * 1000;
const CURRENCY: Record<string, string> = { GBP: '£', EUR: '€', USD: '$' };

/**
 * Home's two tiles for Heating & Energy: the thermostat (what it's set to,
 * how warm the room is, what the boiler's doing) and electricity (power
 * right now, a dot chart of the last 12 hours, and what today has cost).
 */
@customElement('glass-energy-tiles')
export class GlassEnergyTiles extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: EnergyTilesConfig;
  @state() private hours: number[] = [];
  private timer?: number;

  static getConfigElement() {
    return document.createElement('glass-energy-tiles-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<EnergyTilesConfig> {
    return {
      climate: Object.keys(hass.states).find((id) => id.startsWith('climate.')),
      power: Object.keys(hass.states).find((id) => hass.states[id].attributes.device_class === 'power'),
    };
  }

  setConfig(config: EnergyTilesConfig): void {
    const changed = config.power !== this.config?.power;
    this.config = config;
    if (changed && this.hass) this.loadHistory();
  }

  getCardSize(): number {
    return 4;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    ensureFonts();
    this.timer = window.setInterval(() => this.loadHistory(), REFRESH_MS);
  }

  disconnectedCallback(): void {
    window.clearInterval(this.timer);
    super.disconnectedCallback();
  }

  protected firstUpdated(): void {
    this.loadHistory();
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has('hass') || changed.size > 1 || !this.config) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    const ids = [this.config.climate, this.config.power, ...(this.config.cost_entities ?? [])].filter(Boolean) as string[];
    return !old || ids.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  private async loadHistory() {
    const id = this.config?.power;
    if (!this.hass || !id) return;
    try {
      this.hours = await hourlyAverages(this.hass, id, CHART_HOURS);
    } catch {
      // No history (recorder off or excluded): the chart just stays empty.
      this.hours = [];
    }
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const { climate, power } = this.config;
    return html`<section aria-label="Heating and energy">
      ${climate ? this.renderHeating(climate) : nothing} ${power ? this.renderEnergy(power) : nothing}
    </section>`;
  }

  private renderHeating(id: string) {
    const e = this.hass!.states[id];
    if (!e) return nothing;
    const a = e.attributes;
    const off = e.state === 'off' || isUnavailable(e);
    const target = typeof a.temperature === 'number' ? `${Math.round(a.temperature * 2) / 2}°` : '–';
    const room = typeof a.current_temperature === 'number' ? `Room is ${a.current_temperature.toFixed(1)}°` : '';
    // Only what it's actually doing (heating, idle); the mode alone ("heat") doesn't say.
    const action = a.hvac_action ? String(a.hvac_action).replace('_', ' ') : '';
    return html`<button type="button" class="tile heating" @click=${() => this.open(id)}>
      <span class="top">
        <span class="ring"><glass-icon name="thermometer" size="18"></glass-icon></span>
        <span class="go" aria-hidden="true"><glass-icon name="arrow-up-right" size="16" stroke="1.8"></glass-icon></span>
      </span>
      <span class="bottom">
        <span class="label">${off ? 'Heating' : 'Heating · set to'}</span>
        <span class="stat">${off ? 'Off' : target}</span>
        <span class="small">${[room, action].filter(Boolean).join(' · ')}</span>
      </span>
    </button>`;
  }

  private renderEnergy(id: string) {
    const e = this.hass!.states[id];
    if (!e) return nothing;
    const unit = String(e.attributes.unit_of_measurement ?? 'W');
    const value = Number(e.state);
    const watts = unit.toLowerCase() === 'kw' ? value * 1000 : value;
    const now = Number.isFinite(watts)
      ? watts >= 1000
        ? { n: (watts / 1000).toFixed(1), u: 'kW' }
        : { n: String(Math.round(watts)), u: 'W' }
      : { n: '–', u: '' };

    const max = Math.max(...this.hours, 1);
    const cost = this.cost();

    return html`<button type="button" class="tile energy" @click=${() => this.open(id)}>
      <span class="top">
        <span class="now">
          <span class="label">Using now</span>
          <span class="stat">${now.n}<span class="unit"> ${now.u}</span></span>
        </span>
        <span class="go" aria-hidden="true"><glass-icon name="arrow-up-right" size="16" stroke="1.8"></glass-icon></span>
      </span>
      <span class="chart" aria-hidden="true">
        ${this.hours.map((h) => {
          const level = Math.round((h / max) * CHART_DOTS);
          return html`<span class="col">
            ${Array.from({ length: CHART_DOTS }, (_, i) => html`<span class="d ${i < level ? 'on' : ''}"></span>`)}
          </span>`;
        })}
      </span>
      <span class="small dark">${cost}</span>
    </button>`;
  }

  /** "£4.95 today · elec + gas" from the cost sensors, or nothing. */
  private cost(): string {
    const ids = this.config?.cost_entities ?? [];
    const states = ids.map((id) => this.hass!.states[id]).filter((e) => e && Number.isFinite(Number(e.state)));
    if (!states.length) return '';
    const total = states.reduce((s, e) => s + Number(e.state), 0);
    const unit = String(states[0].attributes.unit_of_measurement ?? '').split('/')[0].trim();
    const symbol = CURRENCY[unit.toUpperCase()] ?? '';
    const amount = symbol ? `${symbol}${total.toFixed(2)}` : `${total.toFixed(2)} ${unit}`.trim();
    return [`${amount} today`, this.config?.cost_label].filter(Boolean).join(' · ');
  }

  private open(id: string) {
    if (this.config?.navigation_path) navigate(this.config.navigation_path);
    else openMoreInfo(this, id);
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      section {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--glass-space-tile-gap);
      }
      .tile {
        all: unset;
        box-sizing: border-box;
        height: 200px;
        padding: var(--glass-space-tile);
        border-radius: var(--glass-radius-tile);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        min-width: 0;
      }
      .tile:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      .heating {
        color: #fff;
        background: linear-gradient(160deg, #c98579 0%, #b0675e 55%, #c59a72 100%);
        box-shadow: 0 14px 30px rgba(160, 90, 80, 0.25);
      }
      .energy {
        color: var(--glass-ink);
        background: linear-gradient(160deg, #7e9a2c 0%, #a6c23a 55%, #d2ee6a 100%);
        box-shadow: 0 14px 30px rgba(120, 150, 40, 0.25);
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      .ring {
        box-sizing: border-box;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 1px solid rgba(255, 255, 255, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .go {
        width: 40px;
        height: 40px;
        flex: none;
        border-radius: 50%;
        background: var(--glass-ink);
        color: var(--glass-on-ink);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .bottom,
      .now {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .now {
        color: #fff;
        gap: 0;
      }
      .label {
        font-size: var(--glass-text-caption);
      }
      .stat {
        font-size: 40px;
        font-weight: 300;
        letter-spacing: -1px;
      }
      .unit {
        font-size: var(--glass-text-body);
        letter-spacing: 0;
      }
      .small {
        font-size: var(--glass-text-small);
      }
      .chart {
        display: flex;
        gap: 4px;
        align-items: flex-end;
        height: 48px;
      }
      .col {
        display: flex;
        flex-direction: column-reverse;
        gap: 3px;
      }
      .d {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.45);
      }
      .d.on {
        background: var(--glass-ink);
      }
    `,
  ];
}

registerCard({
  type: 'glass-energy-tiles',
  name: 'Glass · Heating & Energy tiles',
  description: 'Thermostat and electricity side by side, with a 12-hour dot chart and today’s cost.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-energy-tiles': GlassEnergyTiles;
  }
}

import '../../elements/glass-number.js';
import { css, html, nothing, type PropertyValues } from 'lit';
import '../../elements/glass-button.js';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { cardSurface } from '../../elements/surfaces.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, isUnavailable, openMoreInfo, registerCard } from '../../ha.js';
import './thermostat-row-editor.js';
import { haptic } from '../../motion.js';
import '../../elements/glass-roll.js';

export interface ThermostatRowConfig extends LovelaceCardConfig {
  entity: string;
}

const SEND_AFTER_MS = 800;

/**
 * A room's heating in one row: what it's set to (and how warm it is now),
 * with − and + buttons. Taps add up and are sent together once you stop.
 */
@customElement('glass-thermostat-row')
export class GlassThermostatRow extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: ThermostatRowConfig;
  /** The target while you're tapping, before it's sent. */
  @state() private pending?: number;
  private timer?: number;

  static getConfigElement() {
    return document.createElement('glass-thermostat-row-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<ThermostatRowConfig> {
    return { entity: Object.keys(hass.states).find((id) => id.startsWith('climate.')) ?? '' };
  }

  setConfig(config: ThermostatRowConfig): void {

    this.needs = undefined;
    if (!config.entity?.startsWith('climate.')) return this.setUp(config, 'Choose a thermostat');
    this.config = config;
  }

  getCardSize(): number {
    return 2;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    ensureFonts();
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (this.needs) return true;
    if (!changed.has('hass') || changed.size > 1 || !this.config) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    return !old || old.states[this.config.entity] !== this.hass!.states[this.config.entity];
  }

  render() {
    if (this.needs) return this.renderSetup('thermometer');
    if (!this.config || !this.hass) return nothing;
    const e = this.hass.states[this.config.entity];
    if (!e) return this.renderMissing(this.config.entity);
    const a = e.attributes;
    const off = e.state === 'off' || isUnavailable(e);
    const target = this.pending ?? a.temperature;
    const now = typeof a.current_temperature === 'number' ? `now ${a.current_temperature.toFixed(1)}°` : '';
    const action = a.hvac_action ? String(a.hvac_action).replace('_', ' ') : '';
    // Unavailable: "Offline" and the grey dash, the card at 50% (whether the heating is off isn't known).
    const unavailable = isUnavailable(e);
    const label = unavailable ? 'Offline' : off ? 'Heating is off' : ['Heating set to', [now, action].filter(Boolean).join(', ')].filter(Boolean).join(' · ');

    return html`<section aria-label="Room heating" class=${unavailable ? 'offline' : ''}>
      <button type="button" class="info" @click=${() => openMoreInfo(this, this.config!.entity)}>
        <span class="label">${label}</span>
        <glass-number size="stat-s" .value=${off && !unavailable ? 'Off' : ''} ?nil=${unavailable || (!off && typeof target !== 'number')}
          >${!off && typeof target === 'number' ? html`<glass-roll .value=${target} text="${fmt(target)}°"></glass-roll>` : nothing}</glass-number
        >
      </button>
      <span class="buttons">
        <glass-icon-button look="white" text="−" label="Lower temperature" ?disabled=${off} @click=${() => this.step(-1)}></glass-icon-button>
        <glass-icon-button look="dark" text="+" label="Raise temperature" ?disabled=${off} @click=${() => this.step(1)}></glass-icon-button>
      </span>
    </section>`;
  }

  private step(dir: number) {
    const a = this.hass!.states[this.config!.entity].attributes;
    const step = a.target_temp_step ?? 0.5;
    const from = this.pending ?? a.temperature ?? a.current_temperature ?? 18;
    const next = Math.min(a.max_temp ?? 30, Math.max(a.min_temp ?? 5, Math.round((from + dir * step) / step) * step));
    if (next !== from) haptic('selection');
    this.pending = next;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(async () => {
      await this.hass!.callService('climate', 'set_temperature', { entity_id: this.config!.entity, temperature: next });
      this.pending = undefined;
    }, SEND_AFTER_MS);
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      section {
        ${cardSurface}
        box-sizing: border-box;
        padding: 16px 16px 16px var(--glass-space-edge);
        border-radius: var(--glass-radius-card);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      section.offline {
        opacity: 0.5;
      }
      /* Half width: the number on top, − and + under it. */
      :host([narrow]) section {
        flex-direction: column;
        align-items: stretch;
      }
      .info {
        all: unset;
        display: flex;
        flex-direction: column;
        min-width: 0;
        cursor: pointer;
      }
      .label {
        font-size: var(--glass-text-caption);
        color: var(--glass-text-muted);
      }
      .buttons {
        display: flex;
        gap: 8px;
      }
      button:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
    `,
  ];
}

const fmt = (t: number) => (Number.isInteger(t) ? String(t) : t.toFixed(1));

registerCard({
  type: 'glass-thermostat-row',
  name: 'Glass · Thermostat row',
  description: 'A room’s heating target with − and + buttons.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-thermostat-row': GlassThermostatRow;
  }
}

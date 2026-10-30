import { css, html, nothing, type PropertyValues } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
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
    if (!config.entity?.startsWith('climate.')) throw new Error('Choose a thermostat');
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
    if (!changed.has('hass') || changed.size > 1 || !this.config) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    return !old || old.states[this.config.entity] !== this.hass!.states[this.config.entity];
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const e = this.hass.states[this.config.entity];
    if (!e) return nothing;
    const a = e.attributes;
    const off = e.state === 'off' || isUnavailable(e);
    const target = this.pending ?? a.temperature;
    const now = typeof a.current_temperature === 'number' ? `now ${a.current_temperature.toFixed(1)}°` : '';
    const action = a.hvac_action ? String(a.hvac_action).replace('_', ' ') : '';
    const label = off ? 'Heating is off' : ['Heating set to', [now, action].filter(Boolean).join(', ')].filter(Boolean).join(' · ');

    return html`<section aria-label="Room heating">
      <button type="button" class="info" @click=${() => openMoreInfo(this, this.config!.entity)}>
        <span class="label">${label}</span>
        <span class="value"
          >${off ? 'Off' : typeof target === 'number' ? html`<glass-roll .value=${target} text="${fmt(target)}°"></glass-roll>` : '–'}</span
        >
      </button>
      <span class="buttons">
        <button type="button" class="minus" aria-label="Lower temperature" ?disabled=${off} @click=${() => this.step(-1)}>−</button>
        <button type="button" class="plus" aria-label="Raise temperature" ?disabled=${off} @click=${() => this.step(1)}>+</button>
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
        box-sizing: border-box;
        padding: 14px 14px 14px var(--glass-space-edge);
        border-radius: var(--glass-radius-card);
        background: var(--glass-surface);
        border: 1px solid var(--glass-surface-border);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
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
      .value {
        font-size: 32px;
        font-weight: 300;
      }
      .buttons {
        display: flex;
        gap: 8px;
      }
      .buttons button {
        all: unset;
        box-sizing: border-box;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        cursor: pointer;
      }
      .buttons .minus {
        background: var(--glass-solid);
        border: 1px solid rgba(var(--glass-line-rgb), 0.12);
      }
      .buttons .plus {
        background: var(--glass-ink);
        color: var(--glass-on-ink);
      }
      .buttons button:disabled {
        opacity: 0.4;
        cursor: default;
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

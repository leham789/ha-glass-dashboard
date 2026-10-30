import { css, html, nothing, type PropertyValues } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, isUnavailable, registerCard } from '../../ha.js';
import { formatValue } from '../../format.js';
import { nameInRoom } from '../../rooms.js';
import './switch-rows-editor.js';

export interface SwitchRowsConfig extends LovelaceCardConfig {
  /** Plugs and switches, in order. */
  entities: string[];
  title?: string;
}

/**
 * Smart plugs as 64-high glass rows with a switch: the name, and underneath
 * what it's drawing and has used ("2.2 W now · 3.69 kWh total"), found from
 * the plug's own power and energy sensors.
 */
@customElement('glass-switch-rows')
export class GlassSwitchRows extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: SwitchRowsConfig;
  private watched: string[] = [];

  static getConfigElement() {
    return document.createElement('glass-switch-rows-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<SwitchRowsConfig> {
    return { entities: Object.keys(hass.states).filter((id) => id.startsWith('switch.')).slice(0, 3) };
  }

  setConfig(config: SwitchRowsConfig): void {
    if (!Array.isArray(config.entities) || !config.entities.length) throw new Error('Choose at least one switch');
    this.config = config;
  }

  getCardSize(): number {
    return 1 + this.config!.entities.length;
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
    return !old || this.watched.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  /** The plug's own power (W) and energy (kWh) sensors, from the same device. */
  private readings(id: string): string[] {
    const hass = this.hass!;
    const device = hass.entities?.[id]?.device_id;
    if (!device) return [];
    const siblings = Object.values(hass.entities).filter((e) => e.device_id === device && e.entity_id !== id);
    const find = (cls: string) =>
      siblings.map((e) => hass.states[e.entity_id]).find((e) => e && e.attributes.device_class === cls && !isUnavailable(e));
    return [find('power'), find('energy')].filter((e) => !!e).map((e) => e!.entity_id);
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const hass = this.hass;
    this.watched = this.config.entities.flatMap((id) => [id, ...this.readings(id)]);
    return html`<section aria-labelledby="h">
      <h2 id="h">${this.config.title ?? 'Power'}</h2>
      ${this.config.entities.map((id) => {
        const e = hass.states[id];
        if (!e) return nothing;
        const on = e.state === 'on';
        const offline = isUnavailable(e);
        const detail = this.readings(id)
          .map((r, i) => {
            const { value } = formatValue(hass.states[r]);
            return `${value} ${i === 0 ? 'now' : 'total'}`;
          })
          .join(' · ');
        const name = nameInRoom(hass, e);
        return html`<div class="row ${offline ? 'offline' : ''}">
          <span class="text">
            <span class="name">${name}</span>
            <span class="detail">${offline ? 'Offline' : detail}</span>
          </span>
          <button
            type="button"
            role="switch"
            class=${on ? 'on' : ''}
            aria-checked=${on ? 'true' : 'false'}
            aria-label=${name}
            ?disabled=${offline}
            @click=${() => hass.callService('homeassistant', on ? 'turn_off' : 'turn_on', { entity_id: id })}
          >
            <span class="knob"></span>
          </button>
        </div>`;
      })}
    </section>`;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      section {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 400;
      }
      .row {
        box-sizing: border-box;
        height: 64px;
        padding: 0 16px 0 var(--glass-space-edge);
        border-radius: 32px;
        background: var(--glass-surface);
        border: 1px solid var(--glass-surface-border);
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .row.offline {
        opacity: 0.5;
      }
      .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.2;
      }
      .name {
        font-size: var(--glass-text-body);
      }
      .detail {
        font-size: var(--glass-text-small);
        color: var(--glass-text-muted);
      }
      button {
        all: unset;
        position: relative;
        width: 52px;
        height: 32px;
        flex: none;
        border-radius: 16px;
        background: rgba(var(--glass-line-rgb), 0.15);
        cursor: pointer;
        transition: background 0.2s ease;
      }
      button.on {
        background: var(--glass-go);
      }
      button:disabled {
        cursor: default;
      }
      button:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      .knob {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
        transition: left 0.2s ease;
      }
      .on .knob {
        left: 23px;
      }
    `,
  ];
}

registerCard({
  type: 'glass-switch-rows',
  name: 'Glass · Power switches',
  description: 'Smart plugs as switch rows with what they’re drawing and have used.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-switch-rows': GlassSwitchRows;
  }
}

import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, isUnavailable, registerCard, reportVisibility } from '../../ha.js';
import { nameInRoom } from '../../rooms.js';
import './room-alert-editor.js';

export interface RoomAlertConfig extends LovelaceCardConfig {
  /** A smart bulb… */
  light: string;
  /** …and the wall switch or plug that powers it. */
  switch: string;
}

/**
 * Only appears when a smart bulb is offline because its mains switch is
 * off ("Ceiling light is offline"), with a Power on button. Hidden otherwise.
 */
@customElement('glass-room-alert')
export class GlassRoomAlert extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: RoomAlertConfig;

  static getConfigElement() {
    return document.createElement('glass-room-alert-editor');
  }

  static getStubConfig(): Partial<RoomAlertConfig> {
    return {};
  }

  setConfig(config: RoomAlertConfig): void {
    if (!config.light || !config.switch) throw new Error('Choose the bulb and the switch that powers it');
    this.config = config;
  }

  getCardSize(): number {
    return this.showing() ? 2 : 0;
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
    const ids = [this.config.light, this.config.switch];
    return !old || ids.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  protected updated(): void {
    reportVisibility(this, this.showing());
  }

  private showing(): boolean {
    if (!this.config || !this.hass) return false;
    return isUnavailable(this.hass.states[this.config.light]) && this.hass.states[this.config.switch]?.state === 'off';
  }

  render() {
    if (!this.showing()) return nothing;
    const light = this.hass!.states[this.config!.light];
    const name = light ? nameInRoom(this.hass!, light) : 'A light';
    return html`<section role="status" aria-label="${name} offline">
      <span class="text">
        <span class="title">${name} light is offline</span>
        <span class="why">Its mains switch is off, so the bulb has no power.</span>
      </span>
      <button
        type="button"
        @click=${() => this.hass!.callService('homeassistant', 'turn_on', { entity_id: this.config!.switch })}
      >
        Power on
      </button>
    </section>`;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      :host([hidden]) {
        display: none;
      }
      section {
        box-sizing: border-box;
        padding: 16px 16px 16px var(--glass-space-edge);
        border-radius: var(--glass-radius-card);
        background: var(--glass-room-alert);
        border: 1px solid #f2b8a2;
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .text {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .title {
        font-size: var(--glass-text-body);
      }
      .why {
        font-size: var(--glass-text-caption);
        color: #6b3a26;
      }
      button {
        all: unset;
        flex: none;
        height: 48px;
        padding: 0 16px;
        border-radius: 24px;
        background: var(--glass-ink);
        color: #fff;
        font-size: var(--glass-text-chip);
        cursor: pointer;
      }
      button:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
    `,
  ];
}

registerCard({
  type: 'glass-room-alert',
  name: 'Glass · Room alert',
  description: 'Shows when a smart bulb is offline because its wall switch is off, with Power on.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-room-alert': GlassRoomAlert;
  }
}

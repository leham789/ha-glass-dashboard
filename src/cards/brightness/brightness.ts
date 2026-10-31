import { css, html, nothing, type PropertyValues } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, isUnavailable, openMoreInfo, registerCard } from '../../ha.js';
import { styleMap } from 'lit/directives/style-map.js';
import { brightnessPct, groupMembers, isLightOn, lightLook } from '../../light-colour.js';
import { distinctNames, shortName } from '../../rooms.js';
import '../../elements/glass-icon.js';
import './brightness-editor.js';

export interface BrightnessConfig extends LovelaceCardConfig {
  /** A light or light group, e.g. the room's Hue group. */
  entity: string;
  name?: string;
  /** Show the group's own lights as small tiles underneath, for a room with a few lamps. */
  lamps?: boolean;
}

interface Tone {
  name: string;
  swatch: string;
  kelvin?: number;
}

const TONES: Tone[] = [
  { name: 'Warm', swatch: '#F5B866', kelvin: 2700 },
  { name: 'Neutral', swatch: '#F6E7C8', kelvin: 4000 },
  { name: 'Cool', swatch: '#CFE3F7', kelvin: 5500 },
  { name: 'Colour', swatch: 'conic-gradient(#F59AA0, #F7D58C, #9FE3B0, #9CC3F2, #CDB8F5, #F59AA0)' },
];
const COLOUR_MODES = new Set(['hs', 'rgb', 'rgbw', 'rgbww', 'xy']);

/**
 * A room's main dimmer: a big slider whose fill is the brightness (drag to
 * zero to switch off), and Warm / Neutral / Cool / Colour presets underneath
 * for lights that can change colour. Colour opens HA's colour picker. With
 * lamps on, the group's lights sit underneath as small tiles, three across.
 */
@customElement('glass-brightness')
export class GlassBrightness extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: BrightnessConfig;
  /** The value while dragging, before HA confirms it. */
  @state() private dragging?: number;

  static getConfigElement() {
    return document.createElement('glass-brightness-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<BrightnessConfig> {
    return { entity: Object.keys(hass.states).find((id) => id.startsWith('light.')) ?? '' };
  }

  setConfig(config: BrightnessConfig): void {
    if (!config.entity?.startsWith('light.')) throw new Error('Choose a light or light group');
    this.config = config;
  }

  getCardSize(): number {
    return 3;
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
    const ids = [this.config.entity, ...(this.config.lamps ? (groupMembers(this.hass!.states[this.config.entity]) ?? []) : [])];
    return !old || ids.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  /** The group's lights as small tiles, coloured like light tiles. Tap to toggle. */
  private renderLamps() {
    const states = this.hass!.states;
    const members = (groupMembers(states[this.config!.entity]) ?? []).map((id) => states[id]).filter(Boolean);
    if (!members.length) return nothing;
    const names = distinctNames(members.map((m) => shortName(m, '')));
    return html`<div class="lamps">
      ${members.map((m, i) => {
        const offline = isUnavailable(m);
        const lit = !offline && isLightOn(m, states);
        const look = lightLook(m, lit);
        const pct = brightnessPct(m);
        return html`<button
          type="button"
          class="lamp ${lit ? 'on' : ''}"
          style=${styleMap({ background: look.background, boxShadow: look.shadow })}
          ?disabled=${offline}
          aria-pressed=${lit ? 'true' : 'false'}
          @click=${() => this.hass!.callService('light', lit ? 'turn_off' : 'turn_on', { entity_id: m.entity_id })}
        >
          <span class="bulb"><glass-icon name="lightbulb" size="17"></glass-icon></span>
          <span class="lname">${names[i]}<span>${offline ? 'Offline' : lit ? (pct === undefined ? 'On' : `${pct}%`) : 'Off'}</span></span>
        </button>`;
      })}
    </div>`;
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const e = this.hass.states[this.config.entity];
    if (!e) return nothing;
    const offline = isUnavailable(e);
    const on = isLightOn(e, this.hass.states);
    const pct = this.dragging ?? (on ? (brightnessPct(e) ?? 100) : 0);
    const modes: string[] = e.attributes.supported_color_modes ?? [];
    const canTemp = modes.includes('color_temp');
    const canColour = modes.some((m) => COLOUR_MODES.has(m));
    const current = on ? currentTone(e.attributes) : undefined;
    const tones = TONES.filter((t) => (t.kelvin ? canTemp : canColour));

    return html`<section aria-label="Brightness">
      <label for="slider">
        <span>${this.config.name ?? e.attributes.friendly_name}</span>
        <span class="pct">${offline ? 'Offline' : on || this.dragging ? `${pct}%` : 'Off'}</span>
      </label>
      <div class="track">
        <span class="fill" style="width: ${pct}%"></span>
        <glass-icon class="sun" name="sun" size="22"></glass-icon>
        <input
          id="slider"
          type="range"
          min="0"
          max="100"
          step="1"
          .value=${String(pct)}
          ?disabled=${offline}
          @input=${(ev: Event) => (this.dragging = Number((ev.target as HTMLInputElement).value))}
          @change=${(ev: Event) => this.setBrightness(Number((ev.target as HTMLInputElement).value))}
        />
      </div>
      ${tones.length
        ? html`<div class="tones">
            ${tones.map(
              (t) => html`<button
                type="button"
                class=${t.name === current ? 'current' : ''}
                aria-pressed=${t.name === current ? 'true' : 'false'}
                ?disabled=${offline}
                @click=${() => this.pick(t)}
              >
                <span class="swatch" style="background: ${t.swatch}"></span>${t.name}
              </button>`,
            )}
          </div>`
        : nothing}
      ${this.config.lamps ? this.renderLamps() : nothing}
    </section>`;
  }

  private async setBrightness(pct: number) {
    const id = this.config!.entity;
    await (pct === 0
      ? this.hass!.callService('light', 'turn_off', { entity_id: id })
      : this.hass!.callService('light', 'turn_on', { entity_id: id, brightness_pct: pct }));
    this.dragging = undefined;
  }

  private pick(t: Tone) {
    const id = this.config!.entity;
    if (t.kelvin) this.hass!.callService('light', 'turn_on', { entity_id: id, color_temp_kelvin: t.kelvin });
    else openMoreInfo(this, id);
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
        background: var(--glass-surface);
        border: 1px solid var(--glass-surface-border);
        box-shadow: 0 18px 44px rgba(120, 90, 30, 0.1);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      label {
        display: flex;
        justify-content: space-between;
        font-size: var(--glass-text-body);
      }
      .pct {
        color: var(--glass-text-secondary);
      }
      .track {
        position: relative;
        height: 72px;
        border-radius: 36px;
        background: rgba(var(--glass-line-rgb), 0.06);
        overflow: hidden;
      }
      .fill {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        border-radius: 36px;
        background: var(--glass-light-fill);
      }
      .sun {
        position: absolute;
        left: 22px;
        top: 25px;
        pointer-events: none;
      }
      input {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        opacity: 0;
        cursor: ew-resize;
        touch-action: pan-y;
      }
      .track:has(input:focus-visible) {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      .lamps {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .lamp {
        all: unset;
        box-sizing: border-box;
        height: 112px;
        padding: 12px;
        border-radius: var(--glass-radius-small-tile);
        border: 1px solid var(--glass-hairline);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        cursor: pointer;
        transition: background 0.25s ease, box-shadow 0.25s ease;
        -webkit-tap-highlight-color: transparent;
      }
      .lamp.on {
        color: #121316; /* lit colours are pastel in both themes */
      }
      .lamp:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .lamp:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      .lamp .bulb {
        width: 36px;
        height: 36px;
        box-sizing: border-box;
        border-radius: 50%;
        border: 1px solid rgba(var(--glass-line-rgb), 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .lname {
        display: flex;
        flex-direction: column;
        line-height: 1.2;
        font-size: var(--glass-text-body);
      }
      .lname span {
        font-size: var(--glass-text-small);
        color: var(--glass-text-muted);
      }
      .lamp.on .lname span {
        color: rgba(18, 19, 22, 0.65);
      }
      .tones {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }
      .tones button {
        all: unset;
        box-sizing: border-box;
        height: 56px;
        border-radius: var(--glass-radius-inset);
        border: 1px solid var(--glass-hairline);
        background: var(--glass-solid);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        font-size: var(--glass-text-small);
        cursor: pointer;
      }
      .tones button.current {
        border-color: var(--glass-ink);
      }
      .tones button:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      .tones button:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .swatch {
        width: 16px;
        height: 16px;
        border-radius: 50%;
      }
    `,
  ];
}

/** Which preset the light is closest to right now. */
function currentTone(a: Record<string, any>): string | undefined {
  if (COLOUR_MODES.has(a.color_mode)) return 'Colour';
  const k = a.color_temp_kelvin ?? (a.color_temp ? 1_000_000 / a.color_temp : undefined);
  if (a.color_mode !== 'color_temp' || !k) return undefined;
  return k < 3300 ? 'Warm' : k < 4700 ? 'Neutral' : 'Cool';
}

registerCard({
  type: 'glass-brightness',
  name: 'Glass · Brightness',
  description: 'A big brightness slider with Warm, Neutral, Cool and Colour presets.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-brightness': GlassBrightness;
  }
}

import { css, html, nothing, type PropertyValues } from 'lit';
import '../../elements/glass-tile.js';
import '../../elements/glass-chip.js';
import '../../elements/glass-slider.js';
import type { GlassSlider } from '../../elements/glass-slider.js';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { cardSurface } from '../../elements/surfaces.js';
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
  /** How the lamps sit: tiles, rows, or auto (default: tiles, rows when the card is narrow). */
  lamps_style?: 'auto' | 'tiles' | 'rows';
}

interface Tone {
  name: string;
  swatch: string;
  kelvin?: number;
}

const TONES: Tone[] = [
  { name: 'Warm', swatch: 'var(--glass-swatch-warm)', kelvin: 2700 },
  { name: 'Neutral', swatch: 'var(--glass-swatch-neutral)', kelvin: 4000 },
  { name: 'Cool', swatch: 'var(--glass-swatch-cool)', kelvin: 5500 },
  { name: 'Colour', swatch: 'var(--glass-swatch-colour)' },
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

    this.needs = undefined;
    if (!config.entity?.startsWith('light.')) return this.setUp(config, 'Choose a light or light group');
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
    if (this.needs) return true;
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
    const style = this.config!.lamps_style ?? 'auto';
    const rows = style === 'rows' || (style === 'auto' && this.narrow);
    return html`<div class="lamps ${rows ? 'rows' : ''}">
      ${members.map((m, i) => {
        return html`<glass-tile .hass=${this.hass} entity=${m.entity_id} name=${names[i]} tile-style=${rows ? 'row' : 'small'}></glass-tile>`;
      })}
    </div>`;
  }

  render() {
    if (this.needs) return this.renderSetup('sun');
    if (!this.config || !this.hass) return nothing;
    const e = this.hass.states[this.config.entity];
    if (!e) return this.renderMissing(this.config.entity);
    const offline = isUnavailable(e);
    const on = isLightOn(e, this.hass.states);
    const pct = this.dragging ?? (on ? (brightnessPct(e) ?? 100) : 0);
    const modes: string[] = e.attributes.supported_color_modes ?? [];
    const canTemp = modes.includes('color_temp');
    const canColour = modes.some((m) => COLOUR_MODES.has(m));
    const current = on ? currentTone(e.attributes) : undefined;
    const inColour = on && COLOUR_MODES.has(e.attributes.color_mode) && Array.isArray(e.attributes.rgb_color);
    const tones = TONES.filter((t) => (t.kelvin ? canTemp : canColour));

    return html`<section aria-label="Brightness">
      <div class="label">
        <span>${this.config.name ?? e.attributes.friendly_name}</span>
        <span class="pct">${offline ? 'Offline' : on || this.dragging ? `${pct}%` : 'Off'}</span>
      </div>
      <glass-slider
        label="Brightness"
        .value=${pct}
        fill=${inColour ? 'colour' : 'light'}
        .rgb=${inColour ? e.attributes.rgb_color : undefined}
        ?disabled=${offline}
        @input=${(ev: Event) => (this.dragging = (ev.target as GlassSlider).value)}
        @change=${(ev: Event) => this.setBrightness((ev.target as GlassSlider).value)}
      ></glass-slider>
      ${tones.length
        ? html`<div class="tones">
            ${tones.map(
              (t) => html`<glass-colour-preset swatch=${t.swatch} ?selected=${t.name === current} ?disabled=${offline} @click=${() => this.pick(t)}>${t.name}</glass-colour-preset>`,
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
        ${cardSurface}
        box-sizing: border-box;
        padding: var(--glass-space-edge);
        border-radius: var(--glass-radius-card);
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .label {
        display: flex;
        justify-content: space-between;
        font-size: var(--glass-text-body);
      }
      .pct {
        color: var(--glass-text-secondary);
      }
      .lamps {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      .tones {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }
      .lamps.rows {
        grid-template-columns: minmax(0, 1fr);
        gap: 8px;
      }
      /* Half width: the presets two by two. */
      :host([narrow]) .tones {
        grid-template-columns: repeat(2, minmax(0, 1fr));
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

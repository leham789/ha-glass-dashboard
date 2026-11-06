import { css, html, nothing, type PropertyValues } from 'lit';
import '../../elements/glass-tile.js';
import { heading } from '../../elements/type.js';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { cardSurface } from '../../elements/surfaces.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HassEntity, type HomeAssistant, type LovelaceCardConfig, registerCard } from '../../ha.js';
import { distinctNames, shortName } from '../../rooms.js';
import { haptic } from '../../motion.js';
import './scenes-editor.js';

export interface ScenesConfig extends LovelaceCardConfig {
  /** Scenes (or scripts), in order. Each can carry a hint line: { entity, hint: Cool white }. */
  entities: (string | { entity: string; hint?: string })[];
  title?: string;
  /** Inside a card with "… is on" (default), or the tiles on their own, taller, with each hint. */
  style?: 'card' | 'plain';
  /** colour (default): tiles coloured by the scene's name. glass: the Tile's scene look, its hint (or room) as the grey line. */
  look?: 'colour' | 'glass';
}

const idOf = (e: ScenesConfig['entities'][number]) => (typeof e === 'string' ? e : e.entity);

interface Look {
  bg: string;
  dark?: boolean;
}

// Tile colours for the usual Hue scene names; anything else gets a soft neutral.
const LOOKS: [RegExp, Look][] = [
  [/energi[sz]e|work|focus/i, { bg: 'var(--glass-scene-focus)' }],
  [/concentrate|cool|day/i, { bg: 'var(--glass-scene-day)' }],
  [/bright/i, { bg: 'var(--glass-scene-bright)' }],
  [/read/i, { bg: 'var(--glass-scene-read)' }],
  [/relax|warm|evening|cosy|cozy/i, { bg: 'var(--glass-scene-relax)' }],
  [/night|dim|sleep/i, { bg: 'var(--glass-scene-night)', dark: true }],
  [/gam|party|colou?r|disco/i, { bg: 'var(--glass-scene-party)' }],
];
const DEFAULT_LOOK: Look = { bg: 'var(--glass-scene-default)' };

/**
 * Scene tiles, three across. The one you ran last gets a dark ring and is
 * named in the corner ("Relax is on"). Colours follow the scene's name.
 * Plain: the tiles on their own under a heading, each with a hint line.
 */
@customElement('glass-scenes')
export class GlassScenes extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: ScenesConfig;

  static getConfigElement() {
    return document.createElement('glass-scenes-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<ScenesConfig> {
    return { entities: Object.keys(hass.states).filter((id) => id.startsWith('scene.')).slice(0, 6) };
  }

  setConfig(config: ScenesConfig): void {

    this.needs = undefined;
    if (!Array.isArray(config.entities) || !config.entities.length) return this.setUp(config, 'Choose at least one scene');
    this.config = config;
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
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (this.needs) return true;
    if (!changed.has('hass') || changed.size > 1 || !this.config) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    return !old || this.config.entities.map(idOf).some((id) => old.states[id] !== this.hass!.states[id]);
  }

  /** The scene run most recently (a scene's state is when it last ran). */
  private active(scenes: HassEntity[]): HassEntity | undefined {
    return scenes
      .filter((e) => !Number.isNaN(Date.parse(e.state)))
      .sort((a, b) => Date.parse(b.state) - Date.parse(a.state))[0];
  }

  render() {
    if (this.needs) return this.renderSetup('sparkles');
    if (!this.config || !this.hass) return nothing;
    const scenes = this.config.entities.map((e) => this.hass!.states[idOf(e)]).filter(Boolean);
    const hint = (e: HassEntity) => {
      const c = this.config!.entities.find((x) => idOf(x) === e.entity_id);
      return typeof c === 'object' ? c.hint : undefined;
    };
    const plain = this.config.style === 'plain';
    const active = this.active(scenes);
    // Words every scene shares, like the room's name, are noise on a tile ("Bedroom Relax" → "Relax").
    const names = distinctNames(scenes.map((e) => shortName(e, '')));
    const name = (e: HassEntity) => names[scenes.indexOf(e)];

    return html`<section aria-labelledby="h" class=${plain ? 'plain' : ''}>
      <span class="top">
        <h2 id="h">${this.config.title ?? 'Scenes'}</h2>
        ${active && !plain ? html`<span class="note">${name(active)} is on</span>` : nothing}
      </span>
      <div class="grid">
        ${this.config.look === 'glass'
          ? scenes.map((e) => html`<glass-tile .hass=${this.hass} entity=${e.entity_id} name=${name(e)} tile-style="small" .line=${hint(e)}></glass-tile>`)
          : scenes.map((e) => {
          const look = LOOKS.find(([re]) => re.test(name(e)))?.[1] ?? DEFAULT_LOOK;
          const on = e === active;
          return html`<button
            type="button"
            class="${on ? 'current' : ''} ${look.dark ? 'dark' : ''}"
            style="background: ${look.bg}"
            aria-pressed=${on ? 'true' : 'false'}
            ?disabled=${e.state === 'unavailable'}
            @click=${() => this.run(e.entity_id)}
          >
            ${plain && hint(e) ? html`<span class="hint" aria-hidden="true">${hint(e)}</span>` : nothing}
            <span class="name">${name(e)}</span>
          </button>`;
            })}
      </div>
    </section>`;
  }

  private run(id: string) {
    const domain = id.split('.')[0];
    haptic('success');
    this.hass!.callService(domain === 'script' ? 'script' : 'scene', 'turn_on', { entity_id: id });
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
        gap: var(--glass-space-tile-gap);
      }
      section.plain {
        padding: 0;
        border: none;
        background: none;
        box-shadow: none;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        gap: 12px;
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
      }
      h2 {
        ${heading}
      }
      .note {
        font-size: var(--glass-text-caption);
        color: var(--glass-text-muted);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      button {
        all: unset;
        box-sizing: border-box;
        height: 92px;
        padding: 12px;
        border-radius: var(--glass-radius-small-tile);
        display: flex;
        align-items: flex-end;
        font-size: var(--glass-text-caption);
        color: var(--glass-on-pastel); /* scene colours are pastel in both themes */
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      button.dark {
        color: #fff;
      }
      .plain button {
        height: var(--glass-height-small-tile);
        flex-direction: column;
        justify-content: space-between;
        align-items: stretch;
      }
      .plain .name {
        margin-top: auto;
        font-size: var(--glass-text-body);
      }
      .hint {
        font-size: var(--glass-text-small);
        opacity: 0.8;
      }
      button.current {
        box-shadow: inset 0 0 0 2px var(--glass-ink);
      }
      button:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      button:disabled {
        opacity: 0.5;
        cursor: default;
      }
    `,
  ];
}

registerCard({
  type: 'glass-scenes',
  name: 'Glass · Scenes',
  description: 'Scene tiles three across; the last one you ran is ringed.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-scenes': GlassScenes;
  }
}

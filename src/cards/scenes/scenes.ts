import { css, html, nothing, type PropertyValues } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HassEntity, type HomeAssistant, type LovelaceCardConfig, registerCard } from '../../ha.js';
import { distinctNames, shortName } from '../../rooms.js';
import { haptic } from '../../motion.js';
import './scenes-editor.js';

export interface ScenesConfig extends LovelaceCardConfig {
  /** Scenes (or scripts), in order. */
  entities: string[];
  title?: string;
}

interface Look {
  bg: string;
  dark?: boolean;
}

// Tile colours for the usual Hue scene names; anything else gets a soft neutral.
const LOOKS: [RegExp, Look][] = [
  [/energi[sz]e|work|focus/i, { bg: 'linear-gradient(160deg, #E8F1FF 0%, #A9C6EE 100%)' }],
  [/concentrate|cool|day/i, { bg: 'linear-gradient(160deg, #FFFFFF 0%, #DCE7F5 100%)' }],
  [/bright/i, { bg: 'linear-gradient(160deg, #FFF8E6 0%, #F6E3B0 100%)' }],
  [/read/i, { bg: 'linear-gradient(160deg, #FFF1D6 0%, #F7D58C 100%)' }],
  [/relax|warm|evening|cosy|cozy/i, { bg: 'linear-gradient(160deg, #F7D58C 0%, #EFA86A 100%)' }],
  [/night|dim|sleep/i, { bg: 'linear-gradient(160deg, #E0683A 0%, #8A3A1C 100%)', dark: true }],
  [/gam|party|colou?r|disco/i, { bg: 'linear-gradient(160deg, #9CC3F2 0%, #CDB8F5 50%, #F59AA0 100%)' }],
];
const DEFAULT_LOOK: Look = { bg: 'linear-gradient(160deg, #FFFFFF 0%, #EDEEF1 100%)' };

/**
 * Scene tiles, three across. The one you ran last gets a dark ring and is
 * named in the corner ("Relax is on"). Colours follow the scene's name.
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
    if (!Array.isArray(config.entities) || !config.entities.length) throw new Error('Choose at least one scene');
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
    if (!changed.has('hass') || changed.size > 1 || !this.config) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    return !old || this.config.entities.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  /** The scene run most recently (a scene's state is when it last ran). */
  private active(scenes: HassEntity[]): HassEntity | undefined {
    return scenes
      .filter((e) => !Number.isNaN(Date.parse(e.state)))
      .sort((a, b) => Date.parse(b.state) - Date.parse(a.state))[0];
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const scenes = this.config.entities.map((id) => this.hass!.states[id]).filter(Boolean);
    const active = this.active(scenes);
    // Words every scene shares, like the room's name, are noise on a tile ("Bedroom Relax" → "Relax").
    const names = distinctNames(scenes.map((e) => shortName(e, '')));
    const name = (e: HassEntity) => names[scenes.indexOf(e)];

    return html`<section aria-labelledby="h">
      <span class="top">
        <h2 id="h">${this.config.title ?? 'Scenes'}</h2>
        ${active ? html`<span class="note">${name(active)} is on</span>` : nothing}
      </span>
      <div class="grid">
        ${scenes.map((e) => {
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
            ${name(e)}
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
        box-sizing: border-box;
        padding: var(--glass-space-edge);
        border-radius: var(--glass-radius-card);
        background: var(--glass-surface);
        border: 1px solid var(--glass-surface-border);
        box-shadow: 0 18px 44px rgba(80, 60, 140, 0.1);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
      }
      h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 400;
      }
      .note {
        font-size: var(--glass-text-caption);
        color: var(--glass-text-muted);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
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
        color: #121316; /* scene colours are pastel in both themes */
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      button.dark {
        color: #fff;
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

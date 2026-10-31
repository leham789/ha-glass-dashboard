import { css, html, nothing, type PropertyValues } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, isUnavailable, openMoreInfo, registerCard } from '../../ha.js';
import { brightnessPct, isLightOn } from '../../light-colour.js';
import { areaOf, shortName } from '../../rooms.js';
import type { IconName } from '../../icons.js';
import '../../elements/glass-icon.js';
import { haptic } from '../../motion.js';
import './favourites-editor.js';

export interface FavouritesConfig extends LovelaceCardConfig {
  /** Lights, switches, scenes, scripts… in the order you want them. */
  entities: string[];
  /** Tiles under a heading (default), or one row of pills. */
  style?: 'tiles' | 'pills';
  /** The heading over the tiles (default: Favourites). */
  title?: string;
}

const TOGGLES = new Set(['light', 'switch', 'fan', 'input_boolean', 'media_player', 'climate']);
const ACTIONS = new Set(['scene', 'script', 'button', 'input_button']);
const HOLD_MS = 500;

const ICONS: Record<string, IconName> = {
  light: 'lightbulb',
  scene: 'sparkles',
  script: 'sparkles',
  switch: 'power',
  input_boolean: 'power',
  button: 'power',
  input_button: 'power',
  fan: 'fan',
  media_player: 'speaker',
  climate: 'thermometer',
};

/**
 * Home's favourites: the things you reach for most, as tiles three across
 * under a heading, the row running off the screen and scrolling sideways.
 * A light that's on takes the light tile's colour, anything else that's on
 * is ink, and off is glass. Or, set to pills, one row of chips. Tap to
 * switch it (or run a scene or script); hold for its pop-up.
 */
@customElement('glass-favourites')
export class GlassFavourites extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: FavouritesConfig;
  private holdTimer?: number;
  private held = false;

  static getConfigElement() {
    return document.createElement('glass-favourites-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<FavouritesConfig> {
    return {
      entities: Object.keys(hass.states)
        .filter((id) => id.startsWith('light.') || id.startsWith('scene.'))
        .slice(0, 4),
    };
  }

  setConfig(config: FavouritesConfig): void {
    if (!Array.isArray(config.entities) || !config.entities.length) throw new Error('Choose at least one favourite');
    this.config = config;
  }

  getCardSize(): number {
    return 1;
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

  render() {
    if (!this.config || !this.hass) return nothing;
    if (this.config.style !== 'pills') return this.renderTiles();
    return html`<nav aria-label="Favourites">
      ${this.config.entities.map((id) => {
        const entity = this.hass!.states[id];
        if (!entity) return nothing;
        const domain = id.split('.')[0];
        const on = this.isOn(id);
        const label = entity.attributes.friendly_name ?? id;
        return html`<button
          type="button"
          class=${on ? 'on' : ''}
          ?disabled=${ACTIONS.has(domain) ? entity.state === 'unavailable' : isUnavailable(entity)}
          aria-pressed=${ACTIONS.has(domain) ? nothing : on ? 'true' : 'false'}
          @pointerdown=${(e: PointerEvent) => this.startHold(e, id)}
          @pointerup=${this.cancelHold}
          @pointerleave=${this.cancelHold}
          @pointercancel=${this.cancelHold}
          @contextmenu=${(e: Event) => e.preventDefault()}
          @click=${() => this.tap(id)}
        >
          ${label}
        </button>`;
      })}
    </nav>`;
  }

  private renderTiles() {
    const hass = this.hass!;
    const title = this.config!.title ?? 'Favourites';
    return html`<section aria-label=${title}>
      <h2>${title}</h2>
      <div class="tiles">
        ${this.config!.entities.map((id) => {
          const entity = hass.states[id];
          if (!entity) return nothing;
          const domain = id.split('.')[0];
          const action = ACTIONS.has(domain);
          const offline = action ? entity.state === 'unavailable' : isUnavailable(entity);
          const on = !action && this.isOn(id);
          const areaId = areaOf(hass, id);
          const area = areaId ? (hass.areas?.[areaId]?.name ?? '') : '';
          // A scene keeps its room as its second line ("Working · Office scene"); everything else shows its state.
          const name = action ? shortName(entity, area) : (entity.attributes.friendly_name ?? id);
          const pct = domain === 'light' && on ? brightnessPct(entity) : undefined;
          const state = offline
            ? 'Offline'
            : action
              ? area
                ? `${area} ${domain === 'script' ? 'script' : 'scene'}`
                : domain === 'script'
                  ? 'Script'
                  : 'Scene'
              : on
                ? pct !== undefined
                  ? `${pct}%`
                  : domain === 'media_player' && entity.state === 'playing'
                    ? 'Playing'
                    : 'On'
                : 'Off';
          return html`<button
            type="button"
            class="tile ${on ? (domain === 'light' ? 'lit' : 'on') : ''}"
            ?disabled=${offline}
            aria-pressed=${action ? nothing : on ? 'true' : 'false'}
            @pointerdown=${(e: PointerEvent) => this.startHold(e, id)}
            @pointerup=${this.cancelHold}
            @pointerleave=${this.cancelHold}
            @pointercancel=${this.cancelHold}
            @contextmenu=${(e: Event) => e.preventDefault()}
            @click=${() => this.tap(id)}
          >
            <glass-icon name=${ICONS[domain] ?? 'power'} size="24" stroke="1.6"></glass-icon>
            <span class="text"><span class="name">${name}</span><span class="state">${state}</span></span>
          </button>`;
        })}
      </div>
    </section>`;
  }

  private isOn(id: string): boolean {
    const e = this.hass!.states[id];
    if (!e) return false;
    if (id.startsWith('light.')) return isLightOn(e, this.hass!.states);
    if (id.startsWith('media_player.')) return e.state === 'playing' || e.state === 'on';
    if (id.startsWith('climate.')) return e.state !== 'off';
    return e.state === 'on';
  }

  private tap(id: string) {
    if (this.held) {
      this.held = false;
      return;
    }
    const domain = id.split('.')[0];
    if (ACTIONS.has(domain)) {
      const service = domain === 'scene' || domain === 'script' ? 'turn_on' : 'press';
      haptic('success');
      this.hass!.callService(domain, service, { entity_id: id });
    } else if (TOGGLES.has(domain)) {
      haptic('light');
      this.hass!.callService(domain === 'media_player' || domain === 'climate' ? domain : 'homeassistant', this.isOn(id) ? 'turn_off' : 'turn_on', {
        entity_id: id,
      });
    } else {
      openMoreInfo(this, id);
    }
  }

  private startHold(e: PointerEvent, id: string) {
    if (e.button !== 0) return;
    this.held = false;
    this.holdTimer = window.setTimeout(() => {
      this.held = true;
      openMoreInfo(this, id);
    }, HOLD_MS);
  }

  private cancelHold() {
    window.clearTimeout(this.holdTimer);
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      nav {
        display: flex;
        gap: var(--glass-space-chip);
        overflow-x: auto;
        scrollbar-width: none;
      }
      nav::-webkit-scrollbar {
        display: none;
      }
      button {
        all: unset;
        flex: none;
        box-sizing: border-box;
        height: 44px;
        padding: 0 18px;
        border-radius: 22px;
        border: 1px solid var(--glass-surface-border);
        background: rgba(var(--glass-surface-rgb), 0.7);
        font-size: var(--glass-text-body);
        display: flex;
        align-items: center;
        white-space: nowrap;
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      button.on {
        background: var(--glass-ink);
        border-color: var(--glass-ink);
        color: var(--glass-on-ink);
      }
      button:disabled {
        opacity: 0.5;
        cursor: default;
      }
      button:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      section {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 400;
      }
      /* Runs to the screen's edges, so the next tile peeks in and the row reads as one that scrolls sideways. */
      .tiles {
        display: flex;
        gap: 10px;
        margin: 0 calc(-1 * var(--glass-space-edge));
        padding: 0 var(--glass-space-edge);
        overflow-x: auto;
        scrollbar-width: none;
        scroll-snap-type: x mandatory;
        scroll-padding: 0 var(--glass-space-edge);
      }
      .tiles::-webkit-scrollbar {
        display: none;
      }
      button.tile {
        width: 104px;
        height: 120px;
        padding: 12px;
        border-radius: var(--glass-radius-small-tile);
        background: rgba(var(--glass-surface-rgb), 0.82);
        flex-direction: column;
        align-items: flex-start;
        justify-content: space-between;
        white-space: normal;
        scroll-snap-align: start;
      }
      .text {
        display: flex;
        flex-direction: column;
        line-height: 1.2;
      }
      .tile .name {
        font-size: var(--glass-text-body);
      }
      .tile .state {
        font-size: var(--glass-text-small);
        color: var(--glass-text-muted);
      }
      /* a light that's on: the light tile's colour, dark text in both themes */
      button.tile.lit {
        background: var(--glass-light-default);
        border-color: rgba(18, 19, 22, 0.06);
        color: #121316;
      }
      .tile.lit .state {
        color: rgba(18, 19, 22, 0.6);
      }
      button.tile.on {
        background: var(--glass-ink);
        border-color: var(--glass-ink);
        color: var(--glass-on-ink);
      }
      .tile.on .state {
        color: rgba(var(--glass-surface-rgb), 0.75);
      }
    `,
  ];
}

registerCard({
  type: 'glass-favourites',
  name: 'Glass · Favourites',
  description: 'Tiles (or a row of pills) for the lights, switches and scenes you use most.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-favourites': GlassFavourites;
  }
}

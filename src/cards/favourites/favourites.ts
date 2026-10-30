import { css, html, nothing, type PropertyValues } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, isUnavailable, openMoreInfo, registerCard } from '../../ha.js';
import { isLightOn } from '../../light-colour.js';
import { haptic } from '../../motion.js';
import './favourites-editor.js';

export interface FavouritesConfig extends LovelaceCardConfig {
  /** Lights, switches, scenes, scripts… in the order you want them. */
  entities: string[];
}

const TOGGLES = new Set(['light', 'switch', 'fan', 'input_boolean', 'media_player', 'climate']);
const ACTIONS = new Set(['scene', 'script', 'button', 'input_button']);
const HOLD_MS = 500;

/**
 * Home's favourites row: one chip per thing you reach for most, ink while
 * it's on, glass while off. Tap to switch it (or run a scene or script);
 * hold for HA's own controls. Scrolls sideways.
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
    `,
  ];
}

registerCard({
  type: 'glass-favourites',
  name: 'Glass · Favourites',
  description: 'A row of chips for the lights, switches and scenes you use most.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-favourites': GlassFavourites;
  }
}

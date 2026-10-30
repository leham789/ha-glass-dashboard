import { css, html, nothing, type PropertyValues } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, isUnavailable, openMoreInfo, registerCard } from '../../ha.js';
import { brightnessPct, groupMembers, isLightOn, lightLook } from '../../light-colour.js';
import type { IconName } from '../../icons.js';
import '../../elements/glass-icon.js';
import './light-tile-editor.js';

export interface LightTileConfig extends LovelaceCardConfig {
  entity: string;
  name?: string;
  icon?: IconName;
}

const HOLD_MS = 500;

/**
 * One light. Tap to toggle, hold for HA's more-info dialog (colour, brightness).
 * Colour follows the light colour rule in light-colour.ts.
 */
@customElement('glass-light-tile')
export class GlassLightTile extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: LightTileConfig;

  private holdTimer?: number;
  private held = false;

  static getConfigElement() {
    return document.createElement('glass-light-tile-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<LightTileConfig> {
    const firstLight = Object.keys(hass.states).find((id) => id.startsWith('light.'));
    return { entity: firstLight ?? '' };
  }

  setConfig(config: LightTileConfig): void {
    if (!config.entity) throw new Error('Choose a light');
    if (!config.entity.startsWith('light.')) throw new Error('The entity must be a light');
    this.config = config;
  }

  getCardSize(): number {
    return 3;
  }

  // Sections view: half the width of a section by default.
  getGridOptions() {
    return { columns: 6, min_columns: 3 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    ensureFonts();
  }

  // Only re-render when this light changes, not on every HA state update.
  protected shouldUpdate(changed: PropertyValues): boolean {
    if (changed.has('config') || !this.config) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    if (!old) return true;
    const id = this.config.entity;
    if (old.states[id] !== this.hass?.states[id]) return true;
    const members = groupMembers(this.hass?.states[id]) ?? [];
    return members.some((m) => old.states[m] !== this.hass?.states[m]);
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const entity = this.hass.states[this.config.entity];
    const offline = isUnavailable(entity);
    const on = isLightOn(entity, this.hass.states);
    const look = lightLook(entity, on);
    const name = this.config.name ?? entity?.attributes.friendly_name ?? this.config.entity;

    return html`
      <button
        type="button"
        class="tile ${on ? 'on' : 'off'}"
        style=${styleMap({ background: look.background, boxShadow: look.shadow })}
        ?disabled=${offline}
        aria-pressed=${on ? 'true' : 'false'}
        aria-label="${name}, ${this.stateText()}"
        @pointerdown=${this.onPointerDown}
        @pointerup=${this.cancelHold}
        @pointerleave=${this.cancelHold}
        @pointercancel=${this.cancelHold}
        @contextmenu=${(e: Event) => e.preventDefault()}
        @click=${this.onClick}
      >
        <span class="top">
          <span class="bulb"><glass-icon name=${this.config.icon ?? 'lightbulb'} size="19"></glass-icon></span>
          <span class="state">${this.stateText()}</span>
        </span>
        <span class="name">${name}</span>
      </button>
    `;
  }

  private stateText(): string {
    const entity = this.hass?.states[this.config!.entity];
    if (isUnavailable(entity)) return 'Offline';
    if (!isLightOn(entity, this.hass!.states)) return 'Off';
    const pct = brightnessPct(entity);
    const members = groupMembers(entity);
    if (members) {
      const onCount = members.filter((m) => this.hass!.states[m]?.state === 'on').length;
      return pct === undefined ? `${onCount} on` : `${onCount} on · ${pct}%`;
    }
    return pct === undefined ? 'On' : `${pct}%`;
  }

  private onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    this.held = false;
    this.holdTimer = window.setTimeout(() => {
      this.held = true;
      openMoreInfo(this, this.config!.entity);
    }, HOLD_MS);
  }

  private cancelHold() {
    window.clearTimeout(this.holdTimer);
  }

  private onClick() {
    // A hold already opened more-info; don't also toggle on release.
    if (this.held) {
      this.held = false;
      return;
    }
    // Not light.toggle: a group that says "on" with no lights on shows as off,
    // so tapping it must turn it on.
    const entity = this.hass?.states[this.config!.entity];
    const service = isLightOn(entity, this.hass!.states) ? 'turn_off' : 'turn_on';
    this.hass?.callService('light', service, { entity_id: this.config!.entity });
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
        height: 100%;
      }
      .tile {
        all: unset;
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        min-height: 132px;
        padding: var(--glass-space-tile);
        border-radius: var(--glass-radius-tile);
        border: 1px solid var(--glass-surface-border);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 12px;
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        transition: background 0.25s ease, box-shadow 0.25s ease, transform 0.1s ease;
      }
      .tile:not(.off) {
        color: #121316; /* lit tiles keep the bulb colour, so their text stays dark */
      }
      .tile.off {
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
      }
      .tile:active:not(:disabled) {
        transform: scale(0.98);
      }
      .tile:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      .tile:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .bulb {
        width: 40px;
        height: 40px;
        box-sizing: border-box;
        border-radius: 50%;
        border: 1px solid rgba(var(--glass-line-rgb), 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .off .bulb {
        border-color: rgba(var(--glass-line-rgb), 0.12);
      }
      .state {
        font-size: var(--glass-text-caption);
      }
      .name {
        font-size: var(--glass-text-tile-title);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ];
}

registerCard({
  type: 'glass-light-tile',
  name: 'Glass · Light tile',
  description: 'One light. Shows its real colour; tap to toggle, hold for more.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-light-tile': GlassLightTile;
  }
}

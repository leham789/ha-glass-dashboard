import '../../elements/glass-number.js';
import { css, html, nothing, type PropertyValues } from 'lit';
import { tileSurface } from '../../elements/surfaces.js';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, isUnavailable, openMoreInfo, registerCard } from '../../ha.js';
import type { IconName } from '../../icons.js';
import { formatValue } from '../../format.js';
import '../../elements/glass-icon.js';
import './stat-tiles-editor.js';

export interface StatTile {
  entity: string;
  /** Words under the number (default: the entity's name). */
  name?: string;
  /** A second sensor shown after the name, e.g. gas kWh next to gas cost. */
  secondary?: string;
  icon?: IconName;
  /** The dark tile, for the one that should stand out. */
  dark?: boolean;
}

export interface StatTilesConfig extends LovelaceCardConfig {
  tiles: StatTile[];
}

/**
 * Small number tiles, three across: a value people read at a glance
 * ("£1.36", "20.4p", "612") with what it is underneath.
 */
@customElement('glass-stat-tiles')
export class GlassStatTiles extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: StatTilesConfig;

  static getConfigElement() {
    return document.createElement('glass-stat-tiles-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<StatTilesConfig> {
    const sensors = Object.keys(hass.states).filter((id) => id.startsWith('sensor.')).slice(0, 3);
    return { tiles: sensors.map((entity) => ({ entity })) };
  }

  setConfig(config: StatTilesConfig): void {

    this.needs = undefined;
    if (!Array.isArray(config.tiles) || !config.tiles.length) return this.setUp(config, 'Add at least one tile');
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
    const ids = this.config.tiles.flatMap((t) => [t.entity, t.secondary]).filter(Boolean) as string[];
    return !old || ids.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  render() {
    if (this.needs) return this.renderSetup('gauge');
    if (!this.config || !this.hass) return nothing;
    return html`<section>
      ${this.config.tiles.map((t) => {
        const e = this.hass!.states[t.entity];
        if (!e) return nothing;
        // Unavailable: "Offline" on a half-strength tile, still in its place.
        const offline = isUnavailable(e);
        const { value, after } = offline ? { value: 'Offline', after: '' } : formatValue(e);
        const second = t.secondary ? this.hass!.states[t.secondary] : undefined;
        const label = [t.name ?? (after || e.attributes.friendly_name), second ? formatValue(second).value : '']
          .filter(Boolean)
          .join(' · ');
        return html`<button type="button" class="${t.dark ? 'dark' : ''} ${offline ? 'offline' : ''}" @click=${() => openMoreInfo(this, t.entity)}>
          ${t.icon ? html`<glass-icon name=${t.icon} size="20"></glass-icon>` : html`<span></span>`}
          <span class="info">
            <glass-number size="small" .value=${value}></glass-number>
            <span class="label">${label}</span>
          </span>
        </button>`;
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
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      button {
        ${tileSurface}
        all: unset;
        box-sizing: border-box;
        height: var(--glass-height-small-tile);
        padding: var(--glass-space-small-tile);
        border-radius: var(--glass-radius-small-tile);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-width: 0;
        cursor: pointer;
      }
      button.offline {
        opacity: 0.5;
      }
      button.dark {
        background: var(--glass-ink);
        border-color: var(--glass-ink);
        color: var(--glass-on-ink);
      }
      button:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      .info {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      glass-number {
        max-width: 100%;
        overflow: hidden;
      }
      .label {
        font-size: var(--glass-text-small);
        color: var(--glass-text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dark .label {
        color: color-mix(in srgb, var(--glass-on-ink) 75%, transparent);
      }
      /* Half width: 64-high rows, the icon on the left. */
      :host([narrow]) section {
        grid-template-columns: minmax(0, 1fr);
        gap: 8px;
      }
      :host([narrow]) button {
        height: 64px;
        flex-direction: row;
        justify-content: flex-start;
        align-items: center;
        gap: 12px;
      }
    `,
  ];
}

registerCard({
  type: 'glass-stat-tiles',
  name: 'Glass · Stat tiles',
  description: 'Small number tiles three across, e.g. gas cost, price per kWh, reward points.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-stat-tiles': GlassStatTiles;
  }
}

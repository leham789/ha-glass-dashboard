import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, openMoreInfo, registerCard } from '../../ha.js';
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
export class GlassStatTiles extends LitElement {
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
    if (!Array.isArray(config.tiles) || !config.tiles.length) throw new Error('Add at least one tile');
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
    const ids = this.config.tiles.flatMap((t) => [t.entity, t.secondary]).filter(Boolean) as string[];
    return !old || ids.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    return html`<section>
      ${this.config.tiles.map((t) => {
        const e = this.hass!.states[t.entity];
        if (!e) return nothing;
        const { value, after } = formatValue(e);
        const second = t.secondary ? this.hass!.states[t.secondary] : undefined;
        const label = [t.name ?? (after || e.attributes.friendly_name), second ? formatValue(second).value : '']
          .filter(Boolean)
          .join(' · ');
        return html`<button type="button" class=${t.dark ? 'dark' : ''} @click=${() => openMoreInfo(this, t.entity)}>
          ${t.icon ? html`<glass-icon name=${t.icon} size="20"></glass-icon>` : html`<span></span>`}
          <span class="info">
            <span class="value">${value}</span>
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
        gap: 10px;
      }
      button {
        all: unset;
        box-sizing: border-box;
        height: 120px;
        padding: 14px;
        border-radius: var(--glass-radius-small-tile);
        background: rgba(255, 255, 255, 0.78);
        border: 1px solid var(--glass-surface-border);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-width: 0;
        cursor: pointer;
      }
      button.dark {
        background: var(--glass-ink);
        border-color: var(--glass-ink);
        color: #fff;
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
      .value {
        font-size: 22px;
        font-weight: 300;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .label {
        font-size: var(--glass-text-small);
        color: var(--glass-text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dark .label {
        color: rgba(255, 255, 255, 0.75);
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

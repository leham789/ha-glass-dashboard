import { css, html, nothing, type PropertyValues } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, registerCard } from '../../ha.js';
import type { IconName } from '../../icons.js';
import { type TileStyle } from '../../elements/glass-tile.js';
import '../../elements/glass-tile.js';
import './light-tile-editor.js';

export interface LightTileConfig extends LovelaceCardConfig {
  entity: string;
  name?: string;
  icon?: IconName;
  /** tile (default), small or row. */
  style?: TileStyle;
  /** ring (default) or plain: the icon on its own. */
  icon_style?: 'ring' | 'plain';
}

/**
 * The Tile card (type glass-light-tile, kept so dashboards don't break): the
 * Tile part on its own, for any single thing. A light shows its real colour;
 * tap to toggle (or run a scene or script), hold for its pop-up. The tile
 * itself is glass-tile (src/elements/glass-tile.ts), which other cards nest.
 */
@customElement('glass-light-tile')
export class GlassLightTile extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: LightTileConfig;

  static getConfigElement() {
    return document.createElement('glass-light-tile-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<LightTileConfig> {
    const firstLight = Object.keys(hass.states).find((id) => id.startsWith('light.'));
    return { entity: firstLight ?? '' };
  }

  setConfig(config: LightTileConfig): void {
    this.needs = undefined;
    if (!config.entity) return this.setUp(config, 'Choose an entity');
    this.config = config;
  }

  getCardSize(): number {
    return this.config?.style === 'row' ? 1 : this.config?.style === 'small' ? 2 : 3;
  }

  // Sections view: half the width of a section by default.
  getGridOptions() {
    return { columns: 6, min_columns: 3 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    ensureFonts();
  }

  // A new hass alone goes straight to the tile, which redraws only if its own entity changed.
  protected shouldUpdate(changed: PropertyValues): boolean {
    const tile = this.renderRoot?.querySelector('glass-tile');
    if (tile && changed.has('hass') && changed.size === 1) {
      tile.hass = this.hass;
      return false;
    }
    return true;
  }

  render() {
    if (!this.config) return nothing;
    // Needs setting up and can't-find-it are drawn by the tile itself, tile-sized (Tile board).
    return html`<glass-tile
      .hass=${this.hass}
      entity=${this.needs ? '' : this.config.entity}
      name=${this.config.name ?? ''}
      .icon=${this.config.icon}
      tile-style=${this.config.style ?? 'tile'}
      icon-style=${this.config.icon_style ?? 'ring'}
    ></glass-tile>`;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
    `,
  ];
}

registerCard({
  type: 'glass-light-tile',
  name: 'Glass · Tile',
  description: 'One light, switch, scene or script. A light shows its real colour; tap to toggle or run, hold for more.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-light-tile': GlassLightTile;
  }
}

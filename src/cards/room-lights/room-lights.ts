import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, registerCard } from '../../ha.js';
import { roomSummary } from '../../rooms.js';
import type { GlassLightTile } from '../light-tile/light-tile.js';
import '../light-tile/light-tile.js';
import './room-lights-editor.js';

export interface RoomLightsConfig extends LovelaceCardConfig {
  area: string;
  exclude_entities?: string[];
  title?: string;
}

/**
 * Every light in a room as a light tile, two across, under a "Lights" heading.
 * Fills itself from the area, so new lights appear without editing the dashboard.
 */
@customElement('glass-room-lights')
export class GlassRoomLights extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: RoomLightsConfig;
  private tiles = new Map<string, GlassLightTile>();
  private watched: string[] = [];

  static getConfigElement() {
    return document.createElement('glass-room-lights-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<RoomLightsConfig> {
    return { area: Object.keys(hass.areas ?? {})[0] ?? '' };
  }

  setConfig(config: RoomLightsConfig): void {
    if (!config.area) throw new Error('Choose a room');
    this.config = config;
  }

  getCardSize(): number {
    return 6;
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
    if (!old || old.entities !== this.hass!.entities) return true;
    return this.watched.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const room = roomSummary(this.hass, this.config.area, this.config.exclude_entities);
    this.watched = room.watch;
    if (!room.lights.length) return nothing;
    return html`<section aria-labelledby="h">
      <h2 id="h">${this.config.title ?? 'Lights'} <span>tap to toggle, hold for colour</span></h2>
      <div class="grid">${room.lights.map((l) => this.tile(l.id))}</div>
    </section>`;
  }

  /** One light tile per light, kept between renders so each keeps its own state. */
  private tile(id: string): GlassLightTile {
    let tile = this.tiles.get(id);
    if (!tile) {
      tile = document.createElement('glass-light-tile');
      tile.setConfig({ type: 'custom:glass-light-tile', entity: id, name: undefined });
      this.tiles.set(id, tile);
    }
    tile.hass = this.hass;
    return tile;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      section {
        display: flex;
        flex-direction: column;
        gap: var(--glass-space-tile-gap);
      }
      h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 400;
      }
      h2 span {
        font-size: var(--glass-text-chip);
        color: var(--glass-text-muted);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: var(--glass-space-tile-gap);
      }
    `,
  ];
}

registerCard({
  type: 'glass-room-lights',
  name: 'Glass · Room lights',
  description: 'Every light in a room as a tile. New lights appear on their own.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-room-lights': GlassRoomLights;
  }
}

import { css, html, nothing, type PropertyValues } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, isUnavailable, registerCard } from '../../ha.js';
import { lightRow, lightRowStyles } from '../../elements/light-row.js';
import { roomSummary } from '../../rooms.js';
import { loadPrefs, onPrefsChange, prefs } from '../../prefs.js';
import type { GlassLightTile } from '../light-tile/light-tile.js';
import '../light-tile/light-tile.js';
import './room-lights-editor.js';

export interface RoomLightsConfig extends LovelaceCardConfig {
  area: string;
  exclude_entities?: string[];
  title?: string;
  /** Tiles two across (default), or rows inside a card for a room with a few lights. */
  layout?: 'tiles' | 'rows';
}

/**
 * Every light in a room as a light tile, two across, under a "Lights" heading,
 * with any offline light as one line underneath. Or, set to rows, every light
 * as a row inside a card. Fills itself from the area, so new lights appear
 * without editing the dashboard.
 */
@customElement('glass-room-lights')
export class GlassRoomLights extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: RoomLightsConfig;
  private tiles = new Map<string, GlassLightTile>();
  private watched: string[] = [];
  private stopPrefs?: () => void;

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
    this.stopPrefs = onPrefsChange(() => this.requestUpdate());
  }

  disconnectedCallback(): void {
    this.stopPrefs?.();
    super.disconnectedCallback();
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (this.hass) loadPrefs(this.hass);
    if (!changed.has('hass') || changed.size > 1 || !this.config) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    if (!old || old.entities !== this.hass!.entities) return true;
    return this.watched.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    // Leave out lights hidden here in the card or from Room options.
    const hidden = [...(this.config.exclude_entities ?? []), ...(prefs().hidden[this.config.area] ?? [])];
    const room = roomSummary(this.hass, this.config.area, hidden);
    this.watched = room.watch;
    if (!room.lights.length) return nothing;
    const title = this.config.title ?? 'Lights';
    if (this.config.layout === 'rows') {
      return html`<section class="card" aria-labelledby="h">
        <h2 id="h">${title}</h2>
        ${room.lights.map((l) => lightRow(this.hass!, l))}
      </section>`;
    }
    const offline = room.lights.filter((l) => isUnavailable(this.hass!.states[l.id]));
    const reachable = room.lights.filter((l) => !offline.includes(l));
    return html`<section aria-labelledby="h">
      <h2 id="h">${title} <span>tap to toggle, hold for colour</span></h2>
      ${reachable.length ? html`<div class="grid">${reachable.map((l) => this.tile(l.id))}</div>` : nothing}
      ${offline.length ? html`<span class="offline"><i></i>${offlineLine(offline.map((l) => l.name))}</span>` : nothing}
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
    lightRowStyles,
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
      .card {
        padding: var(--glass-space-edge);
        border-radius: var(--glass-radius-card);
        background: var(--glass-surface);
        border: 1px solid var(--glass-surface-border);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        gap: 12px;
      }
      .offline {
        font-size: var(--glass-text-caption);
        color: var(--glass-text-muted);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .offline i {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--glass-attention);
      }
    `,
  ];
}

/** "Ceiling Nook is offline", "Lamp and Strip are offline", "3 lights are offline". */
function offlineLine(names: string[]): string {
  if (names.length === 1) return `${names[0]} is offline`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are offline`;
  return `${names.length} lights are offline`;
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

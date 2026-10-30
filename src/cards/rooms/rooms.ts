import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type AreaRegistryEntry, type HomeAssistant, type LovelaceCardConfig, navigate, registerCard } from '../../ha.js';
import { roomSummary } from '../../rooms.js';
import { renderRoomTile, roomTileStyles, toggleRoomLights } from '../room-tile/room-tile.js';
import './rooms-editor.js';

export interface RoomsConfig extends LovelaceCardConfig {
  title?: string;
  exclude_areas?: string[];
  /** A view to open per room, with {area} replaced by the area id, e.g. "/glass/{area}". */
  room_path?: string;
}

interface FloorTab {
  id: string;
  label: string;
  areas: AreaRegistryEntry[];
}

const NO_FLOOR = '__none__';
const STORAGE_KEY = 'glass-rooms-floor';

/**
 * Home's Rooms section: every HA area as a room tile, grouped by HA floor
 * with a switcher. Nothing to set up; new areas and floors appear on their own.
 */
@customElement('glass-rooms')
export class GlassRooms extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: RoomsConfig;
  @state() private floor?: string = readStoredFloor();

  private watched: string[] = [];

  static getConfigElement() {
    return document.createElement('glass-rooms-editor');
  }

  static getStubConfig(): Partial<RoomsConfig> {
    return {};
  }

  setConfig(config: RoomsConfig): void {
    this.config = config;
  }

  getCardSize(): number {
    return 8;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    ensureFonts();
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (changed.has('config') || changed.has('floor') || !this.config) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    if (!old || !this.hass) return true;
    if (old.areas !== this.hass.areas || old.floors !== this.hass.floors || old.entities !== this.hass.entities) return true;
    return this.watched.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const hass = this.hass;
    const tabs = floorTabs(hass, this.config.exclude_areas ?? []);
    if (!tabs.length) return html`<p class="empty">No areas yet. Add some in Settings › Areas.</p>`;
    const current = tabs.find((t) => t.id === this.floor) ?? tabs[0];
    const rooms = current.areas.map((a) => roomSummary(hass, a.area_id));
    this.watched = rooms.flatMap((r) => r.watch);
    const path = this.config.room_path;

    return html`
      <div class="header">
        <h2>${this.config.title ?? 'Rooms'}</h2>
        ${tabs.length > 1
          ? html`<div class="floors" role="group" aria-label="Floor">
              ${tabs.map(
                (t) => html`<button
                  type="button"
                  class=${t === current ? 'current' : ''}
                  aria-pressed=${t === current ? 'true' : 'false'}
                  @click=${() => this.pickFloor(t.id)}
                >
                  ${t.label}
                </button>`,
              )}
            </div>`
          : nothing}
      </div>
      <div class="grid">
        ${rooms.map((room) =>
          renderRoomTile(room, {
            onOpen: path ? () => navigate(path.replace('{area}', room.areaId)) : undefined,
            onToggle: () => toggleRoomLights(hass, room),
          }),
        )}
      </div>
    `;
  }

  private pickFloor(id: string) {
    this.floor = id;
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Private browsing: the choice just isn't remembered.
    }
  }

  static styles = [
    tokens,
    roomTileStyles(),
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--glass-space-tile-gap);
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 400;
      }
      .floors {
        display: flex;
        gap: 4px;
        padding: 4px;
        border-radius: 22px;
        background: rgba(255, 255, 255, 0.6);
      }
      .floors button {
        all: unset;
        height: 36px;
        padding: 0 12px;
        border-radius: 18px;
        font-size: var(--glass-text-caption);
        display: flex;
        align-items: center;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .floors button.current {
        background: var(--glass-ink);
        color: #fff;
      }
      .floors button:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: var(--glass-space-tile-gap);
      }
      .empty {
        margin: 0;
        font-size: var(--glass-text-body);
        color: var(--glass-text-muted);
      }
    `,
  ];
}

/** HA floors in level order (lowest first), each with its areas; areas without a floor go last. */
function floorTabs(hass: HomeAssistant, exclude: string[]): FloorTab[] {
  const areas = Object.values(hass.areas ?? {}).filter((a) => !exclude.includes(a.area_id));
  const floors = Object.values(hass.floors ?? {}).sort(
    (a, b) => (a.level ?? Number.MAX_SAFE_INTEGER) - (b.level ?? Number.MAX_SAFE_INTEGER),
  );
  const tabs: FloorTab[] = floors.map((f) => ({
    id: f.floor_id,
    label: shortFloorName(f.name),
    areas: areas.filter((a) => a.floor_id === f.floor_id),
  }));
  const loose = areas.filter((a) => !a.floor_id || !hass.floors?.[a.floor_id]);
  if (loose.length) tabs.push({ id: NO_FLOOR, label: tabs.length ? 'Other' : 'All', areas: loose });
  return tabs.filter((t) => t.areas.length);
}

/** "Downstairs" → "Down", "Upstairs" → "Up", so three floors fit on a phone. */
function shortFloorName(name: string): string {
  return /^(up|down)stairs$/i.test(name) ? name.slice(0, -6) : name;
}

function readStoredFloor(): string | undefined {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

registerCard({
  type: 'glass-rooms',
  name: 'Glass · Rooms',
  description: 'Every area as a room tile, grouped by floor. Picks up new areas on its own.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-rooms': GlassRooms;
  }
}

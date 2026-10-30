import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, navigate, registerCard } from '../../ha.js';
import { type RoomSummary, roomSummary } from '../../rooms.js';
import '../../elements/glass-icon.js';
import './room-tile-editor.js';

export interface RoomTileConfig extends LovelaceCardConfig {
  area: string;
  name?: string;
  navigation_path?: string;
  exclude_entities?: string[];
}

/**
 * One HA area: its lights (a dot each, "4 of 6"), one line of context, and a
 * bulb button that switches all its lights. Tapping the tile opens the room.
 */
@customElement('glass-room-tile')
export class GlassRoomTile extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: RoomTileConfig;

  // Entities the last render used, so unrelated HA updates don't re-render.
  private watched: string[] = [];

  static getConfigElement() {
    return document.createElement('glass-room-tile-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<RoomTileConfig> {
    return { area: Object.keys(hass.areas ?? {})[0] ?? '' };
  }

  setConfig(config: RoomTileConfig): void {
    if (!config.area) throw new Error('Choose an area');
    this.config = config;
  }

  getCardSize(): number {
    return 4;
  }

  getGridOptions() {
    return { columns: 6, min_columns: 4 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    ensureFonts();
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (changed.has('config') || !this.config) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    if (!old || !this.hass) return true;
    if (old.areas !== this.hass.areas || old.entities !== this.hass.entities) return true;
    return this.watched.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const room = roomSummary(this.hass, this.config.area, this.config.exclude_entities);
    this.watched = room.watch;
    return renderRoomTile(room, {
      name: this.config.name,
      onOpen: this.config.navigation_path ? () => navigate(this.config!.navigation_path!) : undefined,
      onToggle: () => toggleRoomLights(this.hass!, room),
    });
  }

  static styles = [tokens, roomTileStyles()];
}

/** Turns all of a room's lights off if any are on, otherwise all on. */
export function toggleRoomLights(hass: HomeAssistant, room: RoomSummary): void {
  const reachable = room.lights.filter((l) => hass.states[l.id]?.state !== 'unavailable').map((l) => l.id);
  if (!reachable.length) return;
  hass.callService('light', room.onCount ? 'turn_off' : 'turn_on', { entity_id: reachable });
}

/** The tile itself, shared with the Rooms card. */
export function renderRoomTile(
  room: RoomSummary,
  opts: { name?: string; onOpen?: () => void; onToggle: () => void },
) {
  const name = opts.name ?? room.name;
  const total = room.lights.length;
  const lit = room.onCount > 0;
  const onText = total === 0 ? '' : lit ? `${room.onCount} of ${total}` : 'Off';
  const extra = total === 0 ? 'No lights yet' : lightList(room.lights.map((l) => l.name));
  const surface = room.alert ? 'alert' : lit ? 'lit' : 'off';

  return html`
    <div class="room ${surface}">
      ${opts.onOpen
        ? html`<button type="button" class="open" aria-label="Open ${name}" @click=${opts.onOpen}></button>`
        : nothing}
      <span class="head">
        <span class="title"><span class="name">${name}</span><span class="count">${onText}</span></span>
        <span class="meta">${room.meta}</span>
      </span>
      <span class="dots" aria-hidden="true">
        ${room.lights.map((l) => html`<span class="dot ${l.on ? 'on' : ''}"></span>`)}
        <span class="rule"></span>
      </span>
      <span class="foot">
        <button
          type="button"
          class="bulb ${lit ? 'on' : ''}"
          ?disabled=${total === 0}
          aria-pressed=${lit ? 'true' : 'false'}
          aria-label="${lit ? 'Turn off' : 'Turn on'} ${name} lights"
          @click=${opts.onToggle}
        >
          <glass-icon name="lightbulb" size="20"></glass-icon>
        </button>
        <span class="extra">${extra}</span>
      </span>
    </div>
  `;
}

/** "Ambient, TV Strip, Tree" or, for more than three, "Ambient, TV Strip +3". */
function lightList(names: string[]): string {
  return names.length <= 3 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

export function roomTileStyles() {
  return css`
    :host {
      display: block;
      height: 100%;
    }
    .room {
      position: relative;
      box-sizing: border-box;
      height: 100%;
      min-height: 176px;
      padding: var(--glass-space-tile);
      border-radius: var(--glass-radius-tile);
      border: 1px solid rgba(255, 255, 255, 0.9);
      box-shadow: var(--glass-tile-shadow);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 12px;
      transition: background 0.25s ease;
    }
    .room.lit {
      background: var(--glass-room-lit);
    }
    .room.off {
      background: var(--glass-room-off);
    }
    .room.alert {
      background: var(--glass-room-alert);
    }
    .open {
      all: unset;
      position: absolute;
      inset: 0;
      border-radius: inherit;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .open:focus-visible {
      outline: 2px solid var(--glass-ink);
      outline-offset: 2px;
    }
    .head,
    .dots,
    .extra {
      pointer-events: none;
    }
    .head {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .title {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 6px;
    }
    .name {
      font-size: var(--glass-text-tile-title);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .count {
      font-size: var(--glass-text-caption);
      color: var(--glass-text-secondary);
      white-space: nowrap;
    }
    .meta {
      font-size: var(--glass-text-caption);
      color: var(--glass-text-muted);
      min-height: 1.2em;
    }
    .alert .meta {
      color: var(--glass-attention-text);
    }
    .dots {
      display: flex;
      gap: 6px;
      align-items: center;
      min-height: 8px;
    }
    .dot {
      width: 8px;
      height: 8px;
      flex: none;
      border-radius: 50%;
      background: rgba(18, 19, 22, 0.15);
    }
    .dot.on {
      background: var(--glass-ink);
    }
    .rule {
      flex: 1;
      border-top: 1px dashed rgba(18, 19, 22, 0.18);
      margin-left: 4px;
    }
    .foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
    }
    .bulb {
      all: unset;
      position: relative;
      z-index: 1;
      box-sizing: border-box;
      width: 44px;
      height: 44px;
      flex: none;
      border-radius: 50%;
      border: 1px solid rgba(18, 19, 22, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--glass-ink);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: background 0.2s ease;
    }
    .bulb.on {
      background: var(--glass-accent);
    }
    .bulb:focus-visible {
      outline: 2px solid var(--glass-ink);
      outline-offset: 2px;
    }
    .bulb:disabled {
      opacity: 0.4;
      cursor: default;
    }
    .extra {
      font-size: var(--glass-text-small);
      color: var(--glass-text-secondary);
      text-align: right;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `;
}

registerCard({
  type: 'glass-room-tile',
  name: 'Glass · Room tile',
  description: 'One area: its lights, climate or doors, and a button for all its lights.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-room-tile': GlassRoomTile;
  }
}

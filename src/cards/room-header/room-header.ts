import { css, html, nothing, type PropertyValues } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, navigate, registerCard } from '../../ha.js';
import { areaEntityIds, roomSummary, shortName } from '../../rooms.js';
import { loadPrefs, onPrefsChange, prefs } from '../../prefs.js';
import { clock } from '../../time.js';
import { GlassSheet } from '../../elements/glass-sheet.js';
import type { GlassRoomOptionsSheet } from '../../sheets/room-options-sheet.js';
import '../../sheets/room-options-sheet.js';
import '../../elements/glass-icon.js';
import './room-header-editor.js';

export interface RoomHeaderConfig extends LovelaceCardConfig {
  /** This screen's room. */
  area: string;
  /** Each room's view, {area} = area id, e.g. "/glass/{area}". */
  room_path: string;
  /** Rooms first in the switcher, in this order; the rest follow in HA's order. */
  pinned?: string[];
  exclude_areas?: string[];
}

/**
 * The top of a room screen: a full-width switcher of every room (pinned
 * first, scrolls sideways, fades at the edge), then the room's name over a
 * big "4/6 on", with its climate and a status line on the right: what's
 * playing, else "Coldest room" or "Warmest room", else when a remote was last used.
 */
@customElement('glass-room-header')
export class GlassRoomHeader extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: RoomHeaderConfig;
  private watched: string[] = [];
  private sheet?: GlassSheet;
  private stopPrefs?: () => void;

  static getConfigElement() {
    return document.createElement('glass-room-header-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<RoomHeaderConfig> {
    const base = location.pathname.split('/')[1] ?? 'lovelace';
    return { area: Object.keys(hass.areas ?? {})[0] ?? '', room_path: `/${base}/{area}` };
  }

  setConfig(config: RoomHeaderConfig): void {
    if (!config.area) throw new Error('Choose this screen’s room');
    if (!config.room_path) throw new Error('Set the room view path, e.g. /glass/{area}');
    this.config = config;
  }

  getCardSize(): number {
    return 4;
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
    this.sheet?.close();
    super.disconnectedCallback();
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (this.hass) loadPrefs(this.hass);
    // Keep an open Room options sheet current.
    if (this.sheet?.isConnected && this.hass) this.sheet.hass = this.hass;
    if (!changed.has('hass') || changed.size > 1 || !this.config) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    if (!old || old.areas !== this.hass!.areas) return true;
    return this.watched.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  protected updated(changed: PropertyValues): void {
    // Bring the current room into view in the switcher.
    // (Scrolls only the switcher, never the page.)
    if (changed.has('config')) {
      const nav = this.renderRoot.querySelector<HTMLElement>('nav');
      const current = this.renderRoot.querySelector<HTMLElement>('[aria-current="page"]');
      if (nav && current) nav.scrollLeft = current.offsetLeft - nav.clientWidth / 2 + current.offsetWidth / 2;
    }
  }

  private rooms() {
    const c = this.config!;
    const exclude = c.exclude_areas ?? [];
    const all = Object.values(this.hass!.areas ?? {}).filter((a) => !exclude.includes(a.area_id));
    // Pinned in the card first, then rooms pinned from Room options.
    const order = [...new Set([...(c.pinned ?? []), ...prefs().pinned])];
    const pinned = order.map((id) => all.find((a) => a.area_id === id)).filter((a) => !!a);
    return [...pinned, ...all.filter((a) => !pinned.includes(a))];
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const hass = this.hass;
    // Lights hidden in Room options don't count on the room screen.
    const room = roomSummary(hass, this.config.area, prefs().hidden[this.config.area]);
    const extremes = this.extremes();
    const playing = this.mediaLine() || extremes.line || this.remoteLine();
    this.watched = [...room.watch, ...extremes.watch];

    const climate = [
      room.temperature !== undefined ? `${room.temperature.toFixed(1)}°` : '',
      room.humidity !== undefined ? `${Math.round(room.humidity)}%` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    return html`
      <nav aria-label="Rooms">
        ${this.rooms().map((a) => {
          const current = a.area_id === this.config!.area;
          return html`<a
            href=${this.config!.room_path.replace('{area}', a.area_id)}
            aria-current=${current ? 'page' : 'false'}
            @click=${(e: Event) => this.go(e, a.area_id)}
          >
            ${a.name}
          </a>`;
        })}
      </nav>
      <section aria-label="Room summary">
        <span class="left">
          <button type="button" class="name" aria-label="${room.name} options" @click=${() => this.openOptions()}>
            ${room.name}<glass-icon name="chevron-down" size="14" stroke="1.8"></glass-icon>
          </button>
          ${room.lights.length
            ? html`<span class="big"><span class="n">${room.onCount}</span><span class="of">/${room.lights.length} on</span></span>`
            : html`<span class="big"><span class="n none">No lights</span></span>`}
        </span>
        <span class="right">
          ${climate ? html`<span class="climate">${climate}</span>` : nothing}
          ${playing ? html`<span class="status">${playing}</span>` : nothing}
        </span>
      </section>
    `;
  }

  /** "Coldest room" or "Warmest room", when at least three rooms have a temperature. */
  private extremes(): { line: string; watch: string[] } {
    const hass = this.hass!;
    const rooms = Object.keys(hass.areas ?? {})
      .map((id) => ({ id, s: roomSummary(hass, id) }))
      .filter((r) => r.s.temperature !== undefined);
    const watch = rooms.flatMap((r) => r.s.watch.filter((id) => hass.states[id]?.attributes.device_class === 'temperature'));
    if (rooms.length < 3) return { line: '', watch };
    const sorted = [...rooms].sort((a, b) => a.s.temperature! - b.s.temperature!);
    const here = this.config!.area;
    const line = sorted[0].id === here ? 'Coldest room' : sorted[sorted.length - 1].id === here ? 'Warmest room' : '';
    return { line, watch };
  }

  /** "Remote used 01:37": the last press today of a button or remote in the room (its event entity). */
  private remoteLine(): string {
    const hass = this.hass!;
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const last = areaEntityIds(hass, this.config!.area)
      .filter((id) => id.startsWith('event.') && hass.states[id]?.attributes.device_class === 'button')
      .map((id) => Date.parse(hass.states[id].state))
      .filter((t) => t >= midnight.getTime())
      .sort((a, b) => b - a)[0];
    return last ? `Remote used ${clock(new Date(last).toISOString())}` : '';
  }

  /** "TV on · Apple TV playing" from the room's media players. */
  private mediaLine(): string {
    const hass = this.hass!;
    const area = hass.areas?.[this.config!.area];
    return areaEntityIds(hass, this.config!.area)
      .filter((id) => id.startsWith('media_player.'))
      .map((id) => hass.states[id])
      .filter((e) => ['on', 'playing', 'paused'].includes(e.state))
      .map((e) => `${shortName(e, area?.name ?? '')} ${e.state}`)
      .join(' · ');
  }

  private openOptions() {
    if (this.sheet?.isConnected) return;
    const sheet = GlassSheet.open<GlassRoomOptionsSheet>('glass-room-options-sheet', this.hass!);
    sheet.area = this.config!.area;
    this.sheet = sheet;
  }

  private go(e: Event, areaId: string) {
    e.preventDefault();
    if (areaId !== this.config!.area) navigate(this.config!.room_path.replace('{area}', areaId));
  }

  static styles = [
    tokens,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      nav {
        position: relative;
        display: flex;
        gap: 4px;
        padding: 4px;
        border-radius: 24px;
        border: 1px solid var(--glass-surface-border);
        background: rgba(var(--glass-surface-rgb), 0.6);
        overflow-x: auto;
        scrollbar-width: none;
        -webkit-mask-image: linear-gradient(90deg, #000 80%, transparent 100%);
        mask-image: linear-gradient(90deg, #000 80%, transparent 100%);
      }
      nav::-webkit-scrollbar {
        display: none;
      }
      a {
        flex: none;
        height: 38px;
        padding: 0 14px;
        border-radius: 19px;
        display: flex;
        align-items: center;
        white-space: nowrap;
        font-size: var(--glass-text-chip);
        color: var(--glass-ink);
        text-decoration: none;
        -webkit-tap-highlight-color: transparent;
      }
      a[aria-current='page'] {
        background: var(--glass-ink);
        color: var(--glass-on-ink);
      }
      a:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: -2px;
      }
      section {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px;
      }
      .left,
      .right {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .right {
        align-items: flex-end;
        gap: 6px;
        padding-bottom: 8px;
        text-align: right;
      }
      .name {
        all: unset;
        align-self: flex-start;
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: var(--glass-text-body);
        color: var(--glass-text-muted);
        cursor: pointer;
      }
      .name:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
        border-radius: 4px;
      }
      .big {
        display: flex;
        align-items: baseline;
        line-height: 0.9;
      }
      .n {
        font-size: 104px;
        font-weight: 200;
        letter-spacing: -4px;
      }
      .n.none {
        font-size: 32px;
        letter-spacing: 0;
      }
      .of {
        font-size: 32px;
        font-weight: 200;
        color: var(--glass-text-muted);
      }
      .climate {
        font-size: var(--glass-text-body);
      }
      .status {
        font-size: var(--glass-text-caption);
        color: var(--glass-text-muted);
      }
    `,
  ];
}

registerCard({
  type: 'glass-room-header',
  name: 'Glass · Room header',
  description: 'Room switcher, then the room’s lights on, climate and what’s playing.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-room-header': GlassRoomHeader;
  }
}

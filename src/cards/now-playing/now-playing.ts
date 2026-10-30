import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import {
  type HassEntity,
  type HomeAssistant,
  type LovelaceCardConfig,
  navigate,
  openMoreInfo,
  registerCard,
  reportVisibility,
} from '../../ha.js';
import { areaOf, shortName } from '../../rooms.js';
import '../../elements/glass-icon.js';
import './now-playing-editor.js';

export interface NowPlayingConfig extends LovelaceCardConfig {
  /** Players to watch. Default: every media player. */
  entities?: string[];
  /** A view to open on tap, {area} = the player's area id, e.g. "/glass/{area}". */
  room_path?: string;
}

/**
 * Shows only while something is playing or paused, and then the most recent
 * player: artwork, where it's playing, the title, progress, and play/pause.
 * Tap the card to open the player's room (or HA's player controls).
 */
@customElement('glass-now-playing')
export class GlassNowPlaying extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: NowPlayingConfig;
  @state() private tick = 0;
  private timer?: number;

  static getConfigElement() {
    return document.createElement('glass-now-playing-editor');
  }

  static getStubConfig(): Partial<NowPlayingConfig> {
    return {};
  }

  setConfig(config: NowPlayingConfig): void {
    this.config = config;
  }

  getCardSize(): number {
    return this.player() ? 2 : 0;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    ensureFonts();
    // Move the progress bar along between HA's position updates.
    this.timer = window.setInterval(() => {
      if (this.player()?.state === 'playing') this.tick++;
    }, 1000);
  }

  disconnectedCallback(): void {
    window.clearInterval(this.timer);
    super.disconnectedCallback();
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has('hass') || changed.size > 1 || !this.config) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    return !old || this.candidates().some((id) => old.states[id] !== this.hass!.states[id]);
  }

  protected updated(): void {
    reportVisibility(this, !!this.player());
  }

  private candidates(): string[] {
    if (!this.hass) return [];
    return this.config?.entities?.length
      ? this.config.entities
      : Object.keys(this.hass.states).filter((id) => id.startsWith('media_player.'));
  }

  /** The most recently changed player that's playing or paused (playing wins a tie). */
  private player(): HassEntity | undefined {
    return this.candidates()
      .map((id) => this.hass!.states[id])
      .filter((e) => e && (e.state === 'playing' || e.state === 'paused'))
      .sort(
        (a, b) =>
          Number(b.state === 'playing') - Number(a.state === 'playing') ||
          Date.parse(b.last_changed) - Date.parse(a.last_changed),
      )[0];
  }

  render() {
    const p = this.player();
    if (!p) return nothing;
    const a = p.attributes;
    const areaId = areaOf(this.hass!, p.entity_id);
    const areaName = areaId ? this.hass!.areas?.[areaId]?.name : undefined;
    const where = [shortName(p, areaName ?? ''), a.app_name ?? a.source, areaName].filter(Boolean);
    // A player named after its app or room would repeat itself; show each part once.
    const context = [...new Set(where)].join(' · ');
    const title = a.media_title ?? a.friendly_name ?? p.entity_id;
    const artist = a.media_artist ?? a.media_series_title;
    const playing = p.state === 'playing';
    const progress = progressOf(p);

    return html`
      <section class="card" aria-label="Now playing">
        <button type="button" class="open" aria-label="Open ${areaName ?? title}" @click=${() => this.open(p, areaId)}></button>
        <span
          class="art"
          style=${a.entity_picture ? `background-image: url("${a.entity_picture}")` : ''}
          aria-hidden="true"
        >
          ${a.entity_picture ? nothing : html`<glass-icon name="music" size="22"></glass-icon>`}
        </span>
        <span class="info">
          <span class="context">${context}</span>
          <span class="title">${title}${artist ? html`<span class="artist"> · ${artist}</span>` : nothing}</span>
          ${progress === undefined
            ? nothing
            : html`<span class="bar" aria-hidden="true"><span style="width: ${progress * 100}%"></span></span>`}
        </span>
        <button
          type="button"
          class="play"
          aria-label=${playing ? 'Pause' : 'Play'}
          @click=${() => this.hass!.callService('media_player', 'media_play_pause', { entity_id: p.entity_id })}
        >
          <glass-icon name=${playing ? 'pause' : 'play'} size="18" stroke="2" solid></glass-icon>
        </button>
      </section>
    `;
  }

  private open(p: HassEntity, areaId?: string) {
    const path = this.config?.room_path;
    if (path && areaId) navigate(path.replace('{area}', areaId));
    else openMoreInfo(this, p.entity_id);
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      :host([hidden]) {
        display: none;
      }
      .card {
        position: relative;
        box-sizing: border-box;
        padding: 14px;
        border-radius: var(--glass-radius-card);
        background: rgba(255, 255, 255, 0.6);
        border: 1px solid var(--glass-surface-border);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .open {
        all: unset;
        position: absolute;
        inset: 0;
        border-radius: inherit;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .open:focus-visible,
      .play:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      .art,
      .info {
        pointer-events: none;
      }
      .art {
        width: 64px;
        height: 64px;
        flex: none;
        border-radius: var(--glass-radius-inset);
        background: linear-gradient(135deg, #2a2d33, #4a4e57) center / cover;
        color: rgba(255, 255, 255, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .context {
        font-size: var(--glass-text-small);
        color: var(--glass-text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .title {
        font-size: var(--glass-text-tile-title);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .artist {
        color: var(--glass-text-muted);
      }
      .bar {
        position: relative;
        height: 3px;
        margin-top: 6px;
        border-radius: 2px;
        background: rgba(18, 19, 22, 0.12);
      }
      .bar > span {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        border-radius: 2px;
        background: var(--glass-ink);
      }
      .play {
        all: unset;
        position: relative;
        width: 52px;
        height: 52px;
        flex: none;
        border-radius: 50%;
        background: var(--glass-ink);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
    `,
  ];
}

/** 0–1 through the track, moving on from HA's last reported position while playing. */
function progressOf(p: HassEntity): number | undefined {
  const { media_duration: duration, media_position: position, media_position_updated_at: at } = p.attributes;
  if (typeof duration !== 'number' || duration <= 0 || typeof position !== 'number') return undefined;
  const elapsed = p.state === 'playing' && at ? (Date.now() - Date.parse(at)) / 1000 : 0;
  return Math.min(1, Math.max(0, (position + elapsed) / duration));
}

registerCard({
  type: 'glass-now-playing',
  name: 'Glass · Now playing',
  description: 'Shows the latest player only while something is playing or paused.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-now-playing': GlassNowPlaying;
  }
}

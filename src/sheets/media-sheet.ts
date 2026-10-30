import { css, html, nothing, type CSSResultGroup } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { GlassEntitySheet } from './entity-sheet.js';
import type { HassEntity } from '../ha.js';
import type { IconName } from '../icons.js';

// media_player supported_features bits
const SEEK = 2;
const VOLUME_SET = 4;
const VOLUME_MUTE = 8;
const PREVIOUS = 16;
const NEXT = 32;
const SELECT_SOURCE = 2048;
const SHUFFLE = 32768;
const REPEAT = 262144;

/**
 * Replaces HA's media player pop-up: artwork, what's playing, a seek bar, the
 * transport (shuffle · previous · play / pause · next · repeat), volume and the
 * speakers it can play on. Each control only shows when the player supports
 * it, so a TV gets just previous, play / pause, next and volume.
 */
@customElement('glass-media-sheet')
export class GlassMediaSheet extends GlassEntitySheet {
  @state() private draft: { pos?: number; vol?: number } = {};
  @state() private tick = 0;
  private timer?: number;

  connectedCallback(): void {
    super.connectedCallback();
    // The seek bar moves on its own while playing.
    this.timer = window.setInterval(() => this.entity?.state === 'playing' && this.tick++, 1000);
  }

  disconnectedCallback(): void {
    window.clearInterval(this.timer);
    super.disconnectedCallback();
  }

  protected iconFor(): IconName {
    return 'music';
  }

  protected iconBgFor(): string {
    return '#9CC3F2';
  }

  protected get sheetSubtitle(): string {
    const a = this.entity?.attributes;
    return [a?.app_name, a?.source].filter(Boolean).join(' · ') || super.sheetSubtitle;
  }

  private call(service: string, data: Record<string, unknown> = {}) {
    this.hass!.callService('media_player', service, { entity_id: this.entityId, ...data });
  }

  /** Where playback is now, in seconds, counting on from HA's last report. */
  private position(e: HassEntity): number {
    const a = e.attributes;
    const pos = Number(a.media_position) || 0;
    if (e.state !== 'playing' || !a.media_position_updated_at) return pos;
    return Math.min(Number(a.media_duration) || Infinity, pos + (Date.now() - Date.parse(a.media_position_updated_at)) / 1000);
  }

  protected renderBody() {
    void this.tick;
    const e = this.entity;
    if (!e) return html``;
    const a = e.attributes;
    const f: number = a.supported_features ?? 0;
    const off = this.unavailable;
    const idle = !off && !['playing', 'paused', 'buffering'].includes(e.state);
    const playing = e.state === 'playing';
    const dur = Number(a.media_duration) || 0;
    const pos = this.draft.pos ?? this.position(e);
    const vol = this.draft.vol ?? Math.round((Number(a.volume_level) || 0) * 100);
    const muted = !!a.is_volume_muted;
    const sources: string[] = f & SELECT_SOURCE && Array.isArray(a.source_list) ? a.source_list : [];
    const art: string | undefined = a.entity_picture;
    const title = off ? this.sheetTitle : idle ? 'Nothing playing' : (a.media_title ?? this.sheetTitle);
    const artist = off ? this.sinceLine() : idle ? (sources.length ? 'Pick a speaker below to start' : '') : (a.media_artist ?? a.media_series_title ?? '');

    return html`
      <div class="art ${art && !off && !idle ? '' : 'empty'}" style=${art && !off && !idle ? `background-image: url("${art}")` : ''}>
        ${art && !off && !idle ? nothing : html`<glass-icon name="music" size="48" stroke="1.2"></glass-icon>`}
      </div>

      <div class="now">
        <span class="what">
          <span class="track-title">${title}</span>
          ${artist ? html`<span class="artist">${artist}</span>` : nothing}
        </span>
        ${off || idle ? this.renderPill(off ? 'Unavailable' : 'Idle', 'neutral') : nothing}
      </div>

      ${f & SEEK && dur && !off && !idle
        ? html`<div class="seek">
            <span class="track">
              <span class="done" style="width: ${(pos / dur) * 100}%"></span>
              <span class="knob" style="left: ${(pos / dur) * 100}%"></span>
              <input
                type="range"
                min="0"
                max=${dur}
                .value=${String(Math.round(pos))}
                aria-label="Position"
                @input=${(ev: Event) => (this.draft = { ...this.draft, pos: Number((ev.target as HTMLInputElement).value) })}
                @change=${(ev: Event) => {
                  this.call('media_seek', { seek_position: Number((ev.target as HTMLInputElement).value) });
                  this.draft = { ...this.draft, pos: undefined };
                }}
              />
            </span>
            <span class="times"><span>${mmss(pos)}</span><span>${mmss(dur)}</span></span>
          </div>`
        : nothing}

      <div class="transport ${f & (SHUFFLE | REPEAT) ? 'full' : ''} ${off ? 'off' : ''}">
        ${f & SHUFFLE
          ? html`<button type="button" class="mode ${a.shuffle ? 'on' : ''}" aria-label="Shuffle" aria-pressed=${a.shuffle ? 'true' : 'false'} @click=${() => this.call('shuffle_set', { shuffle: !a.shuffle })}>
              <glass-icon name="shuffle" size="18" stroke="1.8"></glass-icon>
            </button>`
          : nothing}
        ${f & PREVIOUS
          ? html`<button type="button" class="step" aria-label="Previous" @click=${() => this.call('media_previous_track')}>
              <glass-icon name="skip-back" size="18" stroke="2" solid></glass-icon>
            </button>`
          : nothing}
        <button type="button" class="play" aria-label=${playing ? 'Pause' : 'Play'} @click=${() => this.call('media_play_pause')}>
          <glass-icon name=${playing ? 'pause' : 'play'} size="22" stroke="2" solid></glass-icon>
        </button>
        ${f & NEXT
          ? html`<button type="button" class="step" aria-label="Next" @click=${() => this.call('media_next_track')}>
              <glass-icon name="skip-forward" size="18" stroke="2" solid></glass-icon>
            </button>`
          : nothing}
        ${f & REPEAT
          ? html`<button
              type="button"
              class="mode ${a.repeat && a.repeat !== 'off' ? 'on' : ''}"
              aria-label="Repeat ${a.repeat ?? 'off'}"
              @click=${() => this.call('repeat_set', { repeat: a.repeat === 'off' || !a.repeat ? 'all' : a.repeat === 'all' ? 'one' : 'off' })}
            >
              <glass-icon name=${a.repeat === 'one' ? 'repeat-1' : 'repeat'} size="18" stroke="1.8"></glass-icon>
            </button>`
          : nothing}
      </div>

      ${f & VOLUME_SET
        ? html`<div class="volume ${off ? 'off' : ''}">
            <label class="row-label"><span>Volume</span><span class="dim">${muted ? 'Muted' : `${vol}%`}</span></label>
            <span class="vbar">
              <span class="vfill" style="width: ${muted ? 0 : vol}%"></span>
              <input
                type="range"
                min="0"
                max="100"
                .value=${String(vol)}
                aria-label="Volume"
                @input=${(ev: Event) => (this.draft = { ...this.draft, vol: Number((ev.target as HTMLInputElement).value) })}
                @change=${(ev: Event) => {
                  this.call('volume_set', { volume_level: Number((ev.target as HTMLInputElement).value) / 100 });
                  this.draft = { ...this.draft, vol: undefined };
                }}
              />
              ${f & VOLUME_MUTE
                ? html`<button type="button" class="mute" aria-label=${muted ? 'Unmute' : 'Mute'} @click=${() => this.call('volume_mute', { is_volume_muted: !muted })}>
                    <glass-icon name=${muted ? 'volume-x' : 'volume-2'} size="22"></glass-icon>
                  </button>`
                : html`<span class="mute"><glass-icon name="volume-2" size="22"></glass-icon></span>`}
            </span>
          </div>`
        : nothing}

      ${sources.length
        ? html`<div class="section ${off ? 'faded' : ''}">
            <h2>Play on</h2>
            ${this.renderChips(sources, a.source, (s) => this.call('select_source', { source: s }))}
          </div>`
        : nothing}
    `;
  }

  static styles: CSSResultGroup = [
    GlassEntitySheet.styles,
    css`
      .art {
        aspect-ratio: 1;
        border-radius: var(--glass-radius-tile);
        background: var(--glass-media, linear-gradient(150deg, #2a2d33 0%, #3b4a6b 55%, #9cc3f2 100%)) center / cover;
        box-shadow: 0 20px 50px rgba(40, 60, 110, 0.22);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .art.empty {
        background: var(--glass-neutral-tint);
        box-shadow: none;
        color: var(--glass-text-muted);
      }
      .now {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      .what {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .track-title {
        font-size: 28px;
        letter-spacing: -0.4px;
        line-height: 1.1;
      }
      .artist {
        font-size: var(--glass-text-body);
        color: var(--glass-text-muted);
      }
      .now .pill {
        margin: 2px 0 0;
      }
      .seek {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: -6px;
      }
      .track {
        position: relative;
        height: 24px;
      }
      .track::before,
      .done {
        content: '';
        position: absolute;
        left: 0;
        top: 10px;
        height: 4px;
        border-radius: 2px;
      }
      .track::before {
        right: 0;
        background: rgba(var(--glass-line-rgb), 0.12);
      }
      .done {
        background: var(--glass-ink);
      }
      .knob {
        position: absolute;
        top: 4px;
        width: 16px;
        height: 16px;
        margin-left: -8px;
        border-radius: 50%;
        background: var(--glass-ink);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
      }
      .times {
        display: flex;
        justify-content: space-between;
        font-size: var(--glass-text-small);
        color: var(--glass-text-muted);
      }
      input[type='range'] {
        -webkit-appearance: none;
        appearance: none;
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        background: transparent;
        cursor: ew-resize;
      }
      input[type='range']::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 24px;
        height: 64px;
        background: transparent;
      }
      .transport {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
      }
      .transport.full {
        justify-content: space-between;
      }
      .transport button {
        all: unset;
        box-sizing: border-box;
        flex: none;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .transport .mode {
        width: 44px;
        height: 44px;
      }
      .transport .mode.on {
        background: var(--glass-ink);
        color: var(--glass-on-ink);
      }
      .transport .step {
        width: 52px;
        height: 52px;
        background: var(--glass-solid);
        border: 1px solid rgba(var(--glass-line-rgb), 0.12);
      }
      .transport .play {
        width: 64px;
        height: 64px;
        background: var(--glass-ink);
        color: var(--glass-on-ink);
      }
      .transport.off,
      .volume.off {
        opacity: 0.4;
        pointer-events: none;
      }
      .volume,
      .section {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .row-label {
        display: flex;
        justify-content: space-between;
        font-size: var(--glass-text-body);
      }
      .dim {
        color: var(--glass-text-secondary);
      }
      .vbar {
        position: relative;
        height: 72px;
        border-radius: 36px;
        overflow: hidden;
        background: rgba(var(--glass-line-rgb), 0.06);
      }
      .vfill {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        border-radius: 36px;
        background: rgba(var(--glass-line-rgb), 0.14);
      }
      .mute {
        all: unset;
        position: absolute;
        left: 10px;
        top: 14px;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
    `,
  ];
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

declare global {
  interface HTMLElementTagNameMap {
    'glass-media-sheet': GlassMediaSheet;
  }
}

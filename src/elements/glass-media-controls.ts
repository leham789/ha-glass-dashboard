import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HassEntity } from '../ha.js';
import './glass-button.js';

// media_player supported_features bits
export const MEDIA = {
  SEEK: 2,
  VOLUME_SET: 4,
  VOLUME_MUTE: 8,
  PREVIOUS: 16,
  NEXT: 32,
  SELECT_SOURCE: 2048,
  SHUFFLE: 32768,
  REPEAT: 262144,
};

/** Asks the card to call media_player.<service> with this data. */
const call = (el: HTMLElement, service: string, data: Record<string, unknown> = {}) =>
  el.dispatchEvent(new CustomEvent('media-call', { detail: { service, data }, bubbles: true, composed: true }));

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Where playback is now, in seconds, counting on from HA's last report. */
function position(e: HassEntity): number {
  const a = e.attributes;
  const pos = Number(a.media_position) || 0;
  if (e.state !== 'playing' || !a.media_position_updated_at) return pos;
  return Math.min(Number(a.media_duration) || Infinity, pos + (Date.now() - Date.parse(a.media_position_updated_at)) / 1000);
}

/**
 * Seek bar (Library: Media controls): 24 to touch, a 4 track, a 16 knob and
 * the times under it. Moves on its own while playing. Draws nothing when the
 * player can't seek or has no duration. Fires `media-call` (media_seek).
 */
@customElement('glass-seek')
export class GlassSeek extends LitElement {
  @property({ attribute: false }) entity?: HassEntity;
  @state() private draft?: number;
  @state() private tick = 0;
  private timer?: number;

  connectedCallback(): void {
    super.connectedCallback();
    this.timer = window.setInterval(() => this.entity?.state === 'playing' && this.draft === undefined && this.tick++, 1000);
  }

  disconnectedCallback(): void {
    window.clearInterval(this.timer);
    super.disconnectedCallback();
  }

  render() {
    void this.tick;
    const e = this.entity;
    const dur = Number(e?.attributes.media_duration) || 0;
    if (!e || !dur || !((e.attributes.supported_features ?? 0) & MEDIA.SEEK)) return nothing;
    const pos = this.draft ?? position(e);
    const at = Math.min(100, (pos / dur) * 100);
    return html`<span class="track">
        <span class="done" style="width: ${at}%"></span>
        <span class="knob" style="left: ${at}%"></span>
        <input
          type="range"
          min="0"
          max=${dur}
          .value=${String(Math.round(pos))}
          aria-label="Position"
          @input=${(ev: Event) => (this.draft = Number((ev.target as HTMLInputElement).value))}
          @change=${(ev: Event) => {
            ev.stopPropagation();
            call(this, 'media_seek', { seek_position: Number((ev.target as HTMLInputElement).value) });
            this.draft = undefined;
          }}
        />
      </span>
      <span class="times"><span>${mmss(pos)}</span><span>${mmss(dur)}</span></span>`;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
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
      box-shadow: var(--glass-seek-shadow);
    }
    .track:has(input:focus-visible) .knob {
      outline: 2px solid var(--glass-ink);
      outline-offset: 2px;
    }
    .times {
      display: flex;
      justify-content: space-between;
      font-size: var(--glass-text-small);
      color: var(--glass-text-muted);
    }
    input {
      -webkit-appearance: none;
      appearance: none;
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      opacity: 0;
      background: transparent;
      cursor: ew-resize;
      touch-action: pan-y;
    }
  `;
}

/**
 * Transport row (Library: Media controls): shuffle · previous · play or pause
 * · next · repeat, each only when the player supports it (play or pause always
 * shows). Spread across when shuffle or repeat show, centred 16 apart when
 * not. Icon buttons: play 64 dark, previous and next 52 white, shuffle and
 * repeat the 44 icon-only look. `disabled` (unavailable) fades it to 40% and
 * it takes no taps. Fires `media-call`.
 */
@customElement('glass-transport')
export class GlassTransport extends LitElement {
  @property({ attribute: false }) entity?: HassEntity;
  @property({ type: Boolean, reflect: true }) disabled = false;

  render() {
    const e = this.entity;
    if (!e) return nothing;
    const a = e.attributes;
    const f: number = a.supported_features ?? 0;
    const playing = e.state === 'playing';
    const repeatOn = !!a.repeat && a.repeat !== 'off';
    return html`<div class=${f & (MEDIA.SHUFFLE | MEDIA.REPEAT) ? 'row full' : 'row'}>
      ${f & MEDIA.SHUFFLE
        ? html`<glass-icon-button look="bare" size="44" icon="shuffle" toggle ?on=${!!a.shuffle} label="Shuffle" @click=${() => call(this, 'shuffle_set', { shuffle: !a.shuffle })}></glass-icon-button>`
        : nothing}
      ${f & MEDIA.PREVIOUS
        ? html`<glass-icon-button look="white" icon="skip-back" icon-size="18" solid label="Previous" @click=${() => call(this, 'media_previous_track')}></glass-icon-button>`
        : nothing}
      <glass-icon-button look="dark" size="64" icon=${playing ? 'pause' : 'play'} icon-size="22" solid label=${playing ? 'Pause' : 'Play'} @click=${() => call(this, 'media_play_pause')}></glass-icon-button>
      ${f & MEDIA.NEXT
        ? html`<glass-icon-button look="white" icon="skip-forward" icon-size="18" solid label="Next" @click=${() => call(this, 'media_next_track')}></glass-icon-button>`
        : nothing}
      ${f & MEDIA.REPEAT
        ? html`<glass-icon-button
            look="bare"
            size="44"
            icon=${a.repeat === 'one' ? 'repeat-1' : 'repeat'}
            toggle
            ?on=${repeatOn}
            label="Repeat ${a.repeat ?? 'off'}"
            @click=${() => call(this, 'repeat_set', { repeat: !repeatOn ? 'all' : a.repeat === 'all' ? 'one' : 'off' })}
          ></glass-icon-button>`
        : nothing}
    </div>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    :host([disabled]) {
      opacity: 0.4;
      pointer-events: none;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
    }
    .row.full {
      justify-content: space-between;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-seek': GlassSeek;
    'glass-transport': GlassTransport;
  }
}

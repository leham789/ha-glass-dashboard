import { css, html, nothing, type CSSResultGroup } from 'lit';
import '../elements/glass-slider.js';
import type { GlassSlider } from '../elements/glass-slider.js';
import { MEDIA } from '../elements/glass-media-controls.js';
import { customElement, state } from 'lit/decorators.js';
import { GlassEntitySheet } from './entity-sheet.js';
import type { HassEntity } from '../ha.js';
import type { IconName } from '../icons.js';

const { VOLUME_SET, VOLUME_MUTE, SELECT_SOURCE } = MEDIA;

/**
 * Replaces HA's media player pop-up: artwork, what's playing, a seek bar, the
 * transport (shuffle · previous · play / pause · next · repeat), volume and the
 * speakers it can play on. Each control only shows when the player supports
 * it, so a TV gets just previous, play / pause, next and volume.
 */
@customElement('glass-media-sheet')
export class GlassMediaSheet extends GlassEntitySheet {
  @state() private draft: { vol?: number } = {};

  protected iconFor(): IconName {
    return 'music';
  }

  protected iconBgFor(): string {
    return 'var(--glass-blue)';
  }

  protected get sheetSubtitle(): string {
    const a = this.entity?.attributes;
    return [a?.app_name, a?.source].filter(Boolean).join(' · ') || super.sheetSubtitle;
  }

  private onCall = (ev: CustomEvent<{ service: string; data: Record<string, unknown> }>) => this.call(ev.detail.service, ev.detail.data);

  private call(service: string, data: Record<string, unknown> = {}) {
    this.hass!.callService('media_player', service, { entity_id: this.entityId, ...data });
  }

  protected renderBody() {
    const e = this.entity;
    if (!e) return html``;
    const a = e.attributes;
    const f: number = a.supported_features ?? 0;
    const off = this.unavailable;
    const idle = !off && !['playing', 'paused', 'buffering'].includes(e.state);
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

      ${!off && !idle ? html`<glass-seek .entity=${e} @media-call=${this.onCall}></glass-seek>` : nothing}

      <glass-transport .entity=${e} ?disabled=${off} @media-call=${this.onCall}></glass-transport>

      ${f & VOLUME_SET
        ? html`<div class="volume">
            <div class="row-label"><span>Volume</span><span class="dim">${muted ? 'Muted' : `${vol}%`}</span></div>
            <glass-slider
              label="Volume"
              fill="neutral"
              icon="volume-2"
              ?mute=${!!(f & VOLUME_MUTE)}
              ?muted=${muted}
              .value=${vol}
              ?disabled=${off}
              @input=${(ev: Event) => (this.draft = { vol: (ev.target as GlassSlider).value })}
              @change=${(ev: Event) => {
                this.call('volume_set', { volume_level: (ev.target as GlassSlider).value / 100 });
                this.draft = {};
              }}
              @mute=${() => this.call('volume_mute', { is_volume_muted: !muted })}
            ></glass-slider>
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
        margin: 4px 0 0;
      }
      glass-seek {
        margin-top: -8px;
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
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-media-sheet': GlassMediaSheet;
  }
}

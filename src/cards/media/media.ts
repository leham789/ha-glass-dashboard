import { css, html, nothing, type PropertyValues } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, isUnavailable, openMoreInfo, registerCard } from '../../ha.js';
import { nameInRoom } from '../../rooms.js';
import { haptic } from '../../motion.js';
import '../../elements/glass-icon.js';
import './media-editor.js';

export interface MediaConfig extends LovelaceCardConfig {
  /** The main player, e.g. the Apple TV or a Sonos speaker. */
  entity: string;
  /** Devices underneath as buttons ("TV · On", "PS5 · Off"); tap to switch. */
  buttons?: string[];
  /** Dark (TV) or light (music). Default dark. */
  style?: 'dark' | 'light';
}

/**
 * A room's media: what's on and play/pause, with the room's other devices
 * as small buttons underneath. Dark for a TV, light for music.
 */
@customElement('glass-media')
export class GlassMedia extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: MediaConfig;

  static getConfigElement() {
    return document.createElement('glass-media-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<MediaConfig> {
    return { entity: Object.keys(hass.states).find((id) => id.startsWith('media_player.')) ?? '' };
  }

  setConfig(config: MediaConfig): void {
    if (!config.entity?.startsWith('media_player.')) throw new Error('Choose a media player');
    this.config = config;
  }

  getCardSize(): number {
    return 3;
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
    const ids = [this.config.entity, ...(this.config.buttons ?? [])];
    return !old || ids.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const p = this.hass.states[this.config.entity];
    if (!p) return nothing;
    const a = p.attributes;
    const active = p.state === 'playing' || p.state === 'paused';
    const playing = p.state === 'playing';
    const context = [nameInRoom(this.hass!, p), a.app_name ?? a.source].filter(Boolean).join(' · ');
    const title = active ? (a.media_title ?? 'Playing') : isUnavailable(p) ? 'Unavailable' : p.state === 'off' ? 'Off' : 'Nothing playing';

    return html`<section class=${this.config.style ?? 'dark'} aria-label=${nameInRoom(this.hass!, p)}>
      <div class="top">
        <button type="button" class="info" @click=${() => openMoreInfo(this, p.entity_id)}>
          <span class="context">${context}</span>
          <span class="title">${title}${a.media_artist ? html`<span class="artist"> · ${a.media_artist}</span>` : nothing}</span>
        </button>
        <button
          type="button"
          class="play"
          aria-label=${playing ? 'Pause' : 'Play'}
          ?disabled=${isUnavailable(p) || p.state === 'off'}
          @click=${() => (haptic('light'), this.hass!.callService('media_player', 'media_play_pause', { entity_id: p.entity_id }))}
        >
          <glass-icon name=${playing ? 'pause' : 'play'} size="18" stroke="2" solid></glass-icon>
        </button>
      </div>
      ${this.config.buttons?.length
        ? html`<div class="buttons">
            ${this.config.buttons.map((id) => {
              const e = this.hass!.states[id];
              if (!e) return nothing;
              const on = !['off', 'standby', 'unavailable', 'unknown'].includes(e.state);
              return html`<button
                type="button"
                class="device ${on ? 'on' : ''}"
                aria-pressed=${on ? 'true' : 'false'}
                ?disabled=${isUnavailable(e)}
                @click=${() => this.toggle(id, on)}
              >
                ${nameInRoom(this.hass!, e)} · ${isUnavailable(e) ? 'Offline' : on ? 'On' : 'Off'}
              </button>`;
            })}
          </div>`
        : nothing}
    </section>`;
  }

  private toggle(id: string, on: boolean) {
    const domain = id.split('.')[0];
    const service = on ? 'turn_off' : 'turn_on';
    haptic('light');
    if (domain === 'remote' || domain === 'media_player') this.hass!.callService(domain, service, { entity_id: id });
    else this.hass!.callService('homeassistant', service, { entity_id: id });
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      section {
        box-sizing: border-box;
        padding: 16px 14px 16px var(--glass-space-edge);
        border-radius: var(--glass-radius-card);
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .dark {
        background: linear-gradient(135deg, #2a2d33 0%, #4a4e57 100%);
        color: #fff;
        --muted: rgba(255, 255, 255, 0.75);
        --play-bg: #fff;
        --play-fg: #121316; /* the dark card stays dark in both themes */
        --chip-border: rgba(255, 255, 255, 0.3);
        --chip-on: rgba(255, 255, 255, 0.12);
      }
      .light {
        background: var(--glass-surface);
        border: 1px solid var(--glass-surface-border);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        color: var(--glass-ink);
        --muted: var(--glass-text-muted);
        --play-bg: var(--glass-ink);
        --play-fg: var(--glass-on-ink);
        --chip-border: rgba(var(--glass-line-rgb), 0.12);
        --chip-on: var(--glass-solid);
      }
      .top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .info {
        all: unset;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
        cursor: pointer;
      }
      .context {
        font-size: var(--glass-text-caption);
        color: var(--muted);
      }
      .title {
        font-size: var(--glass-text-tile-title);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .artist {
        color: var(--muted);
      }
      .play {
        all: unset;
        width: 52px;
        height: 52px;
        flex: none;
        border-radius: 50%;
        background: var(--play-bg);
        color: var(--play-fg);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .play:disabled {
        opacity: 0.4;
        cursor: default;
      }
      .buttons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .device {
        all: unset;
        box-sizing: border-box;
        height: 40px;
        padding: 0 14px;
        border-radius: 20px;
        border: 1px solid var(--chip-border);
        font-size: var(--glass-text-caption);
        cursor: pointer;
      }
      .device.on {
        background: var(--chip-on);
      }
      .device:disabled {
        opacity: 0.5;
        cursor: default;
      }
      button:focus-visible {
        outline: 2px solid currentColor;
        outline-offset: 2px;
      }
    `,
  ];
}

registerCard({
  type: 'glass-media',
  name: 'Glass · Media',
  description: 'A room’s player with play/pause and its other devices as buttons. Dark or light.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-media': GlassMedia;
  }
}

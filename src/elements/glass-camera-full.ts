import { css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { GlassElement, openOverlays } from '../glass-element.js';
import { tokens } from '../tokens.js';
import { type HomeAssistant, isUnavailable } from '../ha.js';
import { shortName } from '../rooms.js';
import { ago } from '../time.js';
import { haptic } from '../motion.js';
import './glass-camera-live.js';
import './glass-icon.js';

export interface FullCamera {
  entity: string;
  name?: string;
  /** A light to switch from here, e.g. the porch light by the doorbell. */
  light?: string;
}

/**
 * Our own full-screen camera view, in place of HA's camera pop-up. It isn't
 * the browser's real full screen (on iPhone that only exists through Apple's
 * own video player, which can't show our controls): it's a black view of our
 * own that fills the phone and turns with it. < > or a swipe switch cameras.
 */
@customElement('glass-camera-full')
export class GlassCameraFull extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) cameras: FullCamera[] = [];
  @property({ type: Number }) index = 0;
  @state() private live = false;
  private swipeX?: number;

  static open(hass: HomeAssistant, cameras: FullCamera[], index = 0): GlassCameraFull {
    const view = document.createElement('glass-camera-full');
    Object.assign(view, { hass, cameras, index });
    document.body.appendChild(view);
    return view;
  }

  connectedCallback(): void {
    super.connectedCallback();
    openOverlays.add(this);
    document.addEventListener('keydown', this.onKey);
    document.documentElement.style.overflow = 'hidden';
  }

  disconnectedCallback(): void {
    openOverlays.delete(this);
    document.removeEventListener('keydown', this.onKey);
    // A sheet may still be open underneath; it keeps the page from scrolling.
    if (![...openOverlays].length) document.documentElement.style.overflow = '';
    super.disconnectedCallback();
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('index')) this.live = false;
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.remove();
    else if (e.key === 'ArrowLeft') this.go(this.index - 1);
    else if (e.key === 'ArrowRight') this.go(this.index + 1);
  };

  private go(i: number) {
    const n = this.cameras.length;
    if (n > 1) this.index = ((i % n) + n) % n;
  }

  private endSwipe(e: PointerEvent) {
    if (this.swipeX === undefined) return;
    const dx = e.clientX - this.swipeX;
    this.swipeX = undefined;
    if (Math.abs(dx) > 50) this.go(this.index + (dx < 0 ? 1 : -1));
  }

  render() {
    const hass = this.hass;
    const c = this.cameras[this.index];
    const cam = c && hass?.states[c.entity];
    if (!hass || !c) return nothing;
    const offline = isUnavailable(cam);
    const recording = cam?.state === 'recording';
    const pic = cam?.attributes.entity_picture as string | undefined;
    const light = c.light ? hass.states[c.light] : undefined;
    const lightOn = light?.state === 'on';
    const many = this.cameras.length > 1;
    const name = c.name ?? shortName(cam, '');
    return html`<div class="view" role="dialog" aria-modal="true" aria-label="${name} full screen">
      <div class="feed" @pointerdown=${(e: PointerEvent) => (this.swipeX = e.clientX)} @pointerup=${this.endSwipe} @pointercancel=${() => (this.swipeX = undefined)}>
        ${pic && !offline ? html`<img src=${pic} alt="" draggable="false" />` : html`<span class="none">${offline ? 'Camera offline' : 'No picture'}</span>`}
        ${offline ? nothing : html`<glass-camera-live class="video ${this.live ? 'on' : ''}" .hass=${hass} .entity=${c.entity} @live-changed=${(e: CustomEvent<boolean>) => (this.live = e.detail)}></glass-camera-live>`}
        <span class="hint">Turn your phone for a bigger picture</span>
      </div>

      <div class="top">
        <span class="who">
          <span class="name">${name}</span>
          <span class="pill"><span class="dot ${offline ? 'off' : recording ? 'rec' : 'live'}"></span>${offline ? 'Offline' : recording ? 'Recording' : 'Live'}</span>
        </span>
        <button type="button" class="round" aria-label="Close" @click=${() => this.remove()}><glass-icon name="x" size="20" stroke="1.8"></glass-icon></button>
      </div>

      ${many
        ? html`<button type="button" class="round arrow left" aria-label="Previous camera" @click=${() => this.go(this.index - 1)}><glass-icon name="chevron-left" size="18" stroke="1.8"></glass-icon></button>
            <button type="button" class="round arrow right" aria-label="Next camera" @click=${() => this.go(this.index + 1)}><glass-icon name="chevron-right" size="18" stroke="1.8"></glass-icon></button>`
        : nothing}

      <div class="foot">
        <span class="info">
          ${many
            ? html`<span class="dots" role="tablist" aria-label="Cameras">
                ${this.cameras.map((x, i) => html`<button type="button" role="tab" aria-selected=${i === this.index ? 'true' : 'false'} aria-label=${x.name ?? x.entity} class=${i === this.index ? 'on' : ''} @click=${() => (this.index = i)}></button>`)}
              </span>`
            : nothing}
          <span class="last">${cam ? `Updated ${ago(cam.last_changed)}` : ''}</span>
        </span>
        ${light
          ? html`<button type="button" class="light ${lightOn ? 'on' : ''}" aria-pressed=${lightOn ? 'true' : 'false'} ?disabled=${isUnavailable(light)} @click=${() => (haptic('light'), hass.callService('homeassistant', lightOn ? 'turn_off' : 'turn_on', { entity_id: c.light }))}>
              <glass-icon name="lightbulb" size="18" stroke="1.7"></glass-icon>${shortName(light, '')} · ${lightOn ? 'On' : 'Off'}
            </button>`
          : nothing}
      </div>
    </div>`;
  }

  static styles = [
    tokens,
    css`
      :host {
        position: fixed;
        inset: 0;
        z-index: 20;
      }
      .view {
        position: absolute;
        inset: 0;
        background: #000;
        color: #fff;
        font-family: var(--glass-font);
      }
      /* the picture: 16:9, full width upright, full height sideways */
      .feed {
        position: absolute;
        left: 0;
        right: 0;
        top: 50%;
        transform: translateY(-60%);
        aspect-ratio: 16 / 9;
        background: #1f2427;
        touch-action: pan-y;
      }
      .feed img,
      .feed .video {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .feed .video {
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      .feed .video.on {
        opacity: 1;
      }
      .none {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--glass-text-caption);
        color: rgba(255, 255, 255, 0.6);
      }
      .round,
      .pill,
      .light {
        background: rgba(255, 255, 255, 0.14);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
      }
      button {
        all: unset;
        cursor: pointer;
      }
      button:focus-visible {
        outline: 2px solid #fff;
        outline-offset: 2px;
      }
      .round {
        width: 44px;
        height: 44px;
        flex: none;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .top {
        position: absolute;
        left: var(--glass-space-edge);
        right: var(--glass-space-edge);
        top: calc(20px + env(safe-area-inset-top, 0px));
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .who {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .name {
        font-size: 20px;
        white-space: nowrap;
      }
      .pill {
        height: 30px;
        padding: 0 12px;
        border-radius: 15px;
        font-size: var(--glass-text-caption);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #2fb457;
      }
      .dot.rec {
        background: #ff5a4e;
      }
      .dot.off {
        background: #8a8d94;
      }
      .arrow {
        position: absolute;
        top: 50%;
        margin-top: calc(-22px - 10%);
      }
      .arrow.left {
        left: 12px;
      }
      .arrow.right {
        right: 12px;
      }
      .foot {
        position: absolute;
        left: var(--glass-space-edge);
        right: var(--glass-space-edge);
        bottom: calc(48px + env(safe-area-inset-bottom, 0px));
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 16px;
      }
      .info {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      }
      .dots {
        display: flex;
        gap: 6px;
      }
      .dots button {
        width: 8px;
        height: 8px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.35);
      }
      .dots button.on {
        width: 24px;
        background: #fff;
      }
      .last {
        font-size: var(--glass-text-caption);
        color: rgba(255, 255, 255, 0.75);
      }
      .light {
        box-sizing: border-box;
        height: 52px;
        padding: 0 20px;
        border-radius: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: var(--glass-text-body);
      }
      .light.on {
        background: var(--glass-light-default);
        color: #121316;
      }
      .hint {
        position: absolute;
        left: 0;
        right: 0;
        top: calc(100% + 20px);
        text-align: center;
        font-size: var(--glass-text-small);
        color: rgba(255, 255, 255, 0.45);
      }
      @media (orientation: landscape) {
        .feed {
          left: 50%;
          right: auto;
          top: 0;
          bottom: 0;
          transform: translateX(-50%);
          height: 100%;
        }
        .arrow {
          margin-top: -22px;
        }
        .arrow.left {
          left: 20px;
        }
        .arrow.right {
          right: 20px;
        }
        .top,
        .foot {
          left: 64px;
          right: 64px;
        }
        .top {
          top: 20px;
        }
        .foot {
          bottom: 20px;
          flex-direction: row;
          align-items: flex-end;
          justify-content: space-between;
        }
        .info {
          align-items: flex-start;
        }
        .hint {
          display: none;
        }
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-camera-full': GlassCameraFull;
  }
}

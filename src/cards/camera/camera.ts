import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, isUnavailable, openMoreInfo, registerCard } from '../../ha.js';
import { shortName } from '../../rooms.js';
import { ago, clock } from '../../time.js';
import { GlassSheet } from '../../elements/glass-sheet.js';
import type { GlassCamerasSheet, SheetCamera } from '../../sheets/cameras-sheet.js';
import '../../sheets/cameras-sheet.js';
import '../../elements/glass-icon.js';
import './camera-editor.js';

export interface CameraConfig extends LovelaceCardConfig, SheetCamera {
  /** A heading above the card, e.g. "Cameras" on the first one. */
  heading?: string;
}

const REFRESH_MS = 10_000;
const RECENT_MOTION_MS = 5 * 60_000;

/**
 * One camera: a picture that refreshes every 10 seconds, a Recording / Live
 * badge, and an expand button for the cameras pop-up, which loops round every
 * camera card on the screen, starting with this one. Underneath,
 * its name, when it last saw motion (and the doorbell last rang), and a
 * Motion / Clear pill.
 */
@customElement('glass-camera')
export class GlassCamera extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: CameraConfig;
  @state() private tick = Date.now();
  private timer?: number;
  private sheet?: GlassSheet;

  static getConfigElement() {
    return document.createElement('glass-camera-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<CameraConfig> {
    return { entity: Object.keys(hass.states).find((id) => id.startsWith('camera.')) ?? '' };
  }

  setConfig(config: CameraConfig): void {
    if (!config.entity?.startsWith('camera.')) throw new Error('Choose a camera');
    this.config = config;
  }

  getCardSize(): number {
    return 5;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    ensureFonts();
    // Refresh the picture while the card is on screen and the page is visible.
    this.timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') this.tick = Date.now();
    }, REFRESH_MS);
  }

  disconnectedCallback(): void {
    window.clearInterval(this.timer);
    this.sheet?.close();
    super.disconnectedCallback();
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    // Keep an open cameras pop-up current.
    if (this.sheet?.isConnected && this.hass) this.sheet.hass = this.hass;
    if (!changed.has('hass') || changed.size > 1 || !this.config) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    const ids = [this.config.entity, this.config.motion_entity, this.config.ding_entity].filter(Boolean) as string[];
    return !old || ids.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const c = this.config;
    const cam = this.hass.states[c.entity];
    if (!cam) return nothing;
    const motion = c.motion_entity ? this.hass.states[c.motion_entity] : undefined;
    const ding = c.ding_entity ? this.hass.states[c.ding_entity] : undefined;
    const offline = isUnavailable(cam);
    const recording = cam.state === 'recording';
    // "Motion" while there's motion and for a few minutes after it stops.
    const moving = !!motion && (motion.state === 'on' || Date.now() - Date.parse(motion.last_changed) < RECENT_MOTION_MS);
    // An event entity's state is the time of the last press; a binary sensor's is on/off.
    const rang = ding && !isUnavailable(ding) ? (Number.isNaN(Date.parse(ding.state)) ? ding.last_changed : ding.state) : undefined;
    const picture = cam.attributes.entity_picture as string | undefined;
    // A ?t= on the end makes the browser fetch a fresh frame (not for inline data: images).
    const src = picture && !picture.startsWith('data:') ? `${picture}${picture.includes('?') ? '&' : '?'}t=${this.tick}` : picture;

    const last = [
      motion && !isUnavailable(motion) ? (motion.state === 'on' ? 'Motion now' : `Motion ${ago(motion.last_changed)}`) : '',
      rang ? `rang ${clock(rang)}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    return html`
      ${c.heading ? html`<h2>${c.heading}</h2>` : nothing}
      <section aria-label=${c.name ?? shortName(cam, '')}>
        <div class="view">
          ${src && !offline ? html`<img src=${src} alt="" loading="lazy" />` : html`<span class="none">${offline ? 'Camera offline' : 'No picture'}</span>`}
          <span class="badge"><span class="dot ${recording ? 'rec' : offline ? 'off' : 'live'}"></span>${offline ? 'Offline' : recording ? 'Recording' : 'Live'}</span>
          <button type="button" class="expand" aria-label="Open cameras" @click=${() => this.openCameras()}>
            <glass-icon name="maximize-2" size="16" stroke="1.8"></glass-icon>
          </button>
        </div>
        <div class="foot">
          <span class="info">
            <span class="name">${c.name ?? shortName(cam, '')}</span>
            ${last ? html`<span class="last">${last}</span>` : nothing}
          </span>
          ${motion ? html`<span class="pill ${moving ? 'motion' : 'clear'}">${moving ? 'Motion' : 'Clear'}</span>` : nothing}
        </div>
      </section>
    `;
  }

  /** Opens the cameras pop-up on this camera, with every camera card on the screen to loop through. */
  private openCameras() {
    if (this.sheet?.isConnected) return;
    const cards = allCameraCards();
    const cameras = cards.map((card) => card.config!).filter(Boolean);
    const sheet = GlassSheet.open<GlassCamerasSheet>('glass-cameras-sheet', this.hass!);
    sheet.cameras = cameras.length ? cameras : [this.config!];
    sheet.index = Math.max(0, cards.indexOf(this));
    this.sheet = sheet;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--glass-space-tile-gap);
      }
      h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 400;
      }
      section {
        box-sizing: border-box;
        padding: 8px 8px 16px;
        border-radius: var(--glass-radius-card);
        background: var(--glass-surface);
        border: 1px solid var(--glass-surface-border);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .view {
        position: relative;
        height: 196px;
        overflow: hidden;
        border-radius: var(--glass-radius-small-tile);
        background: linear-gradient(135deg, #2a2d33 0%, #4a4e57 100%);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .none {
        font-size: var(--glass-text-caption);
        color: rgba(255, 255, 255, 0.65);
      }
      .badge {
        position: absolute;
        top: 12px;
        left: 12px;
        height: 24px;
        padding: 0 10px;
        border-radius: 12px;
        background: rgba(0, 0, 0, 0.45);
        color: #fff;
        font-size: var(--glass-text-small);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }
      .dot.rec {
        background: #ff5a4e;
      }
      .dot.live {
        background: var(--glass-go);
      }
      .dot.off {
        background: #8a8d94;
      }
      .expand {
        all: unset;
        position: absolute;
        top: 12px;
        right: 12px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.45);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .expand:focus-visible {
        outline: 2px solid #fff;
        outline-offset: 2px;
      }
      .foot {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        padding: 0 8px;
      }
      .info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .name {
        font-size: var(--glass-text-tile-title);
      }
      .last {
        font-size: var(--glass-text-caption);
        color: var(--glass-text-muted);
      }
      .pill {
        flex: none;
        height: 30px;
        padding: 0 12px;
        border-radius: 15px;
        font-size: var(--glass-text-caption);
        display: flex;
        align-items: center;
      }
      .pill.motion {
        background: var(--glass-attention-tint);
        color: #8a3a1c;
      }
      .pill.clear {
        background: var(--glass-success-tint);
        color: #1e6e36;
      }
    `,
  ];
}

/** Every camera card on the page, in screen order (cards sit inside HA's shadow roots). */
function allCameraCards(root: Document | ShadowRoot = document, found: GlassCamera[] = []): GlassCamera[] {
  for (const el of root.querySelectorAll('*')) {
    if (el instanceof GlassCamera) found.push(el);
    if (el.shadowRoot) allCameraCards(el.shadowRoot, found);
  }
  return found;
}

registerCard({
  type: 'glass-camera',
  name: 'Glass · Camera',
  description: 'A camera picture with live badge, last motion and doorbell, and a Motion / Clear pill.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-camera': GlassCamera;
  }
}

import { css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { GlassElement, openOverlays } from '../glass-element.js';
import { tokens } from '../tokens.js';
import { type HomeAssistant, isUnavailable } from '../ha.js';
import { shortName } from '../rooms.js';
import { ago, clock } from '../time.js';
import './glass-camera-live.js';
import { cameraBadge } from './glass-camera-controls.js';
import './glass-icon.js';

export interface FullCamera {
  entity: string;
  name?: string;
  /** A light to switch from here, e.g. the porch light by the doorbell. */
  light?: string;
  /** For the line under the picture: "Motion 4 min ago · rang 18:02". */
  motion_entity?: string;
  ding_entity?: string;
  /** Or a line of the opener's own, e.g. the printer's "Printing · 42% · layer 16 of 37". */
  caption?: string;
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
  /** Pinch to zoom (1–4×), drag to look around while zoomed, double-tap to zoom in or back out. */
  @state() private zoom = { scale: 1, x: 0, y: 0 };
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch?: { dist: number; scale: number };
  private pan?: { x: number; y: number; zx: number; zy: number };
  /** Where this touch started, and whether a second finger joined it (a pinch, never a tap or swipe). */
  private touch?: { x: number; y: number; zoomed: boolean; multi: boolean };
  private lastTap = 0;

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
    if (changed.has('index')) {
      this.live = false;
      this.zoom = { scale: 1, x: 0, y: 0 };
    }
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

  private onDown = (e: PointerEvent) => {
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* not a live pointer */
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.touch = { x: e.clientX, y: e.clientY, zoomed: this.zoom.scale > 1, multi: false };
      this.startPan(e);
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: this.zoom.scale };
      this.pan = undefined;
      if (this.touch) this.touch.multi = true;
    }
  };

  private startPan(p: { clientX: number; clientY: number }) {
    this.pan = this.zoom.scale > 1 ? { x: p.clientX, y: p.clientY, zx: this.zoom.x, zy: this.zoom.y } : undefined;
  }

  private onMove = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const box = (e.currentTarget as Element).getBoundingClientRect();
    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const scale = Math.min(4, Math.max(1, (this.pinch.scale * Math.hypot(a.x - b.x, a.y - b.y)) / this.pinch.dist));
      this.zoom = this.clamp({ ...this.zoom, scale }, box);
    } else if (this.pan) {
      this.zoom = this.clamp({ scale: this.zoom.scale, x: this.pan.zx + e.clientX - this.pan.x, y: this.pan.zy + e.clientY - this.pan.y }, box);
    }
  };

  private onUp = (e: PointerEvent) => {
    if (!this.pointers.delete(e.pointerId)) return;
    if (this.pointers.size === 1) {
      // One finger lifted from a pinch: the other carries on dragging.
      this.pinch = undefined;
      const [p] = [...this.pointers.values()];
      this.startPan({ clientX: p.x, clientY: p.y });
      return;
    }
    if (this.pointers.size) return;
    const t = this.touch;
    this.pinch = this.pan = this.touch = undefined;
    if (!t || t.multi) return;
    const dx = e.clientX - t.x;
    if (!t.zoomed && Math.abs(dx) > 50) return this.go(this.index + (dx < 0 ? 1 : -1));
    if (Math.hypot(dx, e.clientY - t.y) > 10) return;
    // A second tap within 300 ms zooms in to 2.5×, or back out.
    const now = Date.now();
    if (now - this.lastTap < 300) {
      this.zoom = this.zoom.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2.5, x: 0, y: 0 };
      this.lastTap = 0;
    } else {
      this.lastTap = now;
    }
  };

  /**
   * Zoomed, the picture spills past its frame over the whole screen. Panning
   * stops where it would leave a gap: on a side where the picture is bigger
   * than the screen its edge can't come in past the screen's edge, and where
   * it's smaller it can't go off the screen.
   */
  private clamp(z: { scale: number; x: number; y: number }, box: DOMRect) {
    if (z.scale <= 1) return { scale: 1, x: 0, y: 0 };
    const limit = (offset: number, start: number, size: number, screen: number) => {
      const centre = start + size / 2; // the frame's centre, which the picture scales about
      const half = (size * z.scale) / 2;
      const a = half - centre;
      const b = screen - centre - half;
      return Math.max(Math.min(a, b), Math.min(Math.max(a, b), offset));
    };
    return {
      scale: z.scale,
      x: limit(z.x, box.left, box.width, window.innerWidth),
      y: limit(z.y, box.top, box.height, window.innerHeight),
    };
  }

  /** The camera's last motion and ring, as on the Cameras sheet, or the opener's own line. */
  private lastLine(c: FullCamera): string {
    if (c.caption) return c.caption;
    const motion = c.motion_entity ? this.hass!.states[c.motion_entity] : undefined;
    const ding = c.ding_entity ? this.hass!.states[c.ding_entity] : undefined;
    const rang = ding && !isUnavailable(ding) ? (Number.isNaN(Date.parse(ding.state)) ? ding.last_changed : ding.state) : undefined;
    return [
      motion && !isUnavailable(motion) ? (motion.state === 'on' ? 'Motion now' : `Motion ${ago(motion.last_changed)}`) : '',
      rang ? `rang ${clock(rang)}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  render() {
    const hass = this.hass;
    const c = this.cameras[this.index];
    const cam = c && hass?.states[c.entity];
    if (!hass || !c) return nothing;
    const offline = isUnavailable(cam);
    const pic = cam?.attributes.entity_picture as string | undefined;
    const light = c.light ? hass.states[c.light] : undefined;
    const many = this.cameras.length > 1;
    const name = c.name ?? shortName(cam, '');
    return html`<div class="view" role="dialog" aria-modal="true" aria-label="${name} full screen">
      <div class="feed" @pointerdown=${this.onDown} @pointermove=${this.onMove} @pointerup=${this.onUp} @pointercancel=${this.onUp}>
        <div class="zoom" style="transform: translate(${this.zoom.x}px, ${this.zoom.y}px) scale(${this.zoom.scale})">
          ${pic && !offline ? html`<img src=${pic} alt="" draggable="false" />` : offline ? nothing : html`<span class="none">No picture</span>`}
          ${offline ? nothing : html`<glass-camera-live class="video ${this.live ? 'on' : ''}" .hass=${hass} .entity=${c.entity} @live-changed=${(e: CustomEvent<boolean>) => (this.live = e.detail)}></glass-camera-live>`}
        </div>
        ${this.zoom.scale > 1.05
          ? html`<glass-camera-pill class="zoom-pill" button label="Zoom back out" @click=${() => (this.zoom = { scale: 1, x: 0, y: 0 })}>${this.zoom.scale.toFixed(1)}×</glass-camera-pill>`
          : nothing}
        ${this.zoom.scale > 1.05 ? nothing : html`<span class="hint">Turn your phone for a bigger picture</span>`}
      </div>

      <div class="top">
        <span class="who">
          <span class="name">${name}</span>
          <glass-camera-pill state=${cameraBadge(cam)}></glass-camera-pill>
        </span>
        <glass-camera-button look="full" size="44" icon="x" label="Close" @click=${() => this.remove()}></glass-camera-button>
      </div>

      ${many
        ? html`<glass-camera-button class="arrow left" look="full" size="44" icon="chevron-left" label="Previous camera" @click=${() => this.go(this.index - 1)}></glass-camera-button>
            <glass-camera-button class="arrow right" look="full" size="44" icon="chevron-right" label="Next camera" @click=${() => this.go(this.index + 1)}></glass-camera-button>`
        : nothing}

      <div class="foot">
        <span class="info">
          ${many
            ? html`<glass-page-dots look="full" .names=${this.cameras.map((x) => x.name ?? x.entity)} .index=${this.index} @pick=${(e: CustomEvent<number>) => (this.index = e.detail)}></glass-page-dots>`
            : nothing}
          <span class="last">${this.lastLine(c) || (cam ? `Updated ${ago(cam.last_changed)}` : '')}</span>
        </span>
        ${light
          ? html`<glass-camera-light look="full" name=${shortName(light, '')} .entity=${light} .hass=${hass}></glass-camera-light>`
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
        background: var(--glass-full-screen);
        color: var(--glass-on-picture);
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
        background: var(--glass-dark-surface);
        /* zoomed, the picture spills out over the whole screen; the name, close and caption stay on top */
        overflow: visible;
        /* the view handles pinch and drag itself, so the page doesn't zoom instead */
        touch-action: none;
      }
      .zoom {
        position: absolute;
        inset: 0;
        transform-origin: center;
      }
      /* how far in, top centre of the picture; tap it to zoom back out */
      .zoom-pill {
        position: absolute;
        left: 50%;
        top: 12px;
        transform: translateX(-50%);
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
        color: var(--glass-on-picture-muted);
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
        gap: 12px;
        min-width: 0;
      }
      .name {
        font-size: 20px;
        white-space: nowrap;
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
        gap: 12px;
      }
      .last {
        font-size: var(--glass-text-caption);
        color: var(--glass-on-picture-soft);
      }
      .hint {
        position: absolute;
        left: 0;
        right: 0;
        top: calc(100% + 20px);
        text-align: center;
        font-size: var(--glass-text-small);
        color: var(--glass-on-picture-hint);
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
        /* level with the name and close button, between them */
        .zoom-pill {
          top: 27px;
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

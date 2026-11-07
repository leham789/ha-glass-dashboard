import { css, html, nothing, type CSSResultGroup, type PropertyValues } from 'lit';
import '../elements/glass-rows.js';
import '../elements/glass-button.js';
import { heading } from '../elements/type.js';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { GlassSheet } from '../elements/glass-sheet.js';
import '../elements/glass-camera-live.js';
import '../elements/glass-chip.js';
import '../elements/glass-meters.js';
import { cameraBadge } from '../elements/glass-camera-controls.js';
import { GlassCameraFull } from '../elements/glass-camera-full.js';
import { type HassEntity, isUnavailable, openMoreInfo } from '../ha.js';
import { shortName } from '../rooms.js';
import { eventSnapshot } from '../snapshots.js';
import { ago, clock } from '../time.js';

/** What the sheet needs to know about each camera (a camera card's settings). */
export interface SheetCamera {
  entity: string;
  name?: string;
  motion_entity?: string;
  ding_entity?: string;
  /** A light to switch from the sheet, e.g. the porch light by the doorbell. */
  light?: string;
}

const CYCLE_MS = 10_000;
const REFRESH_MS = 2_000;
const SWIPE_PX = 50;

/**
 * The cameras pop-up: one camera big, as live video where HA can stream it
 * (else a still refreshing every couple of seconds),
 * with < > (or a swipe) to go round all the cameras and back to the first.
 * Cycle cameras moves on by itself every 10 seconds, forever. Underneath,
 * the camera's latest detections, its light, and full screen.
 */
@customElement('glass-cameras-sheet')
export class GlassCamerasSheet extends GlassSheet {
  @property({ attribute: false }) cameras: SheetCamera[] = [];
  @state() index = 0;
  /** On when the sheet opens, as in the design; the switch turns it off. */
  @state() private cycling = true;
  @state() private tick = Date.now();
  /** When the still picture was last fetched; it stops refreshing while live video plays over it. */
  @state() private stillAt = Date.now();
  @state() private live = false;
  /** A new value redraws the progress line, restarting its 10 s fill. */
  @state() private cycleStart = Date.now();
  /** Event thumbnails by event entity + event id, once fetched ('' when one failed to load). */
  @state() private snaps: Record<string, string> = {};
  private asked = new Set<string>();
  private refresh?: number;
  private cycle?: number;
  private swipeX?: number;

  protected sheetTitle = 'Cameras';
  protected sheetIcon = 'cctv' as const;
  protected sheetIconBg = 'var(--glass-blue)';

  connectedCallback(): void {
    super.connectedCallback();
    this.refresh = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      this.tick = Date.now();
      if (!this.live) this.stillAt = this.tick;
    }, REFRESH_MS);
  }

  disconnectedCallback(): void {
    window.clearInterval(this.refresh);
    window.clearInterval(this.cycle);
    super.disconnectedCallback();
  }

  protected willUpdate(changed: PropertyValues): void {
    const cam = this.current();
    if (cam) this.sheetTitle = cam.name ?? shortName(this.hass!.states[cam.entity], '') ?? 'Cameras';
    if (changed.has('cycling')) {
      window.clearInterval(this.cycle);
      if (this.cycling) this.cycle = window.setInterval(() => this.go(this.index + 1, false), CYCLE_MS);
    }
  }

  private current(): SheetCamera | undefined {
    return this.cameras[this.index];
  }

  /** Round and round: after the last camera comes the first. */
  private go(i: number, byHand = true) {
    const n = this.cameras.length;
    if (!n) return;
    this.index = ((i % n) + n) % n;
    this.cycleStart = Date.now();
    // Moving by hand restarts the 10 s count, so it doesn't jump straight away.
    if (byHand && this.cycling) {
      window.clearInterval(this.cycle);
      this.cycle = window.setInterval(() => this.go(this.index + 1, false), CYCLE_MS);
    }
  }

  protected renderBody() {
    const hass = this.hass!;
    const c = this.current();
    if (!c) return html`<p class="empty">No cameras.</p>`;
    const cam = hass.states[c.entity];
    const offline = isUnavailable(cam);
    const pic = cam?.attributes.entity_picture as string | undefined;
    const src = pic && !pic.startsWith('data:') ? `${pic}${pic.includes('?') ? '&' : '?'}t=${this.stillAt}` : pic;
    const many = this.cameras.length > 1;
    const light = c.light ? hass.states[c.light] : undefined;
    const events = this.events(c.entity).slice(0, 3);
    for (const e of events) this.fetchSnap(e.entity, e.key);

    return html`
      <div class="feed-wrap">
        <div
          class="feed"
          @pointerdown=${(e: PointerEvent) => (this.swipeX = e.clientX)}
          @pointerup=${(e: PointerEvent) => this.endSwipe(e)}
          @pointercancel=${() => (this.swipeX = undefined)}
        >
          ${src && !offline ? html`<img src=${src} alt="" draggable="false" />` : offline ? nothing : html`<span class="none">No picture</span>`}
          ${offline
            ? nothing
            : html`<glass-camera-live
                class="video"
                .hass=${hass}
                .entity=${c.entity}
                @live-changed=${(e: CustomEvent<boolean>) => {
                  this.live = e.detail;
                  if (!e.detail) this.stillAt = Date.now();
                }}
              ></glass-camera-live>`}
          <glass-live-badge class="badge tl" state=${cameraBadge(cam)}></glass-live-badge>
          <glass-live-badge class="badge tr" plain>${new Date(this.tick).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</glass-live-badge>
          ${many
            ? html`<glass-camera-button class="arrow left" size="44" icon="chevron-left" label="Previous camera" @click=${() => this.go(this.index - 1)}></glass-camera-button>
                <glass-camera-button class="arrow right" size="44" icon="chevron-right" label="Next camera" @click=${() => this.go(this.index + 1)}></glass-camera-button>`
            : nothing}
          <span class="foot">
            <span class="last">${this.lastLine(c)}</span>
            <glass-camera-button icon="maximize-2" label="Full screen" @click=${() => GlassCameraFull.open(hass, this.cameras, this.index)}></glass-camera-button>
          </span>
        </div>
        ${many
          ? html`<div class="pager">
              <glass-page-dots .names=${this.cameras.map((cc) => cc.name ?? shortName(hass.states[cc.entity], ''))} .index=${this.index} @pick=${(e: CustomEvent<number>) => this.go(e.detail)}></glass-page-dots>
              ${keyed(this.cycling ? this.cycleStart : 0, html`<glass-bar class="progress" thin .value=${0} .run=${this.cycling ? CYCLE_MS : undefined} aria-hidden="true"></glass-bar>`)}
              <span class="count">${this.cycling ? 'Cycling' : `${this.index + 1} of ${this.cameras.length}`}</span>
            </div>`
          : nothing}
      </div>

      ${many
        ? html`<glass-row-group>
            <glass-grouped-row name="Cycle cameras" line="Next camera every 10 s, round and round">
              <glass-switch ?checked=${this.cycling} label="Cycle cameras" @change=${() => {
                  this.cycling = !this.cycling;
                  this.cycleStart = Date.now();
                }}></glass-switch>
            </glass-grouped-row>
          </glass-row-group>`
        : nothing}

      ${events.length
        ? html`<div class="recent">
            <span class="top"><h2>Recent</h2><span class="hint">Latest of each kind</span></span>
            <div class="clips">
              ${events.map(
                (e) => html`<button type="button" class="clip" @click=${() => openMoreInfo(this, e.entity.entity_id)}>
                  <span class="thumb"
                    >${this.snaps[e.key]
                      ? html`<img class="pan" src=${this.snaps[e.key]} alt="" draggable="false" @error=${() => (this.snaps = { ...this.snaps, [e.key]: '' })} />`
                      : html`<span class="pan"></span>`}<span class="kind">${e.kind}</span></span
                  >
                  <span class="when">${e.when}</span>
                </button>`,
              )}
            </div>
          </div>`
        : nothing}

      ${light
        ? html`<glass-camera-light look="sheet" name=${shortName(light, '')} .entity=${light} .hass=${hass}></glass-camera-light>`
        : nothing}
    `;
  }

  private endSwipe(e: PointerEvent) {
    if (this.swipeX === undefined) return;
    const dx = e.clientX - this.swipeX;
    this.swipeX = undefined;
    if (Math.abs(dx) > SWIPE_PX) this.go(this.index + (dx < 0 ? 1 : -1));
  }

  /** "Motion 4 min ago · rang 18:02" */
  private lastLine(c: SheetCamera): string {
    const hass = this.hass!;
    const motion = c.motion_entity ? hass.states[c.motion_entity] : undefined;
    const ding = c.ding_entity ? hass.states[c.ding_entity] : undefined;
    const rang = ding && !isUnavailable(ding) ? (Number.isNaN(Date.parse(ding.state)) ? ding.last_changed : ding.state) : undefined;
    return [
      motion && !isUnavailable(motion) ? (motion.state === 'on' ? 'Motion now' : `Motion ${ago(motion.last_changed)}`) : '',
      rang ? `rang ${clock(rang)}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  /**
   * The camera's latest detections, newest first: each of its event entities
   * (ring, motion, person, vehicle, sound…) holds the time and kind of its last event.
   */
  private events(cameraId: string): { entity: HassEntity; key: string; kind: string; when: string }[] {
    const hass = this.hass!;
    const device = hass.entities?.[cameraId]?.device_id;
    if (!device) return [];
    return Object.values(hass.states)
      .filter((e) => e.entity_id.startsWith('event.') && hass.entities[e.entity_id]?.device_id === device)
      .map((e) => ({ e, at: Date.parse(e.state) }))
      .filter(({ at }) => !Number.isNaN(at))
      .sort((a, b) => b.at - a.at)
      .map(({ e }) => ({ entity: e, key: `${e.entity_id}|${e.attributes.event_id ?? e.state}`, kind: eventKind(e), when: ago(e.state) }));
  }

  /** Asks once per event for its thumbnail; a new event on the same entity asks again. */
  private fetchSnap(entity: HassEntity, key: string) {
    if (this.asked.has(key)) return;
    this.asked.add(key);
    eventSnapshot(this.hass!, entity).then((url) => {
      if (url) this.snaps = { ...this.snaps, [key]: url };
    });
  }

  static styles: CSSResultGroup = [
    GlassSheet.styles,
    css`
      .feed-wrap {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .feed {
        position: relative;
        height: 262px;
        overflow: hidden;
        border-radius: var(--glass-radius-tile);
        background: var(--glass-dark-surface);
        display: flex;
        align-items: center;
        justify-content: center;
        touch-action: pan-y;
        user-select: none;
        -webkit-user-select: none;
      }
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        pointer-events: none;
      }
      .video {
        position: absolute;
        inset: 0;
      }
      .none {
        font-size: var(--glass-text-caption);
        color: var(--glass-on-picture-muted);
      }
      .badge {
        position: absolute;
        top: 12px;
      }
      .tl {
        left: 12px;
      }
      .tr {
        right: 12px;
      }
      .arrow {
        position: absolute;
        top: 50%;
        margin-top: -22px;
      }
      .arrow.left {
        left: 12px;
      }
      .arrow.right {
        right: 12px;
      }
      .foot {
        position: absolute;
        left: 12px;
        right: 12px;
        bottom: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .last {
        font-size: var(--glass-text-caption);
        color: var(--glass-on-picture-soft);
      }
      .pager {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 4px;
      }
      .progress {
        flex: 1;
      }
      .count {
        font-size: var(--glass-text-small);
        color: var(--glass-text-muted);
      }
      .recent {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }
      h2 {
        ${heading}
      }
      .hint {
        font-size: var(--glass-text-caption);
        color: var(--glass-text-muted);
      }
      .clips {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      .clip {
        all: unset;
        display: flex;
        flex-direction: column;
        gap: 8px;
        cursor: pointer;
      }
      .thumb {
        position: relative;
        height: 84px;
        overflow: hidden;
        border-radius: var(--glass-radius-inset);
        background: var(--glass-dark);
      }
      /* A slow drift, so the tiles read as clips rather than flat thumbnails. */
      .pan {
        position: absolute;
        inset: -10px -20px;
        width: calc(100% + 40px);
        height: calc(100% + 20px);
        object-fit: cover;
        background: linear-gradient(120deg, var(--glass-dark-2), var(--glass-dark));
        animation: drift 6s ease-in-out infinite;
      }
      @keyframes drift {
        50% {
          transform: translateX(-14px);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .pan {
          animation: none;
        }
      }
      .kind {
        position: absolute;
        left: 8px;
        bottom: 8px;
        height: 20px;
        padding: 0 8px;
        border-radius: 10px;
        background: var(--glass-scrim);
        color: var(--glass-on-picture);
        font-size: var(--glass-text-tiny);
        display: flex;
        align-items: center;
      }
      .when {
        padding: 0 4px;
        font-size: var(--glass-text-small);
        color: var(--glass-text-secondary);
      }
      button:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      .empty {
        margin: 0;
        font-size: var(--glass-text-body);
        color: var(--glass-text-muted);
      }
    `,
  ];
}

/** "Person", "Vehicle", "Ring", "Motion", "Speaking"… from a UniFi Protect-style event entity. */
function eventKind(e: HassEntity): string {
  const a = e.attributes;
  const raw: string =
    a.event_type && a.event_type !== 'detected'
      ? a.event_type
      : (a.attributes?.objectType ?? String(a.friendly_name ?? '').split(' ').pop() ?? 'Event');
  const word = raw === 'ring' ? 'Ring' : raw.replace(/_/g, ' ');
  return word.charAt(0).toUpperCase() + word.slice(1);
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-cameras-sheet': GlassCamerasSheet;
  }
}

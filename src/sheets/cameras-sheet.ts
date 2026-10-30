import { css, html, nothing, type CSSResultGroup, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { GlassSheet } from '../elements/glass-sheet.js';
import '../elements/glass-camera-live.js';
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
  protected sheetIconBg = '#9CC3F2';

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
    const recording = cam?.state === 'recording';
    const pic = cam?.attributes.entity_picture as string | undefined;
    const src = pic && !pic.startsWith('data:') ? `${pic}${pic.includes('?') ? '&' : '?'}t=${this.stillAt}` : pic;
    const many = this.cameras.length > 1;
    const light = c.light ? hass.states[c.light] : undefined;
    const lightOn = light?.state === 'on';
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
          ${src && !offline ? html`<img src=${src} alt="" draggable="false" />` : html`<span class="none">${offline ? 'Camera offline' : 'No picture'}</span>`}
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
          <span class="badge tl"><span class="dot ${offline ? 'off' : recording ? 'rec' : 'live'}"></span>${offline ? 'Offline' : recording ? 'Recording' : 'Live'}</span>
          <span class="badge tr">${new Date(this.tick).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
          ${many
            ? html`<button type="button" class="arrow left" aria-label="Previous camera" @click=${() => this.go(this.index - 1)}>
                  <glass-icon name="chevron-left" size="18" stroke="1.8"></glass-icon>
                </button>
                <button type="button" class="arrow right" aria-label="Next camera" @click=${() => this.go(this.index + 1)}>
                  <glass-icon name="chevron-right" size="18" stroke="1.8"></glass-icon>
                </button>`
            : nothing}
          <span class="foot">
            <span class="last">${this.lastLine(c)}</span>
            <button type="button" class="full" aria-label="Full screen" @click=${() => openMoreInfo(this, c.entity)}>
              <glass-icon name="maximize-2" size="16" stroke="1.8"></glass-icon>
            </button>
          </span>
        </div>
        ${many
          ? html`<div class="pager">
              <span class="dots" role="tablist" aria-label="Cameras">
                ${this.cameras.map(
                  (cc, i) => html`<button
                    type="button"
                    role="tab"
                    class=${i === this.index ? 'current' : ''}
                    aria-selected=${i === this.index ? 'true' : 'false'}
                    aria-label=${cc.name ?? shortName(hass.states[cc.entity], '')}
                    @click=${() => this.go(i)}
                  ></button>`,
                )}
              </span>
              <span class="progress" aria-hidden="true">
                ${this.cycling ? keyed(this.cycleStart, html`<span class="bar"></span>`) : nothing}
              </span>
              <span class="count">${this.cycling ? 'Cycling' : `${this.index + 1} of ${this.cameras.length}`}</span>
            </div>`
          : nothing}
      </div>

      ${many
        ? html`<div class="group">
            <div class="row">
              <span class="text"><span class="n">Cycle cameras</span><span class="sub">Next camera every 10 s, round and round</span></span>
              <button
                type="button"
                role="switch"
                class="switch ${this.cycling ? 'on' : ''}"
                aria-checked=${this.cycling ? 'true' : 'false'}
                aria-label="Cycle cameras"
                @click=${() => {
                  this.cycling = !this.cycling;
                  this.cycleStart = Date.now();
                }}
              >
                <span class="knob"></span>
              </button>
            </div>
          </div>`
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

      <div class="actions">
        ${light
          ? html`<button
              type="button"
              class="light ${lightOn ? 'on' : ''}"
              aria-pressed=${lightOn ? 'true' : 'false'}
              ?disabled=${isUnavailable(light)}
              @click=${() => hass.callService('homeassistant', lightOn ? 'turn_off' : 'turn_on', { entity_id: c.light })}
            >
              <glass-icon name="lightbulb" size="18" stroke="1.7"></glass-icon>${shortName(light, '')} · ${lightOn ? 'On' : 'Off'}
            </button>`
          : nothing}
        <button type="button" class="primary" @click=${() => openMoreInfo(this, c.entity)}>
          <glass-icon name="maximize-2" size="16" stroke="1.8"></glass-icon>Full screen
        </button>
      </div>
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
        background: linear-gradient(160deg, #3a4452 0%, #23282f 60%, #3c4436 100%);
        color: #fff;
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
        color: rgba(255, 255, 255, 0.65);
      }
      .badge {
        position: absolute;
        top: 14px;
        height: 26px;
        padding: 0 10px;
        border-radius: 13px;
        background: rgba(0, 0, 0, 0.45);
        font-size: var(--glass-text-small);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .tl {
        left: 14px;
      }
      .tr {
        right: 14px;
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
      .arrow {
        all: unset;
        position: absolute;
        top: 50%;
        margin-top: -22px;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .arrow.left {
        left: 12px;
      }
      .arrow.right {
        right: 12px;
      }
      .foot {
        position: absolute;
        left: 14px;
        right: 14px;
        bottom: 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .last {
        font-size: var(--glass-text-caption);
        color: rgba(255, 255, 255, 0.85);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
      }
      .full {
        all: unset;
        width: 36px;
        height: 36px;
        flex: none;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .pager {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 4px;
      }
      .dots {
        display: flex;
        gap: 6px;
      }
      .dots button {
        all: unset;
        width: 8px;
        height: 8px;
        border-radius: 4px;
        background: rgba(18, 19, 22, 0.2);
        cursor: pointer;
        transition: width 0.25s ease;
      }
      .dots button.current {
        width: 24px;
        background: var(--glass-ink);
      }
      .progress {
        position: relative;
        flex: 1;
        height: 3px;
        overflow: hidden;
        border-radius: 2px;
        background: rgba(18, 19, 22, 0.1);
      }
      .bar {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 0;
        border-radius: 2px;
        background: var(--glass-ink);
        animation: fill ${CYCLE_MS / 1000}s linear forwards;
      }
      @keyframes fill {
        to {
          width: 100%;
        }
      }
      .count {
        font-size: var(--glass-text-small);
        color: var(--glass-text-muted);
      }
      .group {
        border-radius: var(--glass-radius-tile);
        background: rgba(255, 255, 255, 0.75);
        padding: 6px 16px;
      }
      .row {
        min-height: 56px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .text {
        flex: 1;
        display: flex;
        flex-direction: column;
        line-height: 1.2;
      }
      .n {
        font-size: var(--glass-text-body);
      }
      .sub {
        font-size: var(--glass-text-small);
        color: var(--glass-text-muted);
      }
      .switch {
        all: unset;
        position: relative;
        width: 52px;
        height: 32px;
        flex: none;
        border-radius: 16px;
        background: rgba(18, 19, 22, 0.15);
        cursor: pointer;
        transition: background 0.2s ease;
      }
      .switch.on {
        background: var(--glass-go);
      }
      .knob {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
        transition: left 0.2s ease;
      }
      .switch.on .knob {
        left: 23px;
      }
      .recent {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }
      h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 400;
      }
      .hint {
        font-size: var(--glass-text-caption);
        color: var(--glass-text-muted);
      }
      .clips {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .clip {
        all: unset;
        display: flex;
        flex-direction: column;
        gap: 6px;
        cursor: pointer;
      }
      .thumb {
        position: relative;
        height: 84px;
        overflow: hidden;
        border-radius: var(--glass-radius-inset);
        background: #2a2d33;
      }
      /* A slow drift, so the tiles read as clips rather than flat thumbnails. */
      .pan {
        position: absolute;
        inset: -10px -20px;
        width: calc(100% + 40px);
        height: calc(100% + 20px);
        object-fit: cover;
        background: linear-gradient(120deg, #4a5563, #2a2f36);
        animation: drift 6s ease-in-out infinite;
      }
      @keyframes drift {
        50% {
          transform: translateX(-14px);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .pan,
        .bar {
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
        background: rgba(0, 0, 0, 0.5);
        color: #fff;
        font-size: var(--glass-text-tiny);
        display: flex;
        align-items: center;
      }
      .when {
        padding: 0 2px;
        font-size: var(--glass-text-small);
        color: var(--glass-text-secondary);
      }
      .actions {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
        gap: 10px;
      }
      .actions button {
        all: unset;
        box-sizing: border-box;
        height: 56px;
        border-radius: 28px;
        font-size: var(--glass-text-body);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
      }
      .light {
        background: #fff;
        border: 1px solid var(--glass-hairline);
      }
      .light.on {
        background: linear-gradient(150deg, #fefaf0 0%, #f8ebcb 100%);
        border-color: #f2dfb4;
      }
      .primary {
        background: var(--glass-ink);
        color: #fff;
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

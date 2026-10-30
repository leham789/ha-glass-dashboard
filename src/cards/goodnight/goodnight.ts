import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, fireEvent, isUnavailable, registerCard } from '../../ha.js';
import { roomSummary, shortName } from '../../rooms.js';
import '../../elements/glass-icon.js';
import './goodnight-editor.js';

export interface GoodnightConfig extends LovelaceCardConfig {
  /** Areas whose lights Goodnight turns off. Default: the lowest floor. */
  areas?: string[];
  /** Run this script instead of just switching the lights off, e.g. script.goodnight. */
  script?: string;
  /** Show from this time… (default 22:00) */
  show_after?: string;
  /** …until this time (default 05:00). */
  show_until?: string;
  /** Always show it, whatever the time (handy while setting it up). */
  always_show?: boolean;
}

const OPENINGS = new Set(['door', 'window', 'garage_door', 'opening']);
const CONFIRM_AT = 0.85;

/**
 * Goodnight: shows late in the evening while lights are still on in the
 * chosen rooms or a door is open. Slide to switch those lights off (or run
 * your script); it then says it's done, and tapping undoes it.
 */
@customElement('glass-goodnight')
export class GlassGoodnight extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: GoodnightConfig;
  /** Lights Goodnight switched off, for Undo. Set means "done". */
  @state() private saved?: string[];
  @state() private drag = 0;
  @state() private dragging = false;
  @state() private now = new Date();
  @query('.track') private track?: HTMLElement;

  private timer?: number;
  private startX = 0;
  private lastKey = '';

  static getConfigElement() {
    return document.createElement('glass-goodnight-editor');
  }

  static getStubConfig(): Partial<GoodnightConfig> {
    return { always_show: true };
  }

  setConfig(config: GoodnightConfig): void {
    this.config = config;
  }

  getCardSize(): number {
    return this.visible() ? 4 : 0;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    ensureFonts();
    // The card appears and disappears with the time, so check once a minute.
    this.timer = window.setInterval(() => (this.now = new Date()), 60_000);
  }

  disconnectedCallback(): void {
    window.clearInterval(this.timer);
    super.disconnectedCallback();
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (changed.size > 1 || !changed.has('hass') || !this.hass) return true;
    const key = JSON.stringify(this.summary());
    if (key === this.lastKey) return false;
    this.lastKey = key;
    return true;
  }

  protected updated(): void {
    // Tell HA when the card comes and goes, so its slot in the layout does too
    // (the same signal HA's own conditional cards use).
    const visible = this.visible();
    if (visible === this.hasAttribute('hidden')) {
      this.toggleAttribute('hidden', !visible);
      fireEvent(this, 'card-visibility-changed', { value: visible });
    }
  }

  /** The covered areas: chosen ones, or every area on the lowest floor. */
  private areaIds(): string[] {
    const hass = this.hass!;
    if (this.config?.areas?.length) return this.config.areas;
    const floors = Object.values(hass.floors ?? {}).sort(
      (a, b) => (a.level ?? Number.MAX_SAFE_INTEGER) - (b.level ?? Number.MAX_SAFE_INTEGER),
    );
    const lowest = floors[0]?.floor_id;
    return Object.values(hass.areas ?? {})
      .filter((a) => lowest && a.floor_id === lowest)
      .map((a) => a.area_id);
  }

  private summary() {
    const hass = this.hass!;
    const ids = this.areaIds();
    const lights = ids.flatMap((id) => roomSummary(hass, id).lights);
    const open = Object.keys(hass.states).filter(
      (id) =>
        id.startsWith('binary_sensor.') &&
        !hass.entities?.[id]?.hidden &&
        OPENINGS.has(hass.states[id].attributes.device_class) &&
        hass.states[id].state === 'on',
    );
    return {
      onIds: lights.filter((l) => l.on).map((l) => l.id),
      open: open.map((id) => `${sentence(shortName(hass.states[id], ''))}`),
      place: placeName(hass, ids),
    };
  }

  private inWindow(): boolean {
    if (this.config?.always_show) return true;
    const mins = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + (m || 0);
    };
    const now = this.now.getHours() * 60 + this.now.getMinutes();
    const from = mins(this.config?.show_after ?? '22:00');
    const to = mins(this.config?.show_until ?? '05:00');
    return from <= to ? now >= from && now < to : now >= from || now < to;
  }

  private visible(): boolean {
    if (!this.config || !this.hass) return false;
    if (this.saved) return true;
    const s = this.summary();
    return this.inWindow() && (s.onIds.length > 0 || s.open.length > 0);
  }

  render() {
    if (!this.visible()) return nothing;
    const s = this.summary();
    const done = !!this.saved;
    const openText = s.open.length === 1 ? `${s.open[0]} is still open` : `${s.open.length} doors are still open`;

    const headline = done
      ? `${s.place} lights are off`
      : s.open.length
        ? `Heading to bed? ${openText}`
        : 'Heading to bed?';
    const subline = done
      ? s.open.length
        ? `${openText} · tap to undo`
        : 'Tap the tick to undo'
      : `Turns off ${s.place} lights${s.open.length ? ' and reminds you about open doors' : ''}.`;

    const travel = this.track ? this.track.clientWidth - 68 : 0;
    const x = done ? travel : this.drag * travel;

    return html`
      <section class="card" aria-label="Goodnight">
        <div class="top">
          <div class="text">
            <span class="headline">${headline}</span>
            <span class="subline">${subline}</span>
            <span class="rule"></span>
          </div>
          <div class="count">
            <span class="n">${s.onIds.length}</span>
            <span class="label">${s.onIds.length === 1 ? 'light on' : 'lights on'}</span>
          </div>
        </div>
        <div class="track ${done ? 'done' : ''}">
          <span class="slide-text" style="opacity: ${done ? 1 : 1 - this.drag * 1.4}">
            ${done ? 'Goodnight done' : 'Slide for Goodnight'}
          </span>
          ${done ? nothing : html`<span class="dot" aria-hidden="true"></span>`}
          <button
            type="button"
            class="knob ${this.dragging ? 'dragging' : ''}"
            style="transform: translateX(${x}px)"
            aria-label=${done ? 'Undo Goodnight' : 'Goodnight: turn off the lights'}
            @pointerdown=${this.onDown}
            @pointermove=${this.onMove}
            @pointerup=${this.onUp}
            @pointercancel=${this.onUp}
            @click=${this.onClick}
          >
            <glass-icon name=${done ? 'check' : 'arrow-right'} size="22" stroke="1.8"></glass-icon>
          </button>
        </div>
      </section>
    `;
  }

  private onDown(e: PointerEvent) {
    if (this.saved) return;
    this.dragging = true;
    this.startX = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  private onMove(e: PointerEvent) {
    if (!this.dragging || !this.track) return;
    const travel = this.track.clientWidth - 68;
    this.drag = Math.min(1, Math.max(0, (e.clientX - this.startX) / travel));
  }

  private onUp() {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.drag >= CONFIRM_AT) this.goodnight();
    this.drag = 0;
  }

  // Pointer users must slide; a keyboard press (Enter/Space, detail 0) confirms directly.
  // Once done, a tap or key press undoes.
  private onClick(e: MouseEvent) {
    if (this.saved) this.undo();
    else if (e.detail === 0) this.goodnight();
  }

  private goodnight() {
    const hass = this.hass!;
    const ids = this.summary().onIds.filter((id) => !isUnavailable(hass.states[id]));
    this.saved = ids;
    if (this.config?.script) {
      hass.callService('script', 'turn_on', { entity_id: this.config.script });
    } else if (ids.length) {
      hass.callService('light', 'turn_off', { entity_id: ids });
    }
  }

  private undo() {
    if (this.saved?.length) this.hass!.callService('light', 'turn_on', { entity_id: this.saved });
    this.saved = undefined;
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
        box-sizing: border-box;
        padding: 24px var(--glass-space-edge) var(--glass-space-edge);
        border-radius: var(--glass-radius-card);
        background: var(--glass-surface);
        border: 1px solid var(--glass-surface-border);
        box-shadow: 0 20px 50px rgba(60, 40, 110, 0.1);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
      }
      .text {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .headline {
        font-size: var(--glass-text-tile-title);
        line-height: 1.3;
      }
      .subline {
        font-size: var(--glass-text-chip);
        color: var(--glass-text-muted);
      }
      .rule {
        width: 70%;
        height: 1px;
        margin-top: 8px;
        background: rgba(18, 19, 22, 0.15);
      }
      .count {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .n {
        font-size: 56px;
        font-weight: 200;
        line-height: 1;
      }
      .label {
        font-size: var(--glass-text-caption);
        color: var(--glass-text-muted);
        white-space: nowrap;
      }
      .track {
        position: relative;
        box-sizing: border-box;
        height: 68px;
        padding: 6px;
        border-radius: 34px;
        background: rgba(18, 19, 22, 0.06);
        display: flex;
        align-items: center;
        user-select: none;
        -webkit-user-select: none;
      }
      .slide-text {
        flex: 1;
        padding-left: 68px;
        font-size: var(--glass-text-body);
        color: var(--glass-text-secondary);
      }
      .done .slide-text {
        padding-left: 18px;
      }
      .dot {
        width: 8px;
        height: 8px;
        margin-right: 18px;
        border-radius: 50%;
        background: var(--glass-go);
      }
      .knob {
        all: unset;
        position: absolute;
        left: 6px;
        top: 6px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--glass-go);
        color: #fff;
        box-shadow: 0 8px 20px rgba(47, 180, 87, 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
        touch-action: none;
        -webkit-tap-highlight-color: transparent;
        transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      .knob.dragging {
        cursor: grabbing;
        transition: none;
      }
      .done .knob {
        cursor: pointer;
        box-shadow: none;
      }
      .knob:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 3px;
      }
      @media (prefers-reduced-motion: reduce) {
        .knob {
          transition: none;
        }
      }
    `,
  ];
}

/**
 * What the covered areas are called: a floor's name when all of that floor's
 * areas are included ("Downstairs and Office"), otherwise the area names.
 */
function placeName(hass: HomeAssistant, ids: string[]): string {
  const chosen = new Set(ids);
  const parts: string[] = [];
  const used = new Set<string>();
  for (const floor of Object.values(hass.floors ?? {})) {
    const areas = Object.values(hass.areas ?? {}).filter((a) => a.floor_id === floor.floor_id);
    if (areas.length && areas.every((a) => chosen.has(a.area_id))) {
      parts.push(floor.name);
      areas.forEach((a) => used.add(a.area_id));
    }
  }
  for (const id of ids) if (!used.has(id)) parts.push(hass.areas?.[id]?.name ?? id);
  if (!parts.length) return 'The chosen rooms';
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

registerCard({
  type: 'glass-goodnight',
  name: 'Glass · Goodnight',
  description: 'Late-evening slide to switch off the downstairs lights, with undo.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-goodnight': GlassGoodnight;
  }
}

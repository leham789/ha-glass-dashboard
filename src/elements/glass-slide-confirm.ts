import { LitElement, css, html, nothing, unsafeCSS } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { EASE, haptic } from '../motion.js';
import './glass-icon.js';

const CONFIRM_AT = 0.85;
/** Below this width the words go and the track keeps just the knob and the dot. */
const COMPACT_BELOW = 200;

/**
 * Slide to confirm (Library: Slide to confirm): for an action that changes a
 * lot at once, so a stray tap can't do it. Drag the green knob to the end and
 * let go; it fires `confirm`. The card then sets `done`, and the knob rests at
 * the end as a tick: a tap fires `undo`. A keyboard press confirms directly.
 * Always its card's full width; narrow, the words go.
 */
@customElement('glass-slide-confirm')
export class GlassSlideConfirm extends LitElement {
  /** The words on the track ("Slide for Goodnight"). */
  @property() prompt = '';
  /** The words once done ("Goodnight done"). */
  @property({ attribute: 'done-text' }) doneText = '';
  /** What the knob does, for screen readers. */
  @property() label = '';
  @property({ attribute: 'undo-label' }) undoLabel = 'Undo';
  @property({ type: Boolean, reflect: true }) done = false;
  @property({ type: Boolean, reflect: true }) compact = false;
  @state() private drag = 0;
  @state() private dragging = false;
  @state() private width = 0;
  @query('.track') private track?: HTMLElement;
  private startX = 0;
  private size = new ResizeObserver(([entry]) => {
    this.width = entry.contentRect.width;
    this.compact = this.width > 0 && this.width < COMPACT_BELOW;
  });

  connectedCallback(): void {
    super.connectedCallback();
    this.size.observe(this);
  }

  disconnectedCallback(): void {
    this.size.disconnect();
    super.disconnectedCallback();
  }

  private get travel(): number {
    return Math.max(0, (this.track?.clientWidth ?? this.width) - 68);
  }

  render() {
    const x = this.done ? this.travel : this.drag * this.travel;
    return html`<div class="track ${this.done ? 'done' : ''}">
      ${this.compact
        ? nothing
        : html`<span class="words" style="opacity: ${this.done ? 1 : Math.max(0, 1 - this.drag * 1.4)}">${this.done ? this.doneText : this.prompt}</span>`}
      ${this.done ? nothing : html`<span class="dot" aria-hidden="true"></span>`}
      <button
        type="button"
        class="knob ${this.dragging ? 'dragging' : ''}"
        data-no-press
        style="transform: translateX(${x}px)"
        aria-label=${this.done ? this.undoLabel : this.label}
        @pointerdown=${this.onDown}
        @pointermove=${this.onMove}
        @pointerup=${this.onUp}
        @pointercancel=${this.onUp}
        @click=${this.onClick}
      >
        <glass-icon name=${this.done ? 'check' : 'arrow-right'} size="22" stroke="1.8"></glass-icon>
      </button>
    </div>`;
  }

  private onDown(e: PointerEvent) {
    if (this.done) return;
    this.dragging = true;
    this.startX = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  private onMove(e: PointerEvent) {
    if (!this.dragging || !this.travel) return;
    const drag = Math.min(1, Math.max(0, (e.clientX - this.startX) / this.travel));
    // A bump as the knob reaches the point where letting go confirms.
    if (drag >= CONFIRM_AT && this.drag < CONFIRM_AT) haptic('medium');
    this.drag = drag;
  }

  private onUp() {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.drag >= CONFIRM_AT) this.fire('confirm');
    this.drag = 0;
  }

  // Pointer users must slide; a keyboard press (Enter/Space, detail 0) confirms directly.
  // Once done, a tap or key press undoes.
  private onClick(e: MouseEvent) {
    if (this.done) this.fire('undo');
    else if (e.detail === 0) this.fire('confirm');
  }

  private fire(name: 'confirm' | 'undo') {
    this.dispatchEvent(new Event(name, { bubbles: true, composed: true }));
  }

  static styles = css`
    :host {
      display: block;
    }
    .track {
      position: relative;
      box-sizing: border-box;
      height: 68px;
      padding: 8px;
      border-radius: 34px;
      background: rgba(var(--glass-line-rgb), 0.06);
      display: flex;
      align-items: center;
      user-select: none;
      -webkit-user-select: none;
    }
    :host([compact]) .track {
      justify-content: flex-end;
    }
    .words {
      flex: 1;
      min-width: 0;
      padding-left: 68px;
      font-size: var(--glass-text-body);
      color: var(--glass-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .done .words {
      padding-left: 20px;
    }
    .dot {
      width: 8px;
      height: 8px;
      flex: none;
      margin-right: 20px;
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
      color: var(--glass-on-go);
      box-shadow: var(--glass-go-shadow);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
      transition: transform 0.3s ${unsafeCSS(EASE)};
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
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-slide-confirm': GlassSlideConfirm;
  }
}

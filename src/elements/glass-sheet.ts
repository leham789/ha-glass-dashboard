import { css, html, type CSSResultGroup, type TemplateResult } from 'lit';
import { GlassElement, openOverlays } from '../glass-element.js';
import { property, state } from 'lit/decorators.js';
import { tokens } from '../tokens.js';
import { haptic } from '../motion.js';
import type { HomeAssistant } from '../ha.js';
import type { IconName } from '../icons.js';
import './glass-icon.js';

/**
 * A pop-up sheet that slides up over the screen: handle, an icon + title
 * pill, a round close button, then the sheet's own content.
 *
 * Sheets are added to <body> rather than drawn inside a card, so nothing in
 * HA's layout can clip them. Use `GlassSheet.open(tag, hass)` to show one;
 * the opener keeps its `hass` current until it closes.
 *
 * Swipe it away like an iOS sheet: drag down by the top bar, or anywhere on
 * it while its content is scrolled to the top (a pull-down past the top turns
 * into closing). It follows the finger and the dim behind it lightens as it
 * goes; let go past a quarter of its height, or with a downward flick, and it
 * closes, otherwise it settles back. Dragged up, it gives a little and returns.
 */
export abstract class GlassSheet extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private shown = false;
  /** A drag in progress: where it started, and recent finger positions for the flick speed. */
  private drag?: { from: number; at: { y: number; t: number }[] };
  /** A touch on the content that may become a drag once it's clearly a pull down from the top. */
  private pull?: { x: number; y: number };

  protected abstract sheetTitle: string;
  /** A second line under the title, e.g. the room. */
  protected get sheetSubtitle(): string {
    return '';
  }
  protected abstract sheetIcon: IconName;
  protected sheetIconBg = 'var(--glass-accent)';
  protected abstract renderBody(): TemplateResult;

  /** The round icon in the title pill. A sheet can draw its own (a person's picture). */
  protected renderIcon(): TemplateResult {
    return html`<span class="icon" style="background: ${this.sheetIconBg}">
      <glass-icon name=${this.sheetIcon} size="20" stroke="1.7"></glass-icon>
    </span>`;
  }

  static open<T extends GlassSheet>(tag: string, hass: HomeAssistant): T {
    const sheet = document.createElement(tag) as T;
    sheet.hass = hass;
    document.body.appendChild(sheet);
    haptic('light');
    return sheet;
  }

  connectedCallback(): void {
    super.connectedCallback();
    openOverlays.add(this);
    document.addEventListener('keydown', this.onKey);
    document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      this.shown = true;
      // Focus the dialog itself so screen readers land in it and Tab starts there,
      // without drawing a focus ring on the close button for touch users.
      this.renderRoot.querySelector<HTMLElement>('.sheet')?.focus({ preventScroll: true });
    });
  }

  disconnectedCallback(): void {
    openOverlays.delete(this);
    document.removeEventListener('keydown', this.onKey);
    document.documentElement.style.overflow = '';
    super.disconnectedCallback();
  }

  close(): void {
    this.shown = false;
    setTimeout(() => this.remove(), 250);
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.close();
  };

  private get sheetEl(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.sheet');
  }

  private get backdropEl(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.backdrop');
  }

  protected firstUpdated(): void {
    // Touch listeners on the content, not passive, so a pull down from the top can stop
    // the content scrolling and move the sheet instead.
    const scroll = this.renderRoot.querySelector<HTMLElement>('.scroll')!;
    scroll.addEventListener('touchstart', this.onPullStart, { passive: true });
    scroll.addEventListener('touchmove', this.onPullMove, { passive: false });
    scroll.addEventListener('touchend', this.onPullEnd);
    scroll.addEventListener('touchcancel', this.onPullEnd);
  }

  private dragBegin(y: number) {
    this.drag = { from: y, at: [{ y, t: performance.now() }] };
  }

  /** The sheet follows the finger with no easing; the dim lightens as it goes down. */
  private dragTo(y: number) {
    const sheet = this.sheetEl;
    const drag = this.drag;
    if (!sheet || !drag) return;
    const now = performance.now();
    drag.at.push({ y, t: now });
    while (drag.at.length > 2 && now - drag.at[0].t > 100) drag.at.shift();
    const dy = y - drag.from;
    // Up, it gives a little (at most 20px) and resists the further you go.
    const offset = dy >= 0 ? dy : -Math.min(20, Math.sqrt(-dy) * 2);
    sheet.style.transition = 'none';
    sheet.style.transform = `translate(-50%, ${offset}px)`;
    const backdrop = this.backdropEl;
    if (backdrop) {
      backdrop.style.transition = 'none';
      backdrop.style.opacity = String(1 - Math.min(1, Math.max(0, offset) / sheet.offsetHeight));
    }
  }

  private dragEnd() {
    const sheet = this.sheetEl;
    const drag = this.drag;
    this.drag = undefined;
    if (!sheet || !drag) return;
    const last = drag.at[drag.at.length - 1];
    const first = drag.at[0];
    const dy = last.y - drag.from;
    // How fast the finger was going at the end, in px per ms (down is positive).
    const speed = (last.y - first.y) / Math.max(1, last.t - first.t);
    // Hand back to the stylesheet, which eases on from here: closed, or back in place.
    sheet.style.transition = '';
    sheet.style.transform = '';
    const backdrop = this.backdropEl;
    if (backdrop) {
      backdrop.style.transition = '';
      backdrop.style.opacity = '';
    }
    if (dy > sheet.offsetHeight / 4 || (dy > 10 && speed > 0.5)) this.close();
  }

  // The top bar: a drag from anywhere on it but the close button.
  private onDragStart(e: PointerEvent) {
    if (e.button !== 0 || (e.target as Element).closest('button')) return;
    this.dragBegin(e.clientY);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  private onDragMove(e: PointerEvent) {
    if (this.drag) this.dragTo(e.clientY);
  }

  private onDragEnd() {
    if (this.drag) this.dragEnd();
  }

  // The content: a touch becomes a drag once it's clearly heading down while the
  // content is at its top. Sideways, upwards, or on a slider, it's left alone.
  private onPullStart = (e: TouchEvent) => {
    const t = e.touches[0];
    const onSlider = (e.target as Element).closest?.('input[type="range"]');
    this.pull = e.touches.length === 1 && !onSlider ? { x: t.clientX, y: t.clientY } : undefined;
  };

  private onPullMove = (e: TouchEvent) => {
    const t = e.touches[0];
    if (this.drag) {
      e.preventDefault();
      this.dragTo(t.clientY);
      return;
    }
    const pull = this.pull;
    if (!pull) return;
    const dx = t.clientX - pull.x;
    const dy = t.clientY - pull.y;
    const atTop = (e.currentTarget as HTMLElement).scrollTop <= 0;
    if (dy > 6 && dy > Math.abs(dx) && atTop) {
      e.preventDefault();
      this.pull = undefined;
      this.dragBegin(t.clientY);
    } else if (Math.abs(dx) > 6 || dy < -6) {
      this.pull = undefined;
    }
  };

  private onPullEnd = () => {
    this.pull = undefined;
    if (this.drag) this.dragEnd();
  };

  render() {
    return html`
      <div class="backdrop ${this.shown ? 'shown' : ''}" @click=${() => this.close()}></div>
      <section
        class="sheet ${this.shown ? 'shown' : ''}"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        aria-labelledby="title"
      >
        <!-- stays at the top while the rest scrolls under it; drag it down to close -->
        <div
          class="sheet-top"
          @pointerdown=${this.onDragStart}
          @pointermove=${this.onDragMove}
          @pointerup=${this.onDragEnd}
          @pointercancel=${this.onDragEnd}
        >
          <span class="handle" aria-hidden="true"></span>
          <header>
            <span class="title">
              ${this.renderIcon()}
              <span class="names">
                <h1 id="title">${this.sheetTitle}</h1>
                ${this.sheetSubtitle ? html`<span class="subtitle">${this.sheetSubtitle}</span>` : ''}
              </span>
            </span>
            <button type="button" class="close" aria-label="Close" @click=${() => this.close()}>
              <glass-icon name="x" size="22" stroke="1.8"></glass-icon>
            </button>
          </header>
        </div>
        <div class="scroll">${this.renderBody()}</div>
      </section>
    `;
  }

  static styles: CSSResultGroup = [
    tokens,
    css`
      :host {
        position: fixed;
        inset: 0;
        z-index: 10;
      }
      .backdrop {
        position: absolute;
        inset: 0;
        background: rgba(var(--glass-line-rgb), 0.25);
        opacity: 0;
        transition: opacity 0.25s ease;
      }
      .backdrop.shown {
        opacity: 1;
      }
      .sheet {
        position: absolute;
        left: 50%;
        bottom: 0;
        box-sizing: border-box;
        width: 100%;
        max-width: 480px;
        max-height: calc(100% - 54px);
        overflow: hidden;
        border-radius: var(--glass-radius-sheet) var(--glass-radius-sheet) 0 0;
        background: var(--glass-sheet);
        border-top: 1px solid var(--glass-surface-border);
        box-shadow: 0 -20px 60px rgba(20, 20, 40, 0.15);
        backdrop-filter: blur(30px);
        -webkit-backdrop-filter: blur(30px);
        display: flex;
        flex-direction: column;
        /* the top bar's height: handle (10 + 5) + gap 18 + title 64 */
        --bar: 97px;
        transform: translate(-50%, 100%);
        transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      .sheet.shown {
        transform: translate(-50%, 0);
      }
      .sheet:focus {
        outline: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .sheet,
        .backdrop {
          transition: none;
        }
      }
      /* not ".top": sheets use that for their own rows */
      .sheet-top {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        z-index: 1;
        padding: 10px var(--glass-space-edge) 0;
        display: flex;
        flex-direction: column;
        gap: 18px;
        touch-action: none; /* the drag is ours, not the page's scroll */
        /* no band behind it: the handle, title and close float over what scrolls under,
           and taps between them reach the content */
        pointer-events: none;
      }
      .sheet-top > * {
        pointer-events: auto;
      }
      /* Everything below the top bar scrolls here, starting just under it. Apple's soft
         scroll edge: content fades out as it scrolls up towards the title and close, so
         the sheet itself shows behind them; nothing is painted over it, so nothing behind
         the bar changes. At rest the content starts below the fade. */
      .scroll {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        box-sizing: border-box;
        padding: calc(var(--bar) + 18px) var(--glass-space-edge) calc(40px + env(safe-area-inset-bottom, 0px));
        display: flex;
        flex-direction: column;
        gap: 18px;
        -webkit-mask-image: linear-gradient(to bottom, transparent calc(var(--bar) - 12px), #000 calc(var(--bar) + 18px));
        mask-image: linear-gradient(to bottom, transparent calc(var(--bar) - 12px), #000 calc(var(--bar) + 18px));
      }
      .title,
      .close {
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
      }
      .handle {
        align-self: center;
        width: 40px;
        height: 5px;
        border-radius: 3px;
        background: rgba(var(--glass-line-rgb), 0.18);
      }
      header {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .title {
        flex: 1;
        min-width: 0;
        height: 64px;
        box-sizing: border-box;
        padding: 0 8px;
        border-radius: 32px;
        background: rgba(var(--glass-surface-rgb), 0.85);
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .icon {
        flex: none;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        color: #121316; /* pastel circle in both themes */
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .names {
        min-width: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.2;
      }
      h1 {
        margin: 0;
        font-size: 20px;
        font-weight: 400;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .subtitle {
        font-size: var(--glass-text-small);
        color: var(--glass-text-muted);
      }
      .close {
        all: unset;
        width: 64px;
        height: 64px;
        flex: none;
        border-radius: 50%;
        background: rgba(var(--glass-surface-rgb), 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .close:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
    `,
  ];
}

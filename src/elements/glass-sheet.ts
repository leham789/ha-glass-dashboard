import { css, html, type CSSResultGroup, type TemplateResult } from 'lit';
import { GlassElement, openOverlays } from '../glass-element.js';
import { property, state } from 'lit/decorators.js';
import { tokens } from '../tokens.js';
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
 */
export abstract class GlassSheet extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private shown = false;

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
        ${this.renderBody()}
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
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 10px var(--glass-space-edge) calc(40px + env(safe-area-inset-bottom, 0px));
        border-radius: var(--glass-radius-sheet) var(--glass-radius-sheet) 0 0;
        background: var(--glass-sheet);
        border-top: 1px solid var(--glass-surface-border);
        box-shadow: 0 -20px 60px rgba(20, 20, 40, 0.15);
        backdrop-filter: blur(30px);
        -webkit-backdrop-filter: blur(30px);
        display: flex;
        flex-direction: column;
        gap: 18px;
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

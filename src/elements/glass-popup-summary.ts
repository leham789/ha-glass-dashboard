import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { NumberSize } from './glass-number.js';
import './glass-number.js';

/**
 * Pop-up summary (Library: Sheet): the reading at the top of a pop-up's
 * content, straight under the title pill. The big number or word (a Display
 * number, its unit 8 after it), a grey `line` under it, and on the right one
 * thing in the default slot: a Status pill, a switch, the pop-up's main
 * action or a grey note (`note`). Everything is bottom-aligned.
 *
 * `value` empty: the grey dash. `loading`: soft bars while it waits for history. `grey`: a reading that's gone quiet keeps its
 * value, greyed. `label` goes above the number instead (the Room
 * temperatures pop-up's "House average", at Display S).
 */
@customElement('glass-popup-summary')
export class GlassPopupSummary extends LitElement {
  @property() value = '';
  @property() unit = '';
  @property() line = '';
  @property() label = '';
  @property() note = '';
  @property({ type: Boolean }) grey = false;
  @property() size: NumberSize = 'display';
  /** While its reading waits for history: soft bars this wide for the number, and for the line. */
  @property({ type: Number }) loading?: number;

  render() {
    return html`<span class="l">
        ${this.label ? html`<span class="label">${this.label}</span>` : nothing}
        <glass-number size=${this.size} .value=${this.value} unit=${this.unit} ?grey=${this.grey} .loading=${this.loading}></glass-number>
        ${this.line ? html`<span class="line">${this.line}</span>` : this.loading ? html`<span class="skel"></span>` : nothing}
      </span>
      <span class="r">${this.note ? html`<span class="note">${this.note}</span>` : nothing}<slot></slot></span>`;
  }

  static styles = css`
    :host {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
      font-family: var(--glass-font);
      color: var(--glass-ink);
    }
    .l {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }
    .label {
      font-size: var(--glass-text-chip);
      color: var(--glass-text-muted);
    }
    .line,
    .note {
      font-size: var(--glass-text-caption);
      color: var(--glass-text-muted);
    }
    .skel {
      display: block;
      width: 180px;
      height: 12px;
      margin: 4px 0;
      border-radius: 8px;
      background: var(--glass-skel, rgba(var(--glass-line-rgb), 0.08));
    }
    .r {
      flex: none;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 12px;
      padding-bottom: 8px;
    }
    .note {
      text-align: right;
      line-height: 1.45;
      white-space: pre-line;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-popup-summary': GlassPopupSummary;
  }
}

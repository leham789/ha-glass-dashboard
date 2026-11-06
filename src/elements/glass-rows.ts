import { LitElement, css, html, nothing, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { IconName } from '../icons.js';
import { EASE } from '../motion.js';
import './glass-icon.js';

/**
 * Rows (Library: Surfaces and lists). Nested parts: no copy of the tokens
 * here, every value comes down from the card.
 */

/**
 * Pill row: 64 high, radius 32, 8 apart in a list.
 *  glass: on a screen (Power switches), 20 in on the left.
 *  solid: in a pop-up or card (Not reporting, the Light row), 12 in.
 * `icon` adds the 44 circle; `name` and `line` stack; `state` sits on the right
 * (Caption 13), `value` too (Body 15, grey: a last reading); anything slotted
 * goes last (a Switch). `fill` (0–100) draws a fill behind from the left, in
 * `fill-bg` (the Light row's brightness). `button` makes the whole row a button.
 */
@customElement('glass-pill-row')
export class GlassPillRow extends LitElement {
  @property({ reflect: true }) look: 'glass' | 'solid' = 'solid';
  @property() icon?: IconName;
  /** The circle in its "on" look (a lit Light row). */
  @property({ type: Boolean, attribute: 'icon-on' }) iconOn = false;
  @property() name = '';
  @property() line = '';
  @property() state = '';
  @property() value = '';
  @property({ type: Number }) fill?: number;
  @property({ attribute: 'fill-bg' }) fillBg = 'var(--glass-light-fill)';
  @property({ type: Boolean, reflect: true }) faded = false;
  @property({ type: Boolean }) button = false;
  @property({ type: Boolean }) disabled = false;
  /** aria-pressed, for a row that switches something (the Light row). */
  @property({ type: Boolean }) pressed?: boolean;
  @property() label = '';

  static styles = css`
    :host {
      display: block;
      min-width: 0;
      font-family: var(--glass-font);
    }
    .pr {
      all: unset;
      position: relative;
      overflow: hidden;
      box-sizing: border-box;
      width: 100%;
      height: 64px;
      border-radius: 32px;
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--glass-ink);
      -webkit-tap-highlight-color: transparent;
    }
    button.pr {
      cursor: pointer;
    }
    button.pr:disabled {
      cursor: default;
    }
    button.pr:focus-visible {
      outline: 2px solid var(--glass-ink);
      outline-offset: 2px;
    }
    :host([look='glass']) .pr {
      padding: 0 16px 0 var(--glass-space-edge);
      background: var(--glass-surface);
      border: 1px solid var(--glass-surface-border);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }
    :host([look='solid']) .pr {
      padding: 0 16px 0 12px;
      background: var(--glass-solid);
      border: 1px solid var(--glass-hairline);
    }
    :host([faded]) .pr {
      opacity: 0.5;
    }
    .fill {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      border-radius: 32px;
      transition: width 0.4s ${unsafeCSS(EASE)};
    }
    .ic,
    .tx,
    .state,
    .value,
    slot {
      position: relative; /* above the fill */
    }
    .ic {
      width: 44px;
      height: 44px;
      flex: none;
      border-radius: 50%;
      background: var(--glass-neutral-tint);
      color: var(--glass-text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ic.on {
      background: rgba(var(--glass-surface-rgb), 0.75);
      color: var(--glass-ink);
    }
    .tx {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      line-height: 1.25;
    }
    .n,
    .sub {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .n {
      font-size: var(--glass-text-body);
    }
    .sub {
      font-size: var(--glass-text-small);
      color: var(--glass-text-muted);
    }
    .state {
      flex: none;
      font-size: var(--glass-text-caption);
      color: var(--glass-text-secondary);
      white-space: nowrap;
    }
    .value {
      flex: none;
      font-size: var(--glass-text-body);
      color: var(--glass-text-muted);
      white-space: nowrap;
    }
    slot {
      display: contents;
    }
    @media (prefers-reduced-motion: reduce) {
      .fill {
        transition: none;
      }
    }
  `;

  render() {
    const inner = html`${this.fill !== undefined ? html`<span class="fill" style="width: ${this.fill}%; background: ${this.fillBg}"></span>` : nothing}
      ${this.icon ? html`<span class="ic ${this.iconOn ? 'on' : ''}"><glass-icon name=${this.icon} size="18"></glass-icon></span>` : nothing}
      <span class="tx"><span class="n">${this.name}</span>${this.line ? html`<span class="sub">${this.line}</span>` : nothing}</span>
      ${this.state ? html`<span class="state">${this.state}</span>` : nothing}
      ${this.value ? html`<span class="value">${this.value}</span>` : nothing}
      <slot></slot>`;
    return this.button
      ? html`<button type="button" class="pr" ?disabled=${this.disabled} aria-pressed=${this.pressed === undefined ? nothing : String(this.pressed)} aria-label=${this.label || nothing}>${inner}</button>`
      : html`<div class="pr">${inner}</div>`;
  }
}

/** A group of rows: radius 28, glass at 75%, the rows 56 high with a hairline between. A `heading` sits inside, on top. */
@customElement('glass-row-group')
export class GlassRowGroup extends LitElement {
  @property() heading = '';
  @property() count = '';

  static styles = css`
    :host {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      border-radius: var(--glass-radius-tile);
      background: rgba(var(--glass-surface-rgb), 0.75);
      padding: 8px 16px;
      font-family: var(--glass-font);
      color: var(--glass-ink);
    }
    :host([heading]:not([heading=''])) {
      padding: 16px 16px 8px;
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      padding-bottom: 4px;
    }
    h2 {
      margin: 0;
      font-size: var(--glass-text-heading);
      font-weight: 400;
    }
    .count {
      font-size: var(--glass-text-caption);
      color: var(--glass-text-muted);
    }
  `;

  render() {
    return html`${this.heading ? html`<span class="top"><h2>${this.heading}</h2>${this.count ? html`<span class="count">${this.count}</span>` : nothing}</span>` : nothing}<slot></slot>`;
  }
}

/** One grouped row: 56, `name` over `line` (`warn` turns the line attention), `value` on the right, then anything slotted (a Switch). */
@customElement('glass-grouped-row')
export class GlassGroupedRow extends LitElement {
  @property() name = '';
  @property() line = '';
  @property({ type: Boolean }) warn = false;
  @property() value = '';
  @property({ type: Boolean, reflect: true }) faded = false;

  static styles = css`
    :host {
      box-sizing: border-box;
      min-height: 56px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-top: 1px solid rgba(var(--glass-line-rgb), 0.07);
    }
    :host(:first-of-type) {
      border-top: none;
    }
    :host([faded]) {
      opacity: 0.5;
    }
    .tx {
      flex: 1;
      min-width: 0;
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
    .sub.warn {
      color: var(--glass-attention-ink);
    }
    .v {
      font-size: var(--glass-text-caption);
      color: var(--glass-text-secondary);
      text-align: right;
    }
  `;

  render() {
    return html`<span class="tx"><span class="n">${this.name}</span>${this.line ? html`<span class="sub ${this.warn ? 'warn' : ''}">${this.line}</span>` : nothing}</span>
      ${this.value ? html`<span class="v">${this.value}</span>` : nothing}<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-pill-row': GlassPillRow;
    'glass-row-group': GlassRowGroup;
    'glass-grouped-row': GlassGroupedRow;
  }
}

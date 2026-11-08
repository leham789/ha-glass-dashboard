import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export type NumberSize = 'hero' | 'display' | 'display-s' | 'dial' | 'dial-s' | 'stat-l' | 'stat-m' | 'stat-s' | 'small';

/**
 * Number and unit (Library: Numbers and meters): a thin value and a lighter,
 * smaller unit, in one of nine sizes from the Type frame. Thin 200 for the
 * big ones (hero, display, dial), Light 300 for stats. After a big number the
 * unit is grey and smaller; after a stat it's Body 15 in the same colour.
 * Degrees and percent stay part of the value; a word ("on of 17", "W") is the unit.
 *
 * `value` empty (or `nil`): no reading, the short grey dash and no unit.
 * `loading` (a width in px): a soft bar the size of the number, while a card
 * waits for history. `grey`: a reading that's gone quiet keeps its value,
 * greyed. `dec`: a part after the value in grey at the same size (the Home
 * header's ".4°").
 */
@customElement('glass-number')
export class GlassNumber extends LitElement {
  @property({ reflect: true }) size: NumberSize = 'display';
  @property() value = '';
  @property() unit = '';
  @property() dec = '';
  @property({ type: Boolean }) nil = false;
  @property({ type: Boolean, reflect: true }) grey = false;
  @property({ type: Number }) loading?: number;
  /** A word unit after a hero number ("312 W") sits 8 after it, like the other sizes; "/3 on" doesn't. */
  @property({ type: Boolean, reflect: true }) spaced = false;

  render() {
    if (this.loading) return html`<span class="skel" style="width: ${this.loading}px"></span>`;
    // Something else in the number's place (the Thermostat dial's rolling digits) goes in as a child.
    if (!this.nil && this.value === '' && this.childNodes.length) return html`<slot></slot>`;
    if (this.nil || this.value === '') return html`<i class="nil" role="img" aria-label="No reading"></i>`;
    return html`<span class="v">${this.value}</span>${this.dec ? html`<span class="dec">${this.dec}</span>` : nothing}${this.unit
        ? html`<span class="unit">${this.unit}</span>`
        : nothing}`;
  }

  static styles = css`
    :host {
      --n: var(--glass-number-display);
      --u: var(--glass-number-unit);
      display: inline-flex;
      align-items: baseline;
      font-family: var(--glass-font);
      font-size: var(--n);
      font-weight: 200;
      letter-spacing: -3px;
      line-height: 1.05;
      white-space: nowrap;
    }
    :host([size='hero']) {
      --n: var(--glass-number-hero);
      --u: var(--glass-number-unit-hero);
      letter-spacing: -4px;
    }
    :host([size='display-s']) {
      --n: var(--glass-number-display-s);
    }
    :host([size='dial']) {
      --n: var(--glass-number-dial);
      letter-spacing: -2px;
    }
    :host([size='dial-s']) {
      --n: var(--glass-number-dial-s);
      letter-spacing: -2px;
    }
    :host([size^='stat']),
    :host([size='small']) {
      font-weight: 300;
      --u: var(--glass-text-body);
    }
    :host([size='stat-l']) {
      --n: var(--glass-number-stat-l);
      letter-spacing: -1.5px;
    }
    :host([size='stat-m']) {
      --n: var(--glass-number-stat-m);
      letter-spacing: -1px;
    }
    :host([size='stat-s']) {
      --n: var(--glass-number-stat-s);
      letter-spacing: 0;
    }
    :host([size='small']) {
      --n: var(--glass-number-small);
      --u: var(--glass-number-small);
      letter-spacing: 0;
    }
    :host([grey]) {
      color: var(--glass-text-muted);
    }
    .dec {
      color: var(--glass-grey);
    }
    .unit {
      font-size: var(--u);
      font-weight: 300;
      letter-spacing: 0;
      margin-left: 8px;
      color: var(--glass-text-muted);
    }
    :host([size='hero']) .unit {
      font-weight: 200;
      margin-left: 0;
    }
    :host([size='hero'][spaced]) .unit {
      margin-left: 8px;
    }
    :host([size^='stat']) .unit,
    :host([size='small']) .unit {
      margin-left: 4px;
      color: inherit;
    }
    .nil {
      display: inline-block;
      width: 0.5em;
      height: max(2px, 0.05em);
      border-radius: 1px;
      background: var(--glass-text-muted);
      vertical-align: 0.33em;
      align-self: center;
    }
    .skel {
      display: block;
      height: calc(var(--n) * 0.78);
      margin: calc(var(--n) * 0.14) 0 calc(var(--n) * 0.13);
      border-radius: 8px;
      background: var(--glass-skel, rgba(var(--glass-line-rgb), 0.08));
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-number': GlassNumber;
  }
}

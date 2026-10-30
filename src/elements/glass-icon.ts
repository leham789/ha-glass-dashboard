import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { ICONS, type IconName } from '../icons.js';

/** A Lucide icon from the design's icon set. Colour follows `color`. */
@customElement('glass-icon')
export class GlassIcon extends LitElement {
  @property() name: IconName = 'lightbulb';
  @property({ type: Number }) size = 20;
  @property({ type: Number }) stroke = 1.6;
  /** Fill the shape too, for solid icons such as play and pause. */
  @property({ type: Boolean }) solid = false;

  static styles = css`
    :host {
      display: inline-flex;
      line-height: 0;
    }
  `;

  render() {
    return html`<svg
      width=${this.size}
      height=${this.size}
      viewBox="0 0 24 24"
      fill=${this.solid ? 'currentColor' : 'none'}
      stroke="currentColor"
      stroke-width=${this.stroke}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      ${unsafeSVG(ICONS[this.name] ?? '')}
    </svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-icon': GlassIcon;
  }
}

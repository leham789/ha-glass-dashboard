import { LitElement, css, html, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { roll } from '../motion.js';

/**
 * A number that rolls to its new value: up from below when it goes up, down
 * from above when it goes down. Shows `text` (e.g. "20.5°"); `value` is the
 * number behind it, used only for the direction.
 */
@customElement('glass-roll')
export class GlassRoll extends LitElement {
  @property() text = '';
  @property({ type: Number }) value?: number;

  protected updated(changed: PropertyValues): void {
    const old = changed.get('value') as number | undefined;
    if (old === undefined || this.value === undefined || old === this.value) return;
    const span = this.renderRoot.querySelector('span');
    if (span) roll(span, this.value > old);
  }

  render() {
    return html`<span>${this.text}</span>`;
  }

  static styles = css`
    :host {
      display: inline-block;
      overflow: hidden;
      vertical-align: bottom;
    }
    span {
      display: inline-block;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-roll': GlassRoll;
  }
}

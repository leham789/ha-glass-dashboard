import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { IconName } from '../icons.js';
import { haptic } from '../motion.js';
import './glass-icon.js';

/**
 * Brightness slider (Library: Brightness slider): a 72-high pill you drag
 * anywhere along; the fill is the value, there's no knob. Brightness on the
 * Brightness card and Light pop-up, volume on the Media pop-up.
 *
 * `fill`: light (the warm light fill), colour (a soft tint to the bulb's own
 * colour, given as `rgb`; see-through in dark mode, like the light fill) or
 * neutral (grey, for volume). `mute` makes the icon a 44 button that fires
 * `mute`; `muted` crosses the speaker out and empties the fill.
 *
 * Fires `input` while dragging and `change` on letting go; read `value`. The
 * card sets `value` from HA. `disabled` (the light or speaker isn't there)
 * fades it to 50% and it doesn't move.
 */
@customElement('glass-slider')
export class GlassSlider extends LitElement {
  @property({ type: Number }) value = 0;
  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Number }) step = 1;
  @property({ reflect: true }) fill: 'light' | 'colour' | 'neutral' = 'light';
  /** The bulb's colour, [r, g, b], for the colour fill. */
  @property({ attribute: false }) rgb?: number[];
  @property() icon: IconName = 'sun';
  @property({ type: Boolean }) mute = false;
  @property({ type: Boolean }) muted = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Required: what it sets, for screen readers. */
  @property() label = '';

  private onInput(ev: Event) {
    const v = Number((ev.target as HTMLInputElement).value);
    // A bump as the fill reaches the end.
    if (v === this.max && this.value !== this.max) haptic('light');
    this.value = v;
  }

  private onChange(ev: Event) {
    ev.stopPropagation();
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  private onMute() {
    this.dispatchEvent(new Event('mute', { bubbles: true, composed: true }));
  }

  render() {
    const pct = this.muted || this.disabled ? 0 : ((this.value - this.min) / (this.max - this.min || 1)) * 100;
    const rgb = this.fill === 'colour' && this.rgb?.length === 3 ? this.rgb : undefined;
    // The Light frame's soft(): halfway to white, then the bulb's colour.
    const colourVars = rgb ? `--c: ${rgb.join(', ')}; --soft: ${rgb.map((c) => Math.round(255 - (255 - c) * 0.5)).join(', ')};` : '';
    const icon = this.mute ? (this.muted ? 'volume-x' : 'volume-2') : this.icon;
    return html`<div class="track">
      <span class="fill ${rgb ? 'colour' : ''}" style="width: ${pct}%; ${colourVars}"></span>
      <input
        type="range"
        min=${this.min}
        max=${this.max}
        step=${this.step}
        .value=${String(this.value)}
        aria-label=${this.label}
        ?disabled=${this.disabled}
        @input=${this.onInput}
        @change=${this.onChange}
      />
      ${this.mute
        ? html`<button type="button" class="ic" aria-label=${this.muted ? 'Unmute' : 'Mute'} ?disabled=${this.disabled} @click=${this.onMute}>
            <glass-icon name=${icon} size="22"></glass-icon>
          </button>`
        : html`<span class="ic" aria-hidden="true"><glass-icon name=${icon} size="22"></glass-icon></span>`}
    </div>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    :host([disabled]) {
      opacity: 0.5;
      pointer-events: none;
    }
    .track {
      position: relative;
      box-sizing: border-box;
      height: 72px;
      border-radius: 36px;
      background: rgba(var(--glass-line-rgb), 0.06);
      overflow: hidden;
      color: var(--glass-ink);
    }
    .track:has(input:focus-visible) {
      outline: 2px solid var(--glass-ink);
      outline-offset: 2px;
    }
    .fill {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      border-radius: 36px;
      background: var(--glass-light-fill);
    }
    .fill.colour {
      background: linear-gradient(90deg, rgba(var(--soft), var(--glass-colour-fill-from)) 0%, rgba(var(--c), var(--glass-colour-fill-to)) 100%);
    }
    :host([fill='neutral']) .fill {
      background: rgba(var(--glass-line-rgb), 0.14);
    }
    input {
      -webkit-appearance: none;
      appearance: none;
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      opacity: 0;
      background: transparent;
      cursor: ew-resize;
      touch-action: pan-y;
    }
    .ic {
      all: unset;
      position: absolute;
      left: 10px;
      top: 14px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    button.ic {
      pointer-events: auto;
      cursor: pointer;
    }
    button.ic:focus-visible {
      outline: 2px solid var(--glass-ink);
      outline-offset: 2px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-slider': GlassSlider;
  }
}

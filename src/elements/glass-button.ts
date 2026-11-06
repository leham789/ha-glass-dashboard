import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { IconName } from '../icons.js';
import './glass-icon.js';

/**
 * Buttons and switches (Library: Buttons and switches). One element per part;
 * every card and pop-up nests these rather than drawing its own. Each draws a
 * real <button> inside, so taps, focus and the pressed shrink (motion.ts) work
 * as they would on a plain button; listen for `click` on the element.
 *
 * Nested parts don't carry the tokens: every --glass- value, dark mode
 * included, comes down from the card they sit in.
 */

const focusRing = css`
  button:focus-visible {
    outline: 2px solid var(--glass-ink);
    outline-offset: 2px;
  }
`;

/**
 * Primary, secondary or quick-action tile.
 *  - primary: the one main action. 52 (default), 48 `compact`, 56 `full` width.
 *  - secondary: lesser choices. 44 on light; 40 `dark` on a dark card, a shade lighter when `on`.
 *  - tile: a one-tap action for a whole room (Room options), 92 high, `hint` on top; `dark` for the main one.
 */
@customElement('glass-button')
export class GlassButton extends LitElement {
  @property({ reflect: true }) kind: 'primary' | 'secondary' | 'tile' = 'primary';
  @property({ reflect: true }) size: 'default' | 'compact' | 'full' = 'default';
  @property({ type: Boolean, reflect: true }) dark = false;
  @property({ type: Boolean, reflect: true }) on = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property() icon?: IconName;
  /** The tile's small line on top ("4 on now", "Done"). */
  @property() hint = '';
  @property() label?: string;

  static styles = [
    focusRing,
    css`
      :host {
        display: inline-flex;
        font-family: var(--glass-font);
      }
      :host([size='full']),
      :host([kind='tile']) {
        display: flex;
      }
      button {
        all: unset;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        white-space: nowrap;
        cursor: pointer;
        width: 100%;
      }
      button:disabled {
        cursor: default;
      }
      /* primary */
      :host([kind='primary']) button {
        height: 52px;
        padding: 0 20px;
        border-radius: 26px;
        background: var(--glass-ink);
        color: var(--glass-on-ink);
        font-size: var(--glass-text-body);
      }
      :host([kind='primary'][size='full']) button {
        height: 56px;
        border-radius: 28px;
      }
      :host([kind='primary'][size='compact']) button {
        height: 48px;
        padding: 0 16px;
        border-radius: 24px;
        font-size: var(--glass-text-chip);
      }
      :host([kind='primary']) button:disabled {
        background: rgba(var(--glass-line-rgb), 0.12);
        color: rgba(var(--glass-line-rgb), 0.4);
      }
      /* secondary */
      :host([kind='secondary']) button {
        height: 44px;
        padding: 0 16px;
        border-radius: 22px;
        border: 1px solid rgba(var(--glass-line-rgb), 0.12);
        background: var(--glass-solid);
        color: var(--glass-ink);
        font-size: var(--glass-text-caption);
      }
      :host([kind='secondary'][dark]) button {
        height: 40px;
        border-radius: 20px;
        border-color: rgba(255, 255, 255, 0.3);
        background: var(--glass-dark);
        color: var(--glass-on-picture);
      }
      :host([kind='secondary'][dark][on]) button {
        background: var(--glass-dark-2);
      }
      :host([kind='secondary']) button:disabled {
        opacity: 0.5;
      }
      /* quick action tile */
      :host([kind='tile']) button {
        height: var(--glass-height-small-tile);
        padding: var(--glass-space-small-tile);
        border-radius: var(--glass-radius-small-tile);
        background: var(--glass-solid);
        color: var(--glass-ink);
        flex-direction: column;
        align-items: stretch;
        justify-content: space-between;
        gap: 0;
        white-space: normal;
        text-align: left;
      }
      :host([kind='tile'][dark]) button {
        background: var(--glass-ink);
        color: var(--glass-on-ink);
      }
      :host([kind='tile']) button:disabled {
        opacity: 0.5;
      }
      .hint {
        font-size: var(--glass-text-small);
        opacity: 0.75;
      }
      .name {
        font-size: var(--glass-text-body);
      }
    `,
  ];

  render() {
    if (this.kind === 'tile') {
      return html`<button type="button" ?disabled=${this.disabled} aria-label=${this.label ?? nothing}>
        <span class="hint">${this.hint}</span><span class="name"><slot></slot></span>
      </button>`;
    }
    return html`<button type="button" ?disabled=${this.disabled} aria-label=${this.label ?? nothing} aria-pressed=${this.kind === 'secondary' && this.dark ? String(this.on) : nothing}>
      ${this.icon ? html`<glass-icon name=${this.icon} size="18" stroke="1.8"></glass-icon>` : nothing}<slot></slot>
    </button>`;
  }
}

/**
 * Icon button: six looks and five sizes.
 *  dark = the main step (+, play) · white = its opposite (−) · glass = close on a sheet ·
 *  grey = minor (collapse) · bare = icon only, ink when `on` (shuffle, repeat) ·
 *  on-dark = white on a dark card (the dark Media card's play).
 *  Sizes: 64 sheet close, 52 default, 44 media, 40 on tiles, 36 compact.
 */
@customElement('glass-icon-button')
export class GlassIconButton extends LitElement {
  @property() icon: IconName = 'x';
  @property({ reflect: true }) look: 'dark' | 'white' | 'glass' | 'grey' | 'bare' | 'on-dark' = 'dark';
  @property({ type: Number, reflect: true }) size: 64 | 52 | 44 | 40 | 36 = 52;
  @property({ type: Boolean, reflect: true }) on = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Solid icon (play, pause). */
  @property({ type: Boolean }) solid = false;
  /** Required: what the button does, for screen readers. */
  @property() label = '';
  /** aria-pressed, for a toggle (shuffle, repeat). */
  @property({ type: Boolean }) toggle = false;
  /** A glyph in place of the icon (the thermostat's − and +). */
  @property() text = '';
  /** Icon size, when it isn't the size's usual one (play 22 at 64, previous and next 18 at 52). */
  @property({ type: Number, attribute: 'icon-size' }) iconSize?: number;

  static styles = [
    focusRing,
    css`
      :host {
        display: inline-flex;
        flex: none;
      }
      button {
        all: unset;
        box-sizing: border-box;
        width: var(--s, 52px);
        height: var(--s, 52px);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--glass-ink);
        font-family: var(--glass-font);
        line-height: 1;
        cursor: pointer;
      }
      :host([size='64']) {
        --s: 64px;
      }
      :host([size='44']) {
        --s: 44px;
      }
      :host([size='40']) {
        --s: 40px;
      }
      :host([size='36']) {
        --s: 36px;
      }
      :host([look='dark']) button {
        background: var(--glass-ink);
        color: var(--glass-on-ink);
      }
      :host([look='white']) button {
        background: var(--glass-solid);
        border: 1px solid rgba(var(--glass-line-rgb), 0.12);
      }
      :host([look='glass']) button {
        background: rgba(var(--glass-surface-rgb), 0.85);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
      }
      :host([look='grey']) button {
        background: var(--glass-neutral-tint);
      }
      :host([look='bare']) button {
        background: transparent;
        color: inherit;
      }
      :host([look='bare'][on]) button {
        background: var(--glass-ink);
        color: var(--glass-on-ink);
      }
      :host([look='on-dark']) button {
        background: var(--glass-on-dark);
        color: var(--glass-on-dark-ink);
      }
      button:disabled {
        opacity: 0.4;
        cursor: default;
      }
    `,
  ];

  private get glyphSize(): number {
    return this.iconSize ?? (this.size === 64 ? 24 : this.size === 52 ? 22 : this.size === 36 ? 16 : 18);
  }

  render() {
    return html`<button type="button" ?disabled=${this.disabled} aria-label=${this.label} aria-pressed=${this.toggle ? String(this.on) : nothing}>
      ${this.text
        ? html`<span class="text" style="font-size: ${this.glyphSize}px" aria-hidden="true">${this.text}</span>`
        : html`<glass-icon name=${this.icon} size=${this.glyphSize} stroke=${this.solid ? 2 : 1.8} ?solid=${this.solid}></glass-icon>`}
    </button>`;
  }
}

/** Light toggle: the bulb on Rooms and Room tile. 44, or 40 `tile` with the stronger ring; `busy` from tap until HA answers. */
@customElement('glass-light-toggle')
export class GlassLightToggle extends LitElement {
  @property({ type: Boolean, reflect: true }) on = false;
  @property({ type: Boolean, reflect: true }) tile = false;
  @property({ type: Boolean, reflect: true }) busy = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property() label = 'Lights';

  static styles = [
    focusRing,
    css`
      :host {
        display: inline-flex;
        flex: none;
      }
      button {
        all: unset;
        box-sizing: border-box;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 1px solid rgba(var(--glass-line-rgb), 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--glass-ink);
        cursor: pointer;
      }
      :host([tile]) button {
        width: 40px;
        height: 40px;
        border-color: rgba(var(--glass-line-rgb), 0.25);
      }
      :host([on]) button {
        background: var(--glass-accent);
        color: var(--glass-on-pastel);
      }
      :host([busy]) button {
        border-color: var(--glass-ink);
      }
      button:disabled {
        opacity: 0.4;
        cursor: default;
      }
    `,
  ];

  render() {
    return html`<button type="button" ?disabled=${this.disabled} aria-label=${this.label} aria-pressed=${String(this.on)}>
      <glass-icon name="lightbulb" size="18" stroke="1.8"></glass-icon>
    </button>`;
  }
}

/** Switch: 52 × 32, go green when on; `disabled` fades it to 50%. Fires `change` when tapped. */
@customElement('glass-switch')
export class GlassSwitch extends LitElement {
  @property({ type: Boolean, reflect: true }) checked = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property() label = '';

  static styles = [
    focusRing,
    css`
      :host {
        display: inline-flex;
        flex: none;
      }
      button {
        all: unset;
        position: relative;
        display: block;
        width: 52px;
        height: 32px;
        border-radius: 16px;
        background: rgba(var(--glass-line-rgb), 0.15);
        cursor: pointer;
        transition: background 0.2s ease;
      }
      i {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: var(--glass-knob);
        box-shadow: var(--glass-knob-shadow);
        transition: left 0.2s ease;
      }
      :host([checked]) button {
        background: var(--glass-go);
      }
      :host([checked]) i {
        left: 23px;
      }
      button:disabled {
        background: rgba(var(--glass-line-rgb), 0.08);
        opacity: 0.5;
        cursor: default;
      }
      button:disabled i {
        box-shadow: none;
      }
      @media (prefers-reduced-motion: reduce) {
        button,
        i {
          transition: none;
        }
      }
    `,
  ];

  /** Follows HA: it doesn't flip itself, the card flips the entity and the new state comes back as `checked`. */
  private flip(e: Event) {
    e.stopPropagation();
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  render() {
    return html`<button type="button" role="switch" aria-checked=${String(this.checked)} aria-label=${this.label || nothing} ?disabled=${this.disabled} @click=${this.flip}><i></i></button>`;
  }
}

export interface Segment {
  value: string;
  label: string;
}

/**
 * Segmented control: pick one of two or three.
 *  light: fills the width, the choice in solid white, 52 high (filters, sort, Heat/Off, White/Colour).
 *  dark: hugs its words, the choice in ink, 44 high (Home's floors).
 *  small: hugs its words, 40 high (a chart's range beside a heading).
 * Fires `change`; read the new choice from `value`.
 */
@customElement('glass-segmented')
export class GlassSegmented extends LitElement {
  @property({ attribute: false }) options: Segment[] = [];
  @property() value = '';
  @property({ reflect: true }) look: 'light' | 'dark' | 'small' = 'light';
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property() label = '';

  static styles = [
    focusRing,
    css`
      :host {
        display: flex;
        font-family: var(--glass-font);
      }
      :host([look='dark']),
      :host([look='small']) {
        display: inline-flex;
        align-self: flex-start;
      }
      .sg {
        box-sizing: border-box;
        display: flex;
        gap: 4px;
        padding: 4px;
        width: 100%;
        border-radius: 26px;
        background: rgba(var(--glass-line-rgb), 0.06);
        font-size: var(--glass-text-chip);
        color: var(--glass-ink);
      }
      button {
        all: unset;
        box-sizing: border-box;
        flex: 1;
        height: 44px;
        border-radius: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        white-space: nowrap;
        cursor: pointer;
      }
      button.sel {
        background: var(--glass-solid);
        box-shadow: var(--glass-raised-shadow);
      }
      :host([look='dark']) .sg {
        border-radius: 22px;
        background: rgba(var(--glass-surface-rgb), 0.6);
        font-size: var(--glass-text-caption);
      }
      :host([look='dark']) button {
        flex: none;
        height: 36px;
        padding: 0 12px;
        border-radius: 18px;
      }
      :host([look='dark']) button.sel {
        background: var(--glass-ink);
        color: var(--glass-on-ink);
        box-shadow: none;
      }
      :host([look='small']) .sg {
        border-radius: 20px;
        font-size: var(--glass-text-caption);
      }
      :host([look='small']) button {
        flex: none;
        height: 32px;
        padding: 0 12px;
        border-radius: 16px;
      }
      :host([disabled]) .sg {
        opacity: 0.5;
        pointer-events: none;
      }
    `,
  ];

  private pick(v: string) {
    if (v === this.value) return;
    this.value = v;
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  render() {
    return html`<div class="sg" role="group" aria-label=${this.label || nothing}>
      ${this.options.map(
        (o) => html`<button type="button" class=${o.value === this.value ? 'sel' : ''} aria-pressed=${String(o.value === this.value)} @click=${() => this.pick(o.value)}>${o.label}</button>`,
      )}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-button': GlassButton;
    'glass-icon-button': GlassIconButton;
    'glass-light-toggle': GlassLightToggle;
    'glass-switch': GlassSwitch;
    'glass-segmented': GlassSegmented;
  }
}

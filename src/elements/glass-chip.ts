import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { IconName } from '../icons.js';
import './glass-icon.js';

/**
 * Chips and pills (Library: Chips and pills). One element per part; cards
 * nest these rather than drawing their own.
 */

const focusRing = css`
  button:focus-visible {
    outline: 2px solid var(--glass-ink);
    outline-offset: 2px;
  }
`;

/**
 * Status chip: 40 high, an icon circle and a summary (Home's status chips).
 * `circle` is the icon circle's colour (a pastel token); empty is the grey one.
 * `attention` tints it; `ring` adds the attention ring (a door open). Tappable unless `disabled`.
 */
@customElement('glass-status-chip')
export class GlassStatusChip extends LitElement {
  @property() icon: IconName = 'lightbulb';
  @property() circle = '';
  @property({ type: Boolean, reflect: true }) attention = false;
  @property({ type: Boolean, reflect: true }) ring = false;
  @property({ type: Boolean, reflect: true }) disabled = false;

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
        height: 40px;
        padding: 0 16px 0 8px;
        border-radius: 20px;
        background: rgba(var(--glass-surface-rgb), 0.55);
        border: 1px solid var(--glass-surface-border);
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: var(--glass-font);
        font-size: var(--glass-text-chip);
        color: var(--glass-ink);
        white-space: nowrap;
        cursor: pointer;
      }
      button:disabled {
        cursor: default;
      }
      :host([attention]) button {
        background: var(--glass-attention-tint);
        border-color: var(--glass-attention-edge);
      }
      :host([ring]) button {
        box-shadow: inset 0 0 0 2px var(--glass-attention);
      }
      .ic {
        width: 28px;
        height: 28px;
        flex: none;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--glass-on-pastel);
      }
      .ic.grey {
        background: var(--glass-neutral-tint);
        color: var(--glass-text-secondary);
      }
    `,
  ];

  render() {
    return html`<button type="button" ?disabled=${this.disabled}>
      <span class="ic ${this.circle ? '' : 'grey'}" style=${this.circle ? `background: ${this.circle}` : ''}><glass-icon name=${this.icon} size="15" stroke="1.8"></glass-icon></span>
      <slot></slot>
    </button>`;
  }
}

/** Info chip: small context next to a big number (32), `subject` in ink, `device` 36 high. Not tappable. */
@customElement('glass-info-chip')
export class GlassInfoChip extends LitElement {
  @property() icon?: IconName;
  @property({ type: Boolean, reflect: true }) subject = false;
  @property({ type: Boolean, reflect: true }) device = false;

  static styles = [
    css`
      :host {
        flex: none;
        box-sizing: border-box;
        height: 32px;
        padding: 0 12px;
        border-radius: 16px;
        background: rgba(var(--glass-surface-rgb), 0.7);
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-family: var(--glass-font);
        font-size: var(--glass-text-caption);
        color: var(--glass-ink);
        white-space: nowrap;
        min-width: 0;
        max-width: 100%;
      }
      :host([subject]) {
        background: var(--glass-ink);
        color: var(--glass-on-ink);
      }
      :host([device]) {
        height: 36px;
        padding: 0 16px;
        border-radius: 18px;
      }
      slot {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ];

  render() {
    return html`${this.icon ? html`<glass-icon name=${this.icon} size="14" stroke="1.8"></glass-icon>` : nothing}<slot></slot>`;
  }
}

/**
 * Toggle chip: ink when `on` (or current), glass when off. 44 high; `size="tab"` 40 (Title's tabs);
 * `size="fill"` 40 and shares its row (presets). `disabled` fades to 50%.
 */
@customElement('glass-toggle-chip')
export class GlassToggleChip extends LitElement {
  @property({ type: Boolean, reflect: true }) on = false;
  @property({ reflect: true }) size: 'default' | 'tab' | 'fill' = 'default';
  @property({ type: Boolean, reflect: true }) disabled = false;

  static styles = [
    focusRing,
    css`
      :host {
        display: inline-flex;
        flex: none;
      }
      :host([size='fill']) {
        flex: 1;
        min-width: 0;
      }
      button {
        all: unset;
        box-sizing: border-box;
        width: 100%;
        height: 44px;
        padding: 0 20px;
        border-radius: 22px;
        border: 1px solid var(--glass-surface-border);
        background: rgba(var(--glass-surface-rgb), 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--glass-font);
        font-size: var(--glass-text-body);
        color: var(--glass-ink);
        white-space: nowrap;
        cursor: pointer;
      }
      :host([on]) button {
        background: var(--glass-ink);
        border-color: var(--glass-ink);
        color: var(--glass-on-ink);
      }
      :host([size='tab']) button {
        height: 40px;
        border-radius: 20px;
        font-size: var(--glass-text-chip);
      }
      :host([size='fill']) button {
        height: 40px;
        border-radius: 20px;
        font-size: var(--glass-text-chip);
        padding: 0;
      }
      button:disabled {
        opacity: 0.5;
        cursor: default;
      }
    `,
  ];

  render() {
    return html`<button type="button" ?disabled=${this.disabled} aria-pressed=${String(this.on)}><slot></slot></button>`;
  }
}

export type Tone = 'neutral' | 'success' | 'attention' | 'info';

const TONE: Record<Tone, [string, string, string]> = {
  neutral: ['var(--glass-neutral-tint)', 'var(--glass-text-secondary)', 'var(--glass-grey)'],
  success: ['var(--glass-success-tint)', 'var(--glass-success-ink)', 'var(--glass-go)'],
  attention: ['var(--glass-attention-tint)', 'var(--glass-attention-ink)', 'var(--glass-attention)'],
  info: ['var(--glass-info-tint)', 'var(--glass-info-ink)', 'var(--glass-info)'],
};

/** Status pill: a state in a card header, 30 high (26 `small`), with its dot. */
@customElement('glass-pill')
export class GlassPill extends LitElement {
  @property({ reflect: true }) tone: Tone = 'neutral';
  @property({ type: Boolean, reflect: true }) small = false;
  /** Leave out the dot (a band pill). */
  @property({ type: Boolean }) bare = false;

  static styles = [
    css`
      :host {
        flex: none;
        box-sizing: border-box;
        height: 30px;
        padding: 0 12px;
        border-radius: 15px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-family: var(--glass-font);
        font-size: var(--glass-text-caption);
        white-space: nowrap;
        background: var(--bg);
        color: var(--fg);
      }
      :host([small]) {
        height: 26px;
        border-radius: 13px;
        font-size: var(--glass-text-small);
      }
      i {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex: none;
        background: var(--dot);
      }
      :host([small]) i {
        width: 6px;
        height: 6px;
      }
    `,
  ];

  render() {
    const [bg, fg, dot] = TONE[this.tone] ?? TONE.neutral;
    this.style.setProperty('--bg', bg);
    this.style.setProperty('--fg', fg);
    this.style.setProperty('--dot', dot);
    return html`${this.bare ? nothing : html`<i></i>`}<slot></slot>`;
  }
}

/** Live badge: on a camera picture, always dark. `state`: live (green dot), recording (red), offline and connecting (grey). */
@customElement('glass-live-badge')
export class GlassLiveBadge extends LitElement {
  @property({ reflect: true }) state: 'live' | 'recording' | 'offline' | 'connecting' = 'live';
  /** No dot: just the words (the clock in the Cameras pop-up). */
  @property({ type: Boolean, reflect: true }) plain = false;

  static styles = [
    css`
      :host {
        flex: none;
        box-sizing: border-box;
        height: 24px;
        padding: 0 12px;
        border-radius: 12px;
        background: var(--glass-scrim);
        color: var(--glass-on-picture);
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-family: var(--glass-font);
        font-size: var(--glass-text-small);
        white-space: nowrap;
      }
      i {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--glass-go);
      }
      :host([state='recording']) i {
        background: var(--glass-live);
      }
      :host([state='offline']) i,
      :host([state='connecting']) i {
        background: var(--glass-grey);
      }
    `,
  ];

  render() {
    return html`${this.plain ? nothing : html`<i></i>`}<slot>${{ live: 'Live', recording: 'Recording', offline: 'Offline', connecting: 'Connecting' }[this.state]}</slot>`;
  }
}

/**
 * Colour preset: a swatch and a name (Warm, Neutral, Cool, Colour), `selected` with an ink edge.
 * Presets share their row's width. `swatch-only`: just the colour, 40 high, an ink ring when selected
 * (the Light pop-up's quick colours).
 */
@customElement('glass-colour-preset')
export class GlassColourPreset extends LitElement {
  @property() swatch = '';
  @property({ type: Boolean, reflect: true }) selected = false;
  @property({ type: Boolean, reflect: true, attribute: 'swatch-only' }) swatchOnly = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property() label = '';

  static styles = [
    focusRing,
    css`
      :host {
        display: flex;
        min-width: 0;
      }
      button {
        all: unset;
        box-sizing: border-box;
        width: 100%;
        height: 56px;
        border-radius: var(--glass-radius-inset);
        border: 1px solid var(--glass-hairline);
        background: var(--glass-solid);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        font-family: var(--glass-font);
        font-size: var(--glass-text-small);
        color: var(--glass-ink);
        cursor: pointer;
      }
      :host([selected]) button {
        border-color: var(--glass-ink);
      }
      i {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--swatch);
      }
      :host([swatch-only]) button {
        height: 40px;
        border: none;
        border-radius: 20px;
        background: var(--swatch);
      }
      :host([swatch-only][selected]) button {
        box-shadow: 0 0 0 2px var(--glass-solid), 0 0 0 4px var(--glass-ink);
      }
      :host([swatch-only]) i {
        display: none;
      }
      button:disabled {
        opacity: 0.5;
        cursor: default;
      }
    `,
  ];

  render() {
    this.style.setProperty('--swatch', this.swatch);
    return html`<button type="button" ?disabled=${this.disabled} aria-pressed=${String(this.selected)} aria-label=${this.swatchOnly ? this.label : nothing}>
      <i></i>${this.swatchOnly ? nothing : html`<span><slot>${this.label}</slot></span>`}
    </button>`;
  }
}

/** Tag: a tiny label on a tile (a temperature band). 24 high; `bg` and `fg` from the band's colours. */
@customElement('glass-tag')
export class GlassTag extends LitElement {
  @property() bg = 'var(--glass-neutral-tint)';
  @property() fg = 'var(--glass-text-secondary)';

  static styles = [
    css`
      :host {
        flex: none;
        box-sizing: border-box;
        height: 24px;
        padding: 0 8px;
        border-radius: 12px;
        display: inline-flex;
        align-items: center;
        font-family: var(--glass-font);
        font-size: var(--glass-text-tiny);
        white-space: nowrap;
        background: var(--bg);
        color: var(--fg);
      }
    `,
  ];

  render() {
    this.style.setProperty('--bg', this.bg);
    this.style.setProperty('--fg', this.fg);
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-status-chip': GlassStatusChip;
    'glass-info-chip': GlassInfoChip;
    'glass-toggle-chip': GlassToggleChip;
    'glass-pill': GlassPill;
    'glass-live-badge': GlassLiveBadge;
    'glass-colour-preset': GlassColourPreset;
    'glass-tag': GlassTag;
  }
}

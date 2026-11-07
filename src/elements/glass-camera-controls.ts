import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { type HassEntity, type HomeAssistant, isUnavailable } from '../ha.js';
import type { IconName } from '../icons.js';
import { haptic } from '../motion.js';
import './glass-icon.js';
import './glass-chip.js';

/**
 * Camera controls (Library: Camera controls): everything that sits on a camera
 * picture, on cards, in pop-ups and in full screen. One scrim (black at 45%,
 * white icons and words), controls 12 in from the picture's edge. The live
 * badge is glass-live-badge (Chips and pills); the rest are here.
 *
 * Nested parts don't carry the tokens: every --glass- value comes down from
 * the card or sheet they sit in.
 */

/** What a camera's badge says: Offline, Recording or Live. */
export function cameraBadge(cam: HassEntity | undefined): 'offline' | 'recording' | 'live' {
  return isUnavailable(cam) ? 'offline' : cam?.state === 'recording' ? 'recording' : 'live';
}

const focusRing = css`
  button:focus-visible {
    outline: 2px solid var(--glass-on-picture);
    outline-offset: 2px;
  }
`;

/**
 * Round button, icon only and white: on a picture it takes the scrim (`look`
 * scrim, 36 for full screen or 44 for previous and next); in full screen, white
 * at 14% with a blur, like iOS's own camera controls (`look` full, 44).
 */
@customElement('glass-camera-button')
export class GlassCameraButton extends LitElement {
  @property() icon: IconName = 'maximize-2';
  @property({ reflect: true }) look: 'scrim' | 'full' = 'scrim';
  @property({ type: Number, reflect: true }) size: 36 | 44 = 36;
  /** Required: what it does, for screen readers. */
  @property() label = '';

  render() {
    const iconSize = this.icon === 'x' ? 20 : this.icon.startsWith('chevron') ? 18 : 16;
    return html`<button type="button" aria-label=${this.label}><glass-icon name=${this.icon} size=${iconSize} stroke="1.8"></glass-icon></button>`;
  }

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
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--glass-scrim);
        color: var(--glass-on-picture);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      :host([size='44']) button {
        width: 44px;
        height: 44px;
      }
      :host([look='full']) button {
        background: var(--glass-on-picture-glass);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
      }
    `,
  ];
}

/**
 * Light button: the light by a camera (the porch or chamber light), named with
 * its state; tap toggles it. When on it turns the warm light-on colour
 * wherever it is. `look`: picture (36, white at 90%, Small 12, on a card's
 * picture), full (52, white at 14% with a blur, in full screen) or sheet (56,
 * solid with a hairline, under the Cameras pop-up's picture).
 */
@customElement('glass-camera-light')
export class GlassCameraLight extends LitElement {
  @property({ attribute: false }) entity?: HassEntity;
  @property({ attribute: false }) hass?: HomeAssistant;
  @property() name = '';
  @property({ reflect: true }) look: 'picture' | 'full' | 'sheet' = 'picture';

  private toggle() {
    const e = this.entity;
    if (!e || !this.hass) return;
    haptic('light');
    this.hass.callService('homeassistant', e.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: e.entity_id });
  }

  protected willUpdate(): void {
    this.toggleAttribute('on', this.entity?.state === 'on');
  }

  render() {
    const on = this.entity?.state === 'on';
    return html`<button type="button" aria-pressed=${on ? 'true' : 'false'} ?disabled=${isUnavailable(this.entity)} @click=${this.toggle}>
      ${this.look === 'picture' ? nothing : html`<glass-icon name="lightbulb" size="18" stroke="1.6"></glass-icon>`}${this.name} · ${on ? 'On' : 'Off'}
    </button>`;
  }

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
        width: 100%;
        height: 36px;
        padding: 0 12px;
        border-radius: 18px;
        background: var(--glass-on-picture-button);
        color: var(--glass-on-light);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-family: var(--glass-font);
        font-size: var(--glass-text-small);
        white-space: nowrap;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.5;
        cursor: default;
      }
      :host([look='full']) button {
        height: 52px;
        padding: 0 20px;
        border-radius: 26px;
        background: var(--glass-on-picture-glass);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        color: var(--glass-on-picture);
        font-size: var(--glass-text-body);
      }
      :host([look='sheet']) button {
        height: 56px;
        padding: 0 20px;
        border-radius: 28px;
        background: var(--glass-solid);
        border: 1px solid var(--glass-hairline);
        color: var(--glass-ink);
        font-size: var(--glass-text-body);
      }
      :host([look='sheet']) button:focus-visible {
        outline-color: var(--glass-ink);
      }
      :host([on]) button,
      :host([on][look]) button {
        background: var(--glass-light-default);
        border-color: var(--glass-light-default);
        color: var(--glass-on-light);
      }
    `,
  ];
}

/**
 * Page dots: one per camera, 8 high and 8 apart; the current one stretches to
 * 24. Tap one to jump to it (fires `pick`, detail: its index). `look` sheet
 * (ink, and the line colour at 20%) or full (white, and white at 35%).
 */
@customElement('glass-page-dots')
export class GlassPageDots extends LitElement {
  /** Each page's name, for screen readers. */
  @property({ attribute: false }) names: string[] = [];
  @property({ type: Number }) index = 0;
  @property({ reflect: true }) look: 'sheet' | 'full' = 'sheet';

  render() {
    return html`<span role="tablist" aria-label="Cameras">
      ${this.names.map(
        (n, i) => html`<button
          type="button"
          role="tab"
          class=${i === this.index ? 'current' : ''}
          aria-selected=${i === this.index ? 'true' : 'false'}
          aria-label=${n}
          @click=${() => this.dispatchEvent(new CustomEvent('pick', { detail: i, bubbles: true, composed: true }))}
        ></button>`,
      )}
    </span>`;
  }

  static styles = css`
    :host {
      display: inline-flex;
    }
    span {
      display: flex;
      gap: 8px;
    }
    button {
      all: unset;
      width: 8px;
      height: 8px;
      border-radius: 4px;
      background: rgba(var(--glass-line-rgb), 0.2);
      cursor: pointer;
      transition: width 0.25s ease;
    }
    button.current {
      width: 24px;
      background: var(--glass-ink);
    }
    :host([look='full']) button {
      background: var(--glass-on-picture-dot);
    }
    :host([look='full']) button.current {
      background: var(--glass-on-picture);
    }
    button:focus-visible {
      outline: 2px solid var(--glass-ink);
      outline-offset: 2px;
    }
    :host([look='full']) button:focus-visible {
      outline-color: var(--glass-on-picture);
    }
    @media (prefers-reduced-motion: reduce) {
      button {
        transition: none;
      }
    }
  `;
}

/**
 * Full screen pill: 30 high, white at 14% with a blur. The camera's state
 * (`state` gives it the dot) beside its name, or the zoom level while zoomed
 * in (`button`: tap it to zoom back out; listen for `click`).
 */
@customElement('glass-camera-pill')
export class GlassCameraPill extends LitElement {
  @property({ reflect: true }) state?: 'live' | 'recording' | 'offline';
  @property({ type: Boolean }) button = false;
  @property() label = '';

  render() {
    const inner = html`${this.state ? html`<i></i>` : nothing}<slot>${this.state ? { live: 'Live', recording: 'Recording', offline: 'Offline' }[this.state] : ''}</slot>`;
    return this.button ? html`<button type="button" class="pill" aria-label=${this.label || nothing}>${inner}</button>` : html`<span class="pill">${inner}</span>`;
  }

  static styles = [
    focusRing,
    css`
      :host {
        display: inline-flex;
        flex: none;
      }
      .pill {
        all: unset;
        box-sizing: border-box;
        height: 30px;
        padding: 0 12px;
        border-radius: 15px;
        background: var(--glass-on-picture-glass);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        color: var(--glass-on-picture);
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: var(--glass-font);
        font-size: var(--glass-text-caption);
        white-space: nowrap;
      }
      button.pill {
        cursor: pointer;
      }
      i {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--glass-go);
      }
      :host([state='recording']) i {
        background: var(--glass-live);
      }
      :host([state='offline']) i {
        background: var(--glass-grey);
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-camera-button': GlassCameraButton;
    'glass-camera-light': GlassCameraLight;
    'glass-page-dots': GlassPageDots;
    'glass-camera-pill': GlassCameraPill;
  }
}

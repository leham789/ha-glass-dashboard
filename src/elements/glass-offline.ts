import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../tokens.js';
import type { HomeAssistant } from '../ha.js';
import { clock } from '../time.js';
import './glass-icon.js';

/**
 * The banner across the top while Home Assistant can't be reached (HA
 * restarting, a Wi-Fi blip). The cards underneath keep their last states,
 * faded and not tappable. HA reconnects on its own; "Try now" asks it to
 * straight away. One banner for the whole page.
 */
@customElement('glass-offline')
export class GlassOffline extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  /** When the connection dropped: the cards show what they had then. */
  @property({ attribute: false }) since = new Date();
  @state() private trying = false;

  private static banner?: GlassOffline;

  /** Shows the banner while `connected` is false, and takes it away again once HA is back. */
  static follow(hass: HomeAssistant): void {
    const down = hass.connected === false;
    if (down && !this.banner) {
      this.banner = document.createElement('glass-offline');
      document.body.appendChild(this.banner);
    }
    if (!down && this.banner) {
      this.banner.remove();
      this.banner = undefined;
    }
    if (this.banner) {
      this.banner.hass = hass;
      this.banner.toggleAttribute('dark', !!hass.themes?.darkMode);
    }
  }

  private tryNow() {
    this.trying = true;
    this.hass?.connection?.reconnect?.(true);
    window.setTimeout(() => (this.trying = false), 1600);
  }

  render() {
    return html`<div role="status">
      <span class="icon"><glass-icon name="wifi-off" size="20" stroke="1.7"></glass-icon></span>
      <span class="text">
        <span class="title">Can't reach Home Assistant</span>
        <span class="sub">Showing the last update, from ${clock(this.since.toISOString())} · reconnecting…</span>
      </span>
      <button type="button" @click=${() => this.tryNow()}>
        <glass-icon class=${this.trying ? 'spin' : ''} name="loader-circle" size="14" stroke="1.8"></glass-icon>${this.trying ? 'Trying…' : 'Try now'}
      </button>
    </div>`;
  }

  static styles = [
    tokens,
    css`
      :host {
        position: fixed;
        top: calc(16px + env(safe-area-inset-top, 0px));
        left: 16px;
        right: 16px;
        z-index: 30;
        font-family: var(--glass-font);
        color: var(--glass-ink);
      }
      div {
        max-width: 448px;
        margin: 0 auto;
        box-sizing: border-box;
        padding: 14px 14px 14px 16px;
        border-radius: 28px;
        background: var(--glass-solid);
        border: 1px solid var(--glass-surface-border);
        box-shadow: 0 16px 40px rgba(20, 20, 40, 0.16);
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .icon {
        width: 40px;
        height: 40px;
        flex: none;
        border-radius: 50%;
        background: var(--glass-neutral-tint);
        color: var(--glass-text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .title {
        font-size: var(--glass-text-body);
      }
      .sub {
        font-size: var(--glass-text-small);
        color: var(--glass-text-muted);
      }
      button {
        all: unset;
        height: 40px;
        padding: 0 14px;
        flex: none;
        border-radius: 20px;
        background: var(--glass-ink);
        color: var(--glass-on-ink);
        font-size: var(--glass-text-caption);
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
      }
      button:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      .spin {
        animation: spin 0.9s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .spin {
          animation: none;
        }
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-offline': GlassOffline;
  }
}

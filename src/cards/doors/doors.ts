import { css, html, nothing, type PropertyValues } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, isUnavailable, openMoreInfo, registerCard } from '../../ha.js';
import { shortName } from '../../rooms.js';
import { clock, duration } from '../../time.js';
import '../../elements/glass-icon.js';
import './doors-editor.js';
import { attentionStyles } from '../../motion.js';

export interface DoorsConfig extends LovelaceCardConfig {
  /** Door and window sensors. Default: every one in HA. */
  entities?: string[];
  /** A screen title above, with an overall pill ("1 door open"), e.g. "Security". */
  title?: string;
  /** The section heading (default "Doors"). */
  heading?: string;
}

const OPENINGS = new Set(['door', 'window', 'garage_door', 'opening']);

/**
 * Door tiles: peach while open, with how long ("Open for 12 min"); glass
 * when shut ("Shut since 18:05"). With a title it also heads the screen,
 * with one pill for the whole house.
 */
@customElement('glass-doors')
export class GlassDoors extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: DoorsConfig;
  @state() private now = new Date();
  private timer?: number;

  static getConfigElement() {
    return document.createElement('glass-doors-editor');
  }

  static getStubConfig(): Partial<DoorsConfig> {
    return { title: 'Security' };
  }

  setConfig(config: DoorsConfig): void {
    this.config = config;
  }

  getCardSize(): number {
    return 4;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    ensureFonts();
    // "Open for 12 min" counts up.
    this.timer = window.setInterval(() => (this.now = new Date()), 60_000);
  }

  disconnectedCallback(): void {
    window.clearInterval(this.timer);
    super.disconnectedCallback();
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has('hass') || changed.size > 1 || !this.config) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    return !old || this.ids().some((id) => old.states[id] !== this.hass!.states[id]);
  }

  private ids(): string[] {
    const hass = this.hass!;
    if (this.config?.entities?.length) return this.config.entities;
    return Object.keys(hass.states).filter(
      (id) =>
        id.startsWith('binary_sensor.') &&
        !hass.entities?.[id]?.hidden &&
        OPENINGS.has(hass.states[id].attributes.device_class),
    );
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const doors = this.ids()
      .map((id) => this.hass!.states[id])
      .filter(Boolean);
    const open = doors.filter((d) => d.state === 'on').length;
    const noun = doors.every((d) => d.attributes.device_class === 'window') ? 'window' : 'door';

    return html`
      ${this.config.title
        ? html`<header>
            <h1>${this.config.title}</h1>
            <span class="pill ${open ? 'attention ringing' : 'ok'}"
              ><span class="dot"></span>${open ? `${open} ${noun}${open > 1 ? 's' : ''} open` : `All ${noun}s shut`}</span
            >
          </header>`
        : nothing}
      <section aria-labelledby="h">
        <h2 id="h">${this.config.heading ?? 'Doors'}</h2>
        <div class="grid">
          ${doors.map((d) => {
            const isOpen = d.state === 'on';
            const offline = isUnavailable(d);
            const when = offline ? 'Offline' : isOpen ? `Open for ${duration(d.last_changed, this.now)}` : `Shut since ${clock(d.last_changed, this.now)}`;
            return html`<button type="button" class="tile ${isOpen ? 'open' : ''}" @click=${() => openMoreInfo(this, d.entity_id)}>
              <span class="top">
                <span class="ring"><glass-icon name=${isOpen ? 'door-open' : 'door-closed'} size="19"></glass-icon></span>
                <span class="state">${offline ? '–' : isOpen ? 'Open' : 'Shut'}</span>
              </span>
              <span class="bottom">
                <span class="name">${sentence(shortName(d, ''))}</span>
                <span class="when">${when}</span>
              </span>
            </button>`;
          })}
        </div>
      </section>
    `;
  }

  static styles = [
    tokens,
    attentionStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--glass-space-edge);
      }
      header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        min-height: 48px;
      }
      h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 400;
        letter-spacing: -0.4px;
      }
      .pill {
        height: 30px;
        padding: 0 12px;
        border-radius: 15px;
        font-size: var(--glass-text-caption);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .pill .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
      }
      .pill.attention {
        background: var(--glass-attention-tint);
        color: var(--glass-attention-ink);
      }
      .pill.attention .dot {
        background: var(--glass-attention);
      }
      .pill.ok {
        background: var(--glass-success-tint);
        color: var(--glass-success-ink);
      }
      .pill.ok .dot {
        background: #2fa84f;
      }
      section {
        display: flex;
        flex-direction: column;
        gap: var(--glass-space-tile-gap);
      }
      h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 400;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: var(--glass-space-tile-gap);
      }
      .tile {
        all: unset;
        box-sizing: border-box;
        height: 132px;
        padding: var(--glass-space-tile);
        border-radius: var(--glass-radius-tile);
        background: var(--glass-surface);
        border: 1px solid var(--glass-surface-border);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        cursor: pointer;
      }
      .tile.open {
        background: var(--glass-attention-tint);
        border-color: var(--glass-attention-edge);
      }
      .tile:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .ring {
        box-sizing: border-box;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 1px solid rgba(var(--glass-line-rgb), 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .state {
        font-size: var(--glass-text-caption);
        color: var(--glass-text-secondary);
      }
      .open .state {
        color: var(--glass-attention-ink);
      }
      .bottom {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .name {
        font-size: var(--glass-text-tile-title);
      }
      .when {
        font-size: var(--glass-text-small);
        color: var(--glass-text-muted);
      }
    `,
  ];
}

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

registerCard({
  type: 'glass-doors',
  name: 'Glass · Doors',
  description: 'Door tiles, peach while open with how long; optional screen title with an overall pill.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-doors': GlassDoors;
  }
}

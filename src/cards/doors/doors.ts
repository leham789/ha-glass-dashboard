import { css, html, nothing, type PropertyValues } from 'lit';
import '../../elements/glass-tile.js';
import '../../elements/glass-chip.js';
import { heading } from '../../elements/type.js';
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
import { isQuiet } from '../../stale.js';

export interface DoorsConfig extends LovelaceCardConfig {
  /** Hours before a sensor counts as not reporting, by type or entity, e.g. { door: 24 }. Applies to the whole dashboard. */
  quiet_hours?: Record<string, number>;
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
    // A contact that's gone quiet can't be trusted to say open or shut, so the header and its tile say so instead.
    const quiet = doors.filter((d) => isQuiet(d)).length;
    const open = doors.filter((d) => d.state === 'on' && !isQuiet(d)).length;
    const noun = doors.every((d) => d.attributes.device_class === 'window') ? 'window' : 'door';

    return html`
      ${this.config.title
        ? html`<header>
            <h1>${this.config.title}</h1>
            <glass-pill class=${open ? 'ringing' : ''} tone=${open ? 'attention' : quiet ? 'neutral' : 'success'}
              >${open
                ? `${open} ${noun}${open > 1 ? 's' : ''} open`
                : quiet
                  ? `${quiet} ${noun}${quiet > 1 ? 's' : ''} not reporting`
                  : `All ${noun}s shut`}</glass-pill
            >
          </header>`
        : nothing}
      <section aria-labelledby="h">
        <h2 id="h">${this.config.heading ?? 'Doors'}</h2>
        ${doors.length ? nothing : html`<p class="none">No door or window sensors yet.</p>`}
        <div class="grid">
          ${doors.map((d) => {
            const silent = isQuiet(d);
            const isOpen = d.state === 'on' && !silent;
            const offline = isUnavailable(d);
            const when = offline
              ? 'Offline'
              : silent
                ? 'Not reporting'
                : isOpen
                  ? `Open for ${duration(d.last_changed, this.now)}`
                  : `Shut since ${clock(d.last_changed, this.now)}`;
            return html`<glass-tile
              .hass=${this.hass}
              entity=${d.entity_id}
              name=${sentence(shortName(d, ''))}
              icon=${isOpen ? 'door-open' : 'door-closed'}
              look=${isOpen ? 'attention' : 'auto'}
              line=${when}
              tap="more-info"
            ></glass-tile>`;
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
      /* The title and pill stack when they don't fit on one line (half width). */
      header {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        min-height: 48px;
      }
      h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 400;
        letter-spacing: -0.4px;
      }
      section {
        display: flex;
        flex-direction: column;
        gap: var(--glass-space-tile-gap);
      }
      h2 {
        ${heading}
      }
      .none {
        margin: 0;
        font-size: var(--glass-text-body);
        color: var(--glass-text-muted);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: var(--glass-space-tile-gap);
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

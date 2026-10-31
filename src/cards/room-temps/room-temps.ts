import { css, html, nothing, type PropertyValues } from 'lit';
import { GlassElement, openOverlays } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, openMoreInfo, registerCard } from '../../ha.js';
import { roomSummary } from '../../rooms.js';
import './room-temps-editor.js';
import { GlassSheet } from '../../elements/glass-sheet.js';
import type { GlassTempsSheet } from '../../sheets/temps-sheet.js';
import '../../sheets/temps-sheet.js';

export interface RoomTempsConfig extends LovelaceCardConfig {
  /** Hours before a sensor counts as not reporting, by type or entity, e.g. { door: 24 }. Applies to the whole dashboard. */
  quiet_hours?: Record<string, number>;
  title?: string;
  exclude_areas?: string[];
}

// The scale runs cold → comfort → warm across this range.
const LOW = 12;
const HIGH = 26;

/**
 * Every room with a temperature sensor as a row: name and humidity, a
 * cold → comfort → warm scale with a marker, and the temperature.
 */
@customElement('glass-room-temps')
export class GlassRoomTemps extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: RoomTempsConfig;
  private watched: string[] = [];

  static getConfigElement() {
    return document.createElement('glass-room-temps-editor');
  }

  static getStubConfig(): Partial<RoomTempsConfig> {
    return {};
  }

  setConfig(config: RoomTempsConfig): void {
    this.config = config;
  }

  getCardSize(): number {
    return 6;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    ensureFonts();
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has('hass') || changed.size > 1 || !this.config) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    if (!old || old.areas !== this.hass!.areas) return true;
    return this.watched.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  /** The whole card opens the room temperatures pop-up, one at a time. */
  private openTemps = () => {
    if ([...openOverlays].some((o) => o instanceof GlassSheet)) return;
    const sheet = GlassSheet.open<GlassTempsSheet>('glass-temps-sheet', this.hass!);
    sheet.excludeAreas = this.config?.exclude_areas ?? [];
  };

  render() {
    if (!this.config || !this.hass) return nothing;
    const exclude = this.config.exclude_areas ?? [];
    const rooms = Object.values(this.hass.areas ?? {})
      .filter((a) => !exclude.includes(a.area_id))
      .map((a) => roomSummary(this.hass!, a.area_id))
      .filter((r) => r.temperature !== undefined);
    this.watched = rooms.flatMap((r) => r.watch);
    if (!rooms.length) return nothing;
    // a room whose sensor has gone quiet drops to the end, greyed, with when it was last heard
    rooms.sort((a, b) => Number(!!a.quiet) - Number(!!b.quiet));

    return html`<section aria-labelledby="h">
      <button type="button" class="open" aria-label="Room temperatures" @click=${this.openTemps}></button>
      <span class="top">
        <h2 id="h">${this.config.title ?? 'By room'}</h2>
        <span class="legend">${LOW}° · comfort · ${HIGH}°</span>
      </span>
      ${rooms.map((r) => {
        const pos = Math.min(100, Math.max(0, ((r.temperature! - LOW) / (HIGH - LOW)) * 100));
        // A row opens that room's temperature sensor; anywhere else on the card opens Room temperatures.
        return html`<button
          type="button"
          class="row ${r.quiet ? 'quiet' : ''}"
          aria-label="${r.name} temperature"
          ?disabled=${!r.temperatureId}
          @click=${() => r.temperatureId && openMoreInfo(this, r.temperatureId)}
        >
          <span class="name">
            <span>${r.name}</span>
            ${r.quiet
              ? html`<span class="hum">${r.quiet}</span>`
              : r.humidity !== undefined
                ? html`<span class="hum">${Math.round(r.humidity)}% humidity</span>`
                : nothing}
          </span>
          <span class="scale" aria-hidden="true"><span class="marker" style="left: ${pos}%"></span></span>
          <span class="temp">${r.temperature!.toFixed(1)}°</span>
        </button>`;
      })}
    </section>`;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      .quiet .temp {
        color: var(--glass-text-muted);
      }
      .quiet .scale {
        opacity: 0.35;
      }
      .top {
        pointer-events: none;
      }
      /* the whole card is the button; what's drawn on it lets taps through */
      .open {
        all: unset;
        position: absolute;
        inset: 0;
        border-radius: inherit;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .open:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      section {
        position: relative;
        box-sizing: border-box;
        padding: var(--glass-space-edge) var(--glass-space-edge) 8px;
        border-radius: var(--glass-radius-card);
        background: rgba(var(--glass-surface-rgb), 0.62);
        border: 1px solid var(--glass-surface-border);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        display: flex;
        flex-direction: column;
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 6px;
      }
      h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 400;
      }
      .legend {
        font-size: var(--glass-text-caption);
        color: var(--glass-text-muted);
      }
      .row {
        all: unset;
        position: relative;
        box-sizing: border-box;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        display: flex;
        align-items: center;
        gap: 12px;
        height: 56px;
        border-top: 1px solid rgba(var(--glass-line-rgb), 0.07);
      }
      .row:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: -2px;
      }
      /* 120 wide so "Last heard 3 h ago" stays on one line; every row the same, so the scales line up */
      .name {
        width: 120px;
        flex: none;
        display: flex;
        flex-direction: column;
        line-height: 1.2;
        font-size: var(--glass-text-body);
        white-space: nowrap;
      }
      .name > span {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .hum {
        font-size: var(--glass-text-small);
        color: var(--glass-text-muted);
      }
      .scale {
        position: relative;
        flex: 1;
        height: 8px;
        border-radius: 4px;
        background: linear-gradient(90deg, #cfe3f7 0%, #e9f3d2 40%, #e9f3d2 60%, #f7c2a4 100%);
      }
      .marker {
        position: absolute;
        top: -4px;
        width: 2px;
        height: 16px;
        margin-left: -1px;
        border-radius: 1px;
        background: var(--glass-ink);
      }
      .temp {
        width: 48px;
        text-align: right;
        font-size: var(--glass-text-body);
      }
    `,
  ];
}

registerCard({
  type: 'glass-room-temps',
  name: 'Glass · Temperature by room',
  description: 'Every room’s temperature on a cold-to-warm scale, with humidity.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-room-temps': GlassRoomTemps;
  }
}

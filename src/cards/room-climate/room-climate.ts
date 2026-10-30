import { css, html, nothing, type PropertyValues } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, openMoreInfo, registerCard } from '../../ha.js';
import { areaEntityIds, roomSummary } from '../../rooms.js';
import { bandStyle, tempBand } from '../../climate.js';
import { ago } from '../../time.js';
import './room-climate-editor.js';

export interface RoomClimateConfig extends LovelaceCardConfig {
  area: string;
}

/**
 * A room's climate as two tiles: the temperature with its band pill (and, in a
 * bedroom, whether it's good for sleep), and the humidity on the cold-to-warm
 * scale with the air pressure when the room has a sensor for it.
 */
@customElement('glass-room-climate')
export class GlassRoomClimate extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: RoomClimateConfig;
  private watched: string[] = [];

  static getConfigElement() {
    return document.createElement('glass-room-climate-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<RoomClimateConfig> {
    return { area: Object.keys(hass.areas ?? {})[0] ?? '' };
  }

  setConfig(config: RoomClimateConfig): void {
    if (!config.area) throw new Error('Choose a room');
    this.config = config;
  }

  getCardSize(): number {
    return 3;
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
    return !old || this.watched.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const hass = this.hass;
    const room = roomSummary(hass, this.config.area);
    const ids = areaEntityIds(hass, this.config.area);
    const sensorOf = (cls: string) => ids.find((id) => id.startsWith('sensor.') && hass.states[id]?.attributes.device_class === cls);
    const tempId = room.temperature !== undefined ? (hass.areas?.[this.config.area]?.temperature_entity_id ?? sensorOf('temperature')) : undefined;
    const humId = room.humidity !== undefined ? (hass.areas?.[this.config.area]?.humidity_entity_id ?? sensorOf('humidity')) : undefined;
    const pressureId = sensorOf('atmospheric_pressure') ?? sensorOf('pressure');
    const pressure = pressureId ? Number(hass.states[pressureId].state) : NaN;
    this.watched = [tempId, humId, pressureId].filter((id): id is string => !!id);
    if (room.temperature === undefined && room.humidity === undefined) return nothing;

    const t = room.temperature;
    const band = t !== undefined ? tempBand(t) : undefined;
    const look = band ? bandStyle(band) : undefined;
    // A bedroom says whether it's right for sleeping (16–19°); elsewhere, how fresh the reading is.
    const bedroom = /bed/i.test(room.name);
    const note =
      t === undefined
        ? ''
        : bedroom
          ? t < 16
            ? 'A bit cold for sleep'
            : t > 19
              ? 'A bit warm for sleep'
              : 'Good for sleep'
          : tempId
            ? `Updated ${ago(hass.states[tempId].last_changed)}`
            : '';

    return html`<section aria-label="${room.name} climate">
      ${t !== undefined
        ? html`<button type="button" class="tile" style=${styleMap({ background: look!.background })} @click=${() => tempId && openMoreInfo(this, tempId)}>
            <span class="top"
              ><span class="label">Temperature</span
              ><span class="pill" style=${styleMap({ background: look!.pillBg, color: look!.pillFg })}>${band}</span></span
            >
            <span class="bottom"><span class="value">${t.toFixed(1)}°</span>${note ? html`<span class="note">${note}</span>` : nothing}</span>
          </button>`
        : nothing}
      ${room.humidity !== undefined
        ? html`<button type="button" class="tile" @click=${() => humId && openMoreInfo(this, humId)}>
            <span class="label">Humidity</span>
            <span class="bottom">
              <span class="value">${Math.round(room.humidity)}%</span>
              <span class="scale" aria-hidden="true"><span class="marker" style="left: ${Math.min(100, Math.max(0, room.humidity))}%"></span></span>
              ${Number.isFinite(pressure) ? html`<span class="note">${Math.round(pressure)} hPa pressure</span>` : nothing}
            </span>
          </button>`
        : nothing}
    </section>`;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      section {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--glass-space-tile-gap);
      }
      .tile {
        all: unset;
        box-sizing: border-box;
        height: 150px;
        padding: var(--glass-space-tile);
        border-radius: var(--glass-radius-tile);
        background: rgba(var(--glass-surface-rgb), 0.75);
        border: 1px solid var(--glass-surface-border);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
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
      .label,
      .note {
        color: var(--glass-text-muted);
      }
      .label {
        font-size: var(--glass-text-caption);
      }
      .note {
        font-size: var(--glass-text-small);
      }
      .pill {
        height: 24px;
        padding: 0 8px;
        border-radius: 12px;
        font-size: var(--glass-text-tiny);
        display: flex;
        align-items: center;
      }
      .bottom {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .value {
        font-size: 40px;
        font-weight: 300;
        letter-spacing: -1px;
        line-height: 1;
      }
      .scale {
        position: relative;
        height: 6px;
        border-radius: 3px;
        background: linear-gradient(90deg, #cfe3f7 0%, #e9f3d2 45%, #f7c2a4 100%);
      }
      .marker {
        position: absolute;
        top: -4px;
        width: 2px;
        height: 14px;
        margin-left: -1px;
        border-radius: 1px;
        background: var(--glass-ink);
      }
    `,
  ];
}

registerCard({
  type: 'glass-room-climate',
  name: 'Glass · Room climate',
  description: 'A room’s temperature (with its band, and sleep comfort in a bedroom) and humidity, as two tiles.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-room-climate': GlassRoomClimate;
  }
}

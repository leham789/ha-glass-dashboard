import '../../elements/glass-number.js';
import '../../elements/glass-meters.js';
import { css, html, nothing, type PropertyValues } from 'lit';
import '../../elements/glass-chip.js';
import { tileSurface } from '../../elements/surfaces.js';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, openMoreInfo, registerCard } from '../../ha.js';
import { areaEntityIds, roomSummary } from '../../rooms.js';
import { QUIET_LOOK, bandStyle, tempBand, humidityBand, HUMIDITY_PILLS } from '../../climate.js';
import { ago } from '../../time.js';
import './room-climate-editor.js';

export interface RoomClimateConfig extends LovelaceCardConfig {
  /** Hours before a sensor counts as not reporting, by type or entity, e.g. { door: 24 }. Applies to the whole dashboard. */
  quiet_hours?: Record<string, number>;
  area: string;
  /** Show the temperature's band pill (Cold, Comfy, Warm…). Default on. */
  temperature_band?: boolean;
  /** Show the humidity's band pill (Dry, Comfy, Damp). Default on. */
  humidity_band?: boolean;
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

    this.needs = undefined;
    if (!config.area) return this.setUp(config, 'Choose a room');
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
    if (this.needs) return true;
    if (!changed.has('hass') || changed.size > 1 || !this.config) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    return !old || this.watched.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  render() {
    if (this.needs) return this.renderSetup('thermometer');
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
    // A sensor that's gone quiet keeps its last readings, greyed, with no pill: the line under each says "Not reporting".
    const quiet = room.quiet;
    const band = quiet ? undefined : t !== undefined ? tempBand(t) : undefined;
    const hBand = quiet || this.config.humidity_band === false || room.humidity === undefined ? undefined : humidityBand(room.humidity);
    const look = quiet ? QUIET_LOOK : band ? bandStyle(band as ReturnType<typeof tempBand>) : undefined;
    // A bedroom says whether it's right for sleeping (16–19°); elsewhere, how fresh the reading is.
    const bedroom = /bed/i.test(room.name);
    const note =
      t === undefined
        ? ''
        : quiet
          ? 'Not reporting'
        : bedroom
          ? t < 16
            ? 'A bit cold for sleep'
            : t > 19
              ? 'A bit warm for sleep'
              : 'Good for sleep'
          : tempId
            ? `Updated ${ago(hass.states[tempId].last_changed)}`
            : '';

    return html`<section aria-label="${room.name} climate" class=${quiet ? 'quiet' : ''}>
      ${t !== undefined
        ? html`<button type="button" class="tile" style=${styleMap({ background: look!.background })} @click=${() => tempId && openMoreInfo(this, tempId)}>
            <span class="top"
              ><span class="label">Temperature</span
              >${band && this.config.temperature_band !== false ? html`<glass-tag bg=${look!.pillBg} fg=${look!.pillFg}>${band}</glass-tag>` : nothing}</span
            >
            <span class="bottom"><glass-number size="stat-m" value="${t.toFixed(1)}°" ?grey=${!!quiet}></glass-number>${note ? html`<span class="note">${note}</span>` : nothing}</span>
          </button>`
        : nothing}
      ${room.humidity !== undefined
        ? html`<button type="button" class="tile" @click=${() => humId && openMoreInfo(this, humId)}>
            <span class="top"
              ><span class="label">Humidity</span
              >${hBand ? html`<glass-tag bg=${HUMIDITY_PILLS[hBand].pillBg} fg=${HUMIDITY_PILLS[hBand].pillFg}>${hBand}</glass-tag>` : nothing}</span
            >
            <span class="bottom">
              <glass-number size="stat-m" value="${Math.round(room.humidity)}%" ?grey=${!!quiet}></glass-number>
              <glass-scale kind="humidity" .value=${room.humidity} ?quiet=${!!quiet} aria-hidden="true"></glass-scale>
              ${quiet
                ? html`<span class="note">Not reporting</span>`
                : Number.isFinite(pressure)
                  ? html`<span class="note">${Math.round(pressure)} hPa pressure</span>`
                  : nothing}
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
      /* Half width: the tiles stack, one above the other. */
      :host([narrow]) section {
        grid-template-columns: minmax(0, 1fr);
      }
      .tile {
        all: unset; /* first, or it wipes the surface */
        ${tileSurface}
        box-sizing: border-box;
        height: var(--glass-height-tile);
        padding: var(--glass-space-tile);
        border-radius: var(--glass-radius-tile);
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
      .bottom {
        display: flex;
        flex-direction: column;
        gap: 8px;
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

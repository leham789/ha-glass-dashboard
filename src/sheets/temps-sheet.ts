import { css, html, nothing, type CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { GlassSheet } from '../elements/glass-sheet.js';
import { navigate } from '../ha.js';
import { bandStyle, tempBand } from '../climate.js';
import { roomSummary } from '../rooms.js';

type Sort = 'Rooms' | 'Coldest' | 'Warmest';

/**
 * The Room temperatures pop-up: house average and the weather outside,
 * then a tile per room with its band pill and a humidity scale.
 */
@customElement('glass-temps-sheet')
export class GlassTempsSheet extends GlassSheet {
  @property({ attribute: false }) excludeAreas: string[] = [];
  @property({ attribute: false }) energyPath?: string;
  @state() private sort: Sort = 'Coldest';

  protected sheetTitle = 'Room temperatures';
  protected sheetIcon = 'thermometer' as const;
  protected sheetIconBg = '#F7C2A4';

  protected renderBody() {
    const hass = this.hass!;
    const rooms = Object.values(hass.areas ?? {})
      .filter((a) => !this.excludeAreas.includes(a.area_id))
      .map((a) => roomSummary(hass, a.area_id))
      .filter((r) => r.temperature !== undefined);
    if (this.sort === 'Coldest') rooms.sort((a, b) => a.temperature! - b.temperature!);
    if (this.sort === 'Warmest') rooms.sort((a, b) => b.temperature! - a.temperature!);

    const average = rooms.length ? rooms.reduce((s, r) => s + r.temperature!, 0) / rooms.length : undefined;
    const weather = Object.values(hass.states).find((e) => e.entity_id.startsWith('weather.'));
    const outside = weather?.attributes.temperature;

    return html`
      <div class="summary">
        <span class="avg">
          <span class="label">House average</span>
          <span class="n">${average === undefined ? '–' : `${average.toFixed(1)}°`}</span>
        </span>
        ${weather && typeof outside === 'number'
          ? html`<span class="outside">
              <span>Outside ${outside.toFixed(1)}°</span>
              <span class="label">${condition(weather.state)}${
                typeof weather.attributes.humidity === 'number' ? ` · ${Math.round(weather.attributes.humidity)}%` : ''
              }</span>
            </span>`
          : nothing}
      </div>
      <div class="segmented" role="group" aria-label="Sort">
        ${(['Rooms', 'Coldest', 'Warmest'] as Sort[]).map(
          (s) => html`<button
            type="button"
            class=${s === this.sort ? 'current' : ''}
            aria-pressed=${s === this.sort ? 'true' : 'false'}
            @click=${() => (this.sort = s)}
          >
            ${s}
          </button>`,
        )}
      </div>
      <div class="grid">
        ${rooms.map((r) => {
          const band = tempBand(r.temperature!);
          const look = bandStyle(band);
          return html`<div class="tile" style=${styleMap({ background: look.background })}>
            <span class="top">
              <span class="name">${r.name}</span>
              <span class="pill" style=${styleMap({ background: look.pillBg, color: look.pillFg })}>${band}</span>
            </span>
            <span class="temp">${r.temperature!.toFixed(1)}°</span>
            ${r.humidity !== undefined
              ? html`<span class="hum">
                  <span class="row"><span class="muted">Humidity</span><span>${Math.round(r.humidity)}%</span></span>
                  <span class="scale" aria-hidden="true"
                    ><span class="marker" style="left: ${Math.min(100, Math.max(0, r.humidity))}%"></span
                  ></span>
                </span>`
              : html`<span></span>`}
          </div>`;
        })}
      </div>
      ${!rooms.length
        ? html`<p class="empty">No rooms have a temperature sensor yet. Choose one per area in Settings › Areas.</p>`
        : nothing}
      ${this.energyPath
        ? html`<button type="button" class="wide" @click=${() => this.goEnergy()}>
            Go to Heating &amp; Energy <glass-icon name="arrow-up-right" size="16" stroke="1.8"></glass-icon>
          </button>`
        : nothing}
    `;
  }

  private goEnergy() {
    this.close();
    navigate(this.energyPath!);
  }

  static styles: CSSResultGroup = [
    GlassSheet.styles,
    css`
      .summary {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px;
      }
      .avg,
      .outside {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .outside {
        align-items: flex-end;
        gap: 2px;
        padding-bottom: 6px;
        font-size: var(--glass-text-body);
      }
      .label {
        font-size: var(--glass-text-caption);
        color: var(--glass-text-muted);
      }
      .avg .label {
        font-size: var(--glass-text-chip);
      }
      .n {
        font-size: 72px;
        font-weight: 200;
        letter-spacing: -3px;
        line-height: 0.9;
      }
      .segmented {
        display: flex;
        gap: 4px;
        padding: 4px;
        border-radius: 26px;
        background: rgba(18, 19, 22, 0.06);
      }
      .segmented button {
        all: unset;
        flex: 1;
        height: 44px;
        border-radius: 22px;
        text-align: center;
        font-size: var(--glass-text-chip);
        cursor: pointer;
      }
      .segmented button.current {
        background: #fff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--glass-space-tile-gap);
      }
      .tile {
        box-sizing: border-box;
        height: 172px;
        padding: var(--glass-space-tile);
        border-radius: var(--glass-radius-tile);
        border: 1px solid var(--glass-surface-border);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 6px;
      }
      .name {
        font-size: var(--glass-text-body);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pill {
        flex: none;
        height: 24px;
        padding: 0 8px;
        border-radius: 12px;
        font-size: var(--glass-text-tiny);
        display: flex;
        align-items: center;
      }
      .temp {
        font-size: 44px;
        font-weight: 300;
        letter-spacing: -1.5px;
        line-height: 1;
      }
      .hum {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .row {
        display: flex;
        justify-content: space-between;
        font-size: var(--glass-text-small);
      }
      .muted {
        color: var(--glass-text-secondary);
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
      .wide {
        all: unset;
        box-sizing: border-box;
        height: 56px;
        border-radius: 28px;
        background: var(--glass-ink);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: var(--glass-text-body);
        cursor: pointer;
      }
      .segmented button:focus-visible,
      .wide:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      .empty {
        margin: 0;
        font-size: var(--glass-text-body);
        color: var(--glass-text-muted);
      }
    `,
  ];
}

/** HA weather states ("partlycloudy", "clear-night") as words. */
function condition(state: string): string {
  const words: Record<string, string> = {
    'clear-night': 'Clear',
    partlycloudy: 'Partly cloudy',
    lightning: 'Thunder',
    'lightning-rainy': 'Thunderstorms',
    snowy: 'Snow',
    'snowy-rainy': 'Sleet',
    rainy: 'Rain',
    pouring: 'Heavy rain',
    windy: 'Windy',
    'windy-variant': 'Windy',
    exceptional: 'Unusual weather',
  };
  return words[state] ?? state.charAt(0).toUpperCase() + state.slice(1);
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-temps-sheet': GlassTempsSheet;
  }
}

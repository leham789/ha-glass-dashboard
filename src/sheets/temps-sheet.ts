import '../elements/glass-meters.js';
import '../elements/glass-number.js';
import { css, html, nothing, type CSSResultGroup } from 'lit';
import '../elements/glass-chip.js';
import '../elements/glass-button.js';
import type { GlassSegmented } from '../elements/glass-button.js';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { GlassSheet } from '../elements/glass-sheet.js';
import { navigate, openMoreInfo } from '../ha.js';
import { type Band, QUIET_LOOK, bandStyle, tempBand } from '../climate.js';
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
  protected sheetIconBg = 'var(--glass-peach)';

  protected renderBody() {
    const hass = this.hass!;
    const rooms = Object.values(hass.areas ?? {})
      .filter((a) => !this.excludeAreas.includes(a.area_id))
      .map((a) => roomSummary(hass, a.area_id))
      .filter((r) => r.temperature !== undefined);
    if (this.sort === 'Coldest') rooms.sort((a, b) => a.temperature! - b.temperature!);
    if (this.sort === 'Warmest') rooms.sort((a, b) => b.temperature! - a.temperature!);
    // A room whose sensor has gone quiet keeps its last reading, greyed, at the end, and doesn't count in the average.
    rooms.sort((a, b) => Number(!!a.quiet) - Number(!!b.quiet));
    const live = rooms.filter((r) => !r.quiet);

    const average = live.length ? live.reduce((s, r) => s + r.temperature!, 0) / live.length : undefined;
    const weather = Object.values(hass.states).find((e) => e.entity_id.startsWith('weather.'));
    const outside = weather?.attributes.temperature;

    return html`
      <div class="summary">
        <span class="avg">
          <span class="label">${live.length < rooms.length ? `Average of ${live.length} rooms` : 'House average'}</span>
          <glass-number size="display-s" .value=${average === undefined ? '' : `${average.toFixed(1)}°`}></glass-number>
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
      <glass-segmented
        label="Sort"
        .options=${(['Rooms', 'Coldest', 'Warmest'] as Sort[]).map((s) => ({ value: s, label: s }))}
        .value=${this.sort}
        @change=${(ev: Event) => (this.sort = (ev.target as GlassSegmented).value as Sort)}
      ></glass-segmented>
      <div class="grid">
        ${rooms.map((r) => {
          const band = r.quiet ? 'Not reporting' : tempBand(r.temperature!);
          const look = r.quiet ? QUIET_LOOK : bandStyle(band as Band);
          // Tap a room for its temperature sensor's pop-up: history and facts.
          return html`<button
            type="button"
            class="tile ${r.quiet ? 'quiet' : ''}"
            style=${styleMap({ background: look.background })}
            aria-label="${r.name} temperature"
            ?disabled=${!r.temperatureId}
            @click=${() => r.temperatureId && openMoreInfo(this, r.temperatureId)}
          >
            <span class="top">
              <span class="name">${r.name}</span>
              <glass-tag bg=${look.pillBg} fg=${look.pillFg}>${band}</glass-tag>
            </span>
            <glass-number class="temp" size="stat-l" value="${r.temperature!.toFixed(1)}°" ?grey=${!!r.quiet}></glass-number>
            ${r.humidity !== undefined || r.quiet
              ? html`<span class="hum">
                  <span class="row"
                    ><span class="muted">${r.quiet ?? 'Humidity'}</span><span>${r.quiet || r.humidity === undefined ? '' : `${Math.round(r.humidity)}%`}</span></span
                  >
                  <glass-scale kind="humidity" .value=${r.humidity ?? 0} ?quiet=${!!r.quiet} aria-hidden="true"></glass-scale>
                </span>`
              : html`<span></span>`}
          </button>`;
        })}
      </div>
      ${!rooms.length
        ? html`<p class="empty">No rooms have a temperature sensor yet. Choose one per area in Settings › Areas.</p>`
        : nothing}
      ${this.energyPath
        ? html`<glass-button size="full" @click=${() => this.goEnergy()}>Go to Heating &amp; Energy <glass-icon name="arrow-up-right" size="16" stroke="1.8"></glass-icon></glass-button>`
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
        gap: 4px;
        padding-bottom: 8px;
        font-size: var(--glass-text-body);
      }
      .label {
        font-size: var(--glass-text-caption);
        color: var(--glass-text-muted);
      }
      .avg .label {
        font-size: var(--glass-text-chip);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--glass-space-tile-gap);
      }
      .tile {
        all: unset;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        box-sizing: border-box;
        height: 172px;
        padding: var(--glass-space-tile);
        border-radius: var(--glass-radius-tile);
        border: 1px solid var(--glass-surface-border);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .tile:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .name {
        font-size: var(--glass-text-body);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .hum {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .row {
        display: flex;
        justify-content: space-between;
        font-size: var(--glass-text-small);
      }
      .muted {
        color: var(--glass-text-secondary);
      }
      /* a sensor that's gone quiet: its last reading stays, greyed */
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

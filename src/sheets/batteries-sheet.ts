import { css, html, nothing, type CSSResultGroup } from 'lit';
import { customElement } from 'lit/decorators.js';
import { GlassSheet } from '../elements/glass-sheet.js';
import { openMoreInfo } from '../ha.js';
import { batteryIcon } from '../climate.js';
import { type Battery, LOW_BATTERY, batteries } from '../batteries.js';

/**
 * The Batteries pop-up: how many are low, then every battery lowest first as
 * a small tile whose icon shows the charge. Under 40% the tile turns dark.
 * Tap a tile for HA's own details.
 */
@customElement('glass-batteries-sheet')
export class GlassBatteriesSheet extends GlassSheet {
  protected sheetTitle = 'Batteries';
  protected sheetIcon = 'battery-low' as const;
  protected sheetIconBg = '#CDB8F5';

  protected renderBody() {
    const all = batteries(this.hass!);
    const sensors = all.filter((b) => !b.phone);
    const phones = all.filter((b) => b.phone);
    const low = all.filter((b) => b.level < LOW_BATTERY).length;
    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

    return html`
      <div class="summary">
        <span class="big"><span class="n">${low}</span><span class="unit">below ${LOW_BATTERY}%</span></span>
        <span class="counts">
          ${plural(sensors.length, 'sensor', 'sensors')}${phones.length
            ? html`<br />${plural(phones.length, 'phone', 'phones')}`
            : nothing}
        </span>
      </div>
      ${this.section('Sensors & remotes', sensors)} ${this.section('Phones', phones)}
      ${!all.length ? html`<p class="empty">No battery sensors found.</p>` : nothing}
    `;
  }

  private section(title: string, items: Battery[]) {
    if (!items.length) return nothing;
    return html`<div class="section">
      <h2>${title}</h2>
      <div class="grid">
        ${items.map(
          (b) => html`<button
            type="button"
            class="tile ${b.level < LOW_BATTERY ? 'low' : ''}"
            aria-label="${b.room} ${b.device}, ${b.level}%"
            @click=${() => openMoreInfo(this, b.id)}
          >
            <glass-icon name=${batteryIcon(b.level)} size="24"></glass-icon>
            <span class="info">
              <span class="level">${b.level}%</span>
              <span class="sub">${b.room}</span>
              ${b.device ? html`<span class="sub">${b.device}</span>` : nothing}
            </span>
          </button>`,
        )}
      </div>
    </div>`;
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
      .big {
        display: flex;
        align-items: baseline;
        line-height: 0.9;
      }
      .n {
        font-size: 88px;
        font-weight: 200;
        letter-spacing: -3px;
      }
      .unit {
        margin-left: 6px;
        font-size: 22px;
        font-weight: 300;
        color: var(--glass-text-muted);
      }
      .counts {
        padding-bottom: 8px;
        text-align: right;
        font-size: var(--glass-text-caption);
        color: var(--glass-text-muted);
      }
      .section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      h2 {
        margin: 4px 0 0;
        font-size: var(--glass-text-chip);
        font-weight: 400;
        color: var(--glass-text-muted);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .tile {
        all: unset;
        box-sizing: border-box;
        height: 120px;
        padding: var(--glass-space-small-tile);
        border-radius: var(--glass-radius-small-tile);
        background: rgba(var(--glass-surface-rgb), 0.82);
        border: 1px solid var(--glass-surface-border);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .tile.low {
        background: var(--glass-ink);
        border-color: var(--glass-ink);
        color: var(--glass-on-ink);
      }
      .tile:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      .info {
        display: flex;
        flex-direction: column;
        line-height: 1.2;
        min-width: 0;
      }
      .level {
        font-size: 22px;
        font-weight: 300;
      }
      .sub {
        font-size: var(--glass-text-small);
        color: var(--glass-text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .low .sub {
        color: color-mix(in srgb, var(--glass-on-ink) 75%, transparent);
      }
      .empty {
        margin: 0;
        font-size: var(--glass-text-body);
        color: var(--glass-text-muted);
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-batteries-sheet': GlassBatteriesSheet;
  }
}

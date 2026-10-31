import { css, html, nothing, type CSSResultGroup } from 'lit';
import { customElement } from 'lit/decorators.js';
import { GlassSheet } from '../elements/glass-sheet.js';
import { type HassEntity, openMoreInfo } from '../ha.js';
import type { IconName } from '../icons.js';
import { areaOf, shortName } from '../rooms.js';
import { lastHeard, quietSensors } from '../stale.js';
import { formatValue } from '../format.js';
import '../elements/glass-icon.js';

const DOORS = new Set(['door', 'garage_door', 'opening']);

/**
 * The Not reporting pop-up (from the grey chip on Home): every sensor
 * device the cards read that HA hasn't heard from for longer than it should, longest
 * quiet first, with when it was last heard and its last reading, greyed.
 * A door says "Was shut", never "Shut". Tap a row for its pop-up.
 */
@customElement('glass-quiet-sheet')
export class GlassQuietSheet extends GlassSheet {
  protected sheetTitle = 'Not reporting';
  protected sheetIcon = 'wifi-off' as const;

  // Grey, not a pastel: the icon takes the secondary text colour so it reads in dark mode too.
  protected renderIcon() {
    return html`<span class="icon" style="background: var(--glass-neutral-tint); color: var(--glass-text-secondary)">
      <glass-icon name="wifi-off" size="20" stroke="1.7"></glass-icon>
    </span>`;
  }

  private icon(e: HassEntity): IconName {
    const dc = e.attributes.device_class;
    if (DOORS.has(dc)) return 'door-closed';
    if (dc === 'window') return 'layout-panel-top';
    if (dc === 'battery') return 'battery-low';
    if (dc === 'humidity') return 'droplet';
    return 'thermometer';
  }

  /** "Office Climate", "Back Door": the device's name, with the room in front when the name doesn't say it. */
  private name(e: HassEntity): string {
    const hass = this.hass!;
    const areaId = areaOf(hass, e.entity_id);
    const room = areaId ? (hass.areas?.[areaId]?.name ?? '') : '';
    const deviceId = hass.entities?.[e.entity_id]?.device_id;
    const device = deviceId ? hass.devices?.[deviceId] : undefined;
    const what = String(device?.name_by_user ?? device?.name ?? shortName(e, ''));
    return !room || what.toLowerCase().includes(room.toLowerCase()) ? what : `${room} · ${what}`;
  }

  /** The last readings: "14.9° · 73%", or "Was shut" for a door. */
  private last(es: HassEntity[]): string {
    return es
      .map((e) =>
        e.entity_id.startsWith('binary_sensor.')
          ? e.state === 'on'
            ? 'Was open'
            : 'Was shut'
          : formatValue(e).value.replace(' °C', '°').replace(' °F', '°').replace(' %', '%'),
      )
      .join(' · ');
  }

  protected renderBody() {
    const { quiet, watched } = quietSensors(this.hass!);
    return html`
      <div class="summary">
        <span class="big"><span class="n">${quiet.length}</span><span class="unit">quiet</span></span>
        <span class="counts">of ${watched} sensors${quiet.length < watched ? html`<br />the rest are fine` : nothing}</span>
      </div>
      ${quiet.length
        ? html`<div class="rows">
            ${quiet.map(
              (es) => html`<button type="button" class="row" @click=${() => openMoreInfo(this, es[0].entity_id)}>
                <span class="icon"><glass-icon name=${this.icon(es[0])} size="18"></glass-icon></span>
                <span class="text"><span class="name">${this.name(es[0])}</span><span class="when">${lastHeard(es[0])}</span></span>
                <span class="last">${this.last(es)}</span>
              </button>`,
            )}
          </div>`
        : html`<p class="empty">Every sensor is reporting.</p>`}
      <div class="tip">
        <span>Usually back on their own</span>
        <span class="muted">Zigbee sensors drop out now and then. If one stays quiet for a day, check its battery, or move it nearer a plugged-in Zigbee device.</span>
      </div>
    `;
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
      .rows {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .row {
        all: unset;
        box-sizing: border-box;
        height: 64px;
        padding: 0 16px 0 10px;
        border-radius: 32px;
        border: 1px solid var(--glass-hairline);
        background: var(--glass-solid);
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .row:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      .icon {
        width: 44px;
        height: 44px;
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
        line-height: 1.25;
      }
      .name {
        font-size: var(--glass-text-body);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .when,
      .last,
      .muted {
        color: var(--glass-text-muted);
      }
      .when {
        font-size: var(--glass-text-small);
      }
      .last {
        font-size: var(--glass-text-body);
      }
      .tip {
        padding: 14px 16px;
        border-radius: var(--glass-radius-small-tile);
        background: rgba(var(--glass-surface-rgb), 0.6);
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: var(--glass-text-chip);
      }
      .tip .muted {
        font-size: var(--glass-text-caption);
        line-height: 1.4;
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
    'glass-quiet-sheet': GlassQuietSheet;
  }
}

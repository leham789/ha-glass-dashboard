import { css, html, nothing, type CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { GlassSheet } from '../elements/glass-sheet.js';
import { isUnavailable } from '../ha.js';
import { lightRow, lightRowStyles } from '../elements/light-row.js';
import { type RoomLight, lightsByArea } from '../rooms.js';

type Filter = 'On' | 'All' | 'Offline';

/**
 * The Lights pop-up: how many lights are on, All off (then Undo), On / All /
 * Offline filters, and every light grouped by room as a 64-high row whose
 * yellow fill shows its brightness. Tap a row to toggle it.
 */
@customElement('glass-lights-sheet')
export class GlassLightsSheet extends GlassSheet {
  @property({ attribute: false }) excludeAreas: string[] = [];
  @state() private filter: Filter = 'All';
  /** Lights that All off switched off, so Undo can turn them back on. */
  @state() private saved?: string[];

  protected sheetTitle = 'Lights';
  protected sheetIcon = 'lightbulb' as const;

  protected renderBody() {
    const hass = this.hass!;
    const groups = lightsByArea(hass, this.excludeAreas);
    const all = groups.flatMap((g) => g.lights);
    const reachable = all.filter((l) => !isUnavailable(hass.states[l.id]));
    const onIds = all.filter((l) => l.on).map((l) => l.id);
    const showUndo = !onIds.length && !!this.saved?.length;

    const visible = (l: RoomLight) =>
      this.filter === 'All' ||
      (this.filter === 'On' && l.on) ||
      (this.filter === 'Offline' && isUnavailable(hass.states[l.id]));

    return html`
      <div class="summary">
        <span class="big"><span class="n">${onIds.length}</span><span class="unit">on of ${reachable.length}</span></span>
        ${onIds.length || showUndo
          ? html`<button type="button" class="primary" @click=${() => (showUndo ? this.undo() : this.allOff(onIds))}>
              <glass-icon name="power" size="18" stroke="1.7"></glass-icon>${showUndo ? 'Undo' : 'All off'}
            </button>`
          : nothing}
      </div>
      <div class="filters" role="group" aria-label="Filter">
        ${(['On', 'All', 'Offline'] as Filter[]).map(
          (f) => html`<button
            type="button"
            class=${f === this.filter ? 'current' : ''}
            aria-pressed=${f === this.filter ? 'true' : 'false'}
            @click=${() => (this.filter = f)}
          >
            ${f}
          </button>`,
        )}
      </div>
      ${groups.map((g) => {
        const shown = g.lights.filter(visible);
        if (!shown.length) return nothing;
        const on = g.lights.filter((l) => l.on).length;
        return html`<div class="group">
          <h2><span>${g.name}</span><span>${on ? `${on} on` : 'All off'}</span></h2>
          ${shown.map((l) => this.renderRow(l))}
        </div>`;
      })}
      ${this.filter !== 'All' && !all.some(visible)
        ? html`<p class="empty">${this.filter === 'On' ? 'No lights are on.' : 'Every light is reachable.'}</p>`
        : nothing}
    `;
  }

  private renderRow(l: RoomLight) {
    return lightRow(this.hass!, l);
  }

  private allOff(ids: string[]) {
    this.saved = ids;
    this.hass!.callService('light', 'turn_off', { entity_id: ids });
  }

  private undo() {
    this.hass!.callService('light', 'turn_on', { entity_id: this.saved! });
    this.saved = undefined;
  }

  static styles: CSSResultGroup = [
    GlassSheet.styles,
    lightRowStyles,
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
      .primary {
        all: unset;
        height: 52px;
        padding: 0 20px;
        border-radius: 26px;
        background: var(--glass-ink);
        color: var(--glass-on-ink);
        font-size: var(--glass-text-body);
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }
      .filters {
        display: flex;
        gap: 4px;
        padding: 4px;
        border-radius: 26px;
        background: rgba(var(--glass-line-rgb), 0.06);
      }
      .filters button {
        all: unset;
        flex: 1;
        height: 44px;
        border-radius: 22px;
        text-align: center;
        font-size: var(--glass-text-chip);
        cursor: pointer;
      }
      .filters button.current {
        background: var(--glass-raised);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }
      .group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      h2 {
        margin: 4px 0 0;
        font-size: var(--glass-text-chip);
        font-weight: 400;
        color: var(--glass-text-muted);
        display: flex;
        justify-content: space-between;
      }
      .primary:focus-visible,
      .filters button:focus-visible {
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

declare global {
  interface HTMLElementTagNameMap {
    'glass-lights-sheet': GlassLightsSheet;
  }
}

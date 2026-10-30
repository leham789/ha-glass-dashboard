import { css, html, nothing, type CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { GlassSheet } from '../elements/glass-sheet.js';
import { isUnavailable } from '../ha.js';
import { brightnessPct } from '../light-colour.js';
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
    const entity = this.hass!.states[l.id];
    const offline = isUnavailable(entity);
    const pct = brightnessPct(entity);
    const fill = l.on ? (pct ?? 100) : 0;
    const state = offline ? 'Offline' : l.on ? (pct === undefined ? 'On' : `${pct}%`) : 'Off';
    return html`<button
      type="button"
      class="row ${l.on ? 'on' : ''}"
      ?disabled=${offline}
      aria-pressed=${l.on ? 'true' : 'false'}
      @click=${() => this.hass!.callService('light', l.on ? 'turn_off' : 'turn_on', { entity_id: l.id })}
    >
      <span class="fill" style="width: ${fill}%"></span>
      <span class="bulb"><glass-icon name="lightbulb" size="18"></glass-icon></span>
      <span class="name">${l.name}</span>
      <span class="state">${state}</span>
    </button>`;
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
      .row {
        all: unset;
        position: relative;
        overflow: hidden;
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
      .row:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .fill {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        border-radius: 32px;
        background: var(--glass-light-fill);
        transition: width 0.25s ease;
      }
      .bulb {
        position: relative;
        width: 44px;
        height: 44px;
        flex: none;
        border-radius: 50%;
        background: var(--glass-neutral-tint);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .row.on .bulb {
        background: rgba(var(--glass-surface-rgb), 0.75);
      }
      .name {
        position: relative;
        flex: 1;
        font-size: var(--glass-text-body);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .state {
        position: relative;
        font-size: var(--glass-text-caption);
        color: var(--glass-text-secondary);
      }
      .primary:focus-visible,
      .filters button:focus-visible,
      .row:focus-visible {
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

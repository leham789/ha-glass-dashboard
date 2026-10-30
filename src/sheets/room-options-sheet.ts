import { css, html, nothing, type CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { GlassSheet } from '../elements/glass-sheet.js';
import { isUnavailable } from '../ha.js';
import { brightnessPct } from '../light-colour.js';
import { type IconName } from '../icons.js';
import { LOW_BATTERY, batteries } from '../batteries.js';
import { areaEntityIds, areaOf, roomSummary, shortName } from '../rooms.js';
import { onPrefsChange, prefs, updatePrefs } from '../prefs.js';
import { haptic } from '../motion.js';

type Action = 'off' | 'dim' | 'warm';

/**
 * Room options, from the room's name on its screen: quick actions for all
 * the room's lights, which lights to show on the room screen, pin to Home,
 * the room's devices, and a way into the area in Home Assistant.
 */
@customElement('glass-room-options-sheet')
export class GlassRoomOptionsSheet extends GlassSheet {
  @property() area = '';
  @state() private done?: Action;
  private stopPrefs?: () => void;

  protected sheetTitle = '';
  protected sheetIcon: IconName = 'house';
  protected sheetIconBg = '#F7D9A0';

  connectedCallback(): void {
    super.connectedCallback();
    this.stopPrefs = onPrefsChange(() => this.requestUpdate());
  }

  disconnectedCallback(): void {
    this.stopPrefs?.();
    super.disconnectedCallback();
  }

  protected willUpdate(): void {
    const a = this.hass?.areas?.[this.area];
    this.sheetTitle = a?.name ?? 'Room';
    this.sheetIcon = areaIcon(a?.name ?? '');
  }

  protected renderBody() {
    const hass = this.hass!;
    const room = roomSummary(hass, this.area);
    const hidden = new Set(prefs().hidden[this.area] ?? []);
    const pinned = prefs().pinned.includes(this.area);
    const reachable = room.lights.filter((l) => !isUnavailable(hass.states[l.id])).map((l) => l.id);
    const lowBattery = batteries(hass).find((b) => b.level < LOW_BATTERY && areaOf(hass, b.id) === this.area);
    const devices = this.deviceNames();

    const actions: { id: Action; name: string; hint: string }[] = [
      { id: 'off', name: 'All off', hint: room.onCount ? `${room.onCount} on now` : 'All off now' },
      { id: 'dim', name: 'Dim to 30%', hint: 'Evening' },
      { id: 'warm', name: 'Warm white', hint: 'All lights' },
    ];

    return html`
      ${room.lights.length
        ? html`<div class="actions">
            ${actions.map(
              (a) => html`<button
                type="button"
                class=${a.id === 'off' ? 'dark' : ''}
                ?disabled=${!reachable.length}
                @click=${() => this.run(a.id, reachable)}
              >
                <span class="hint">${this.done === a.id ? 'Done' : a.hint}</span>
                <span class="name">${a.name}</span>
              </button>`,
            )}
          </div>`
        : nothing}
      ${room.lights.length
        ? html`<section class="group" aria-labelledby="show">
            <span class="top">
              <h2 id="show">Show on this screen</h2>
              <span class="count">${room.lights.length - room.lights.filter((l) => hidden.has(l.id)).length} of ${room.lights.length}</span>
            </span>
            ${room.lights.map((l) => {
              const e = hass.states[l.id];
              const offline = isUnavailable(e);
              const pct = brightnessPct(e);
              const note = offline ? 'Offline' : l.on ? (pct === undefined ? 'On' : `On · ${pct}%`) : 'Off';
              const shown = !hidden.has(l.id);
              return html`<div class="row ${offline ? 'faded' : ''}">
                <span class="text"><span class="n">${l.name}</span><span class="sub">${note}</span></span>
                ${this.switch(shown, `Show ${l.name}`, () => this.toggleHidden(l.id, shown))}
              </div>`;
            })}
          </section>`
        : nothing}
      <section class="group settings" aria-label="Room settings">
        <div class="row first">
          <span class="text"><span class="n">Pin to Home</span><span class="sub">Show this room first on Home</span></span>
          ${this.switch(pinned, 'Pin to Home', () =>
            updatePrefs(hass, (p) => ({
              ...p,
              pinned: pinned ? p.pinned.filter((id) => id !== this.area) : [...p.pinned, this.area],
            })),
          )}
        </div>
        ${devices.length || lowBattery
          ? html`<div class="row">
              <span class="text">
                <span class="n">Room devices</span>
                ${lowBattery
                  ? html`<span class="sub warn">${lowBattery.device || lowBattery.room} battery ${lowBattery.level}%</span>`
                  : nothing}
              </span>
              <span class="devices">${devices.join(' · ')}</span>
            </div>`
          : nothing}
      </section>
    `;
  }

  private switch(on: boolean, label: string, toggle: () => void) {
    return html`<button type="button" role="switch" class="switch ${on ? 'on' : ''}" aria-checked=${on ? 'true' : 'false'} aria-label=${label} @click=${toggle}>
      <span class="knob"></span>
    </button>`;
  }

  private toggleHidden(id: string, shown: boolean) {
    updatePrefs(this.hass!, (p) => {
      const list = new Set(p.hidden[this.area] ?? []);
      if (shown) list.add(id);
      else list.delete(id);
      return { ...p, hidden: { ...p.hidden, [this.area]: [...list] } };
    });
  }

  private run(action: Action, ids: string[]) {
    const hass = this.hass!;
    haptic('light');
    if (action === 'off') hass.callService('light', 'turn_off', { entity_id: ids });
    if (action === 'dim') hass.callService('light', 'turn_on', { entity_id: ids, brightness_pct: 30 });
    if (action === 'warm') hass.callService('light', 'turn_on', { entity_id: ids, color_temp_kelvin: 2700 });
    this.done = action;
  }

  /** Names of the devices in this room, without the room's name. */
  private deviceNames(): string[] {
    const hass = this.hass!;
    const areaName = hass.areas?.[this.area]?.name ?? '';
    const ids = new Set(
      areaEntityIds(hass, this.area)
        .map((id) => hass.entities[id]?.device_id)
        .filter((d): d is string => !!d),
    );
    return [...ids]
      .map((id) => {
        const d = hass.devices?.[id];
        const name = d?.name_by_user || d?.name || '';
        return shortName({ entity_id: id, state: '', attributes: { friendly_name: name }, last_changed: '', last_updated: '' }, areaName);
      })
      .filter(Boolean)
      .slice(0, 4);
  }


  static styles: CSSResultGroup = [
    GlassSheet.styles,
    css`
      .actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .actions button {
        all: unset;
        box-sizing: border-box;
        height: 92px;
        padding: 12px;
        border-radius: var(--glass-radius-small-tile);
        background: var(--glass-solid);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        cursor: pointer;
      }
      .actions button.dark {
        background: var(--glass-ink);
        color: var(--glass-on-ink);
      }
      .actions button:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .hint {
        font-size: var(--glass-text-small);
        opacity: 0.75;
      }
      .name {
        font-size: var(--glass-text-body);
      }
      .group {
        border-radius: var(--glass-radius-tile);
        background: rgba(var(--glass-surface-rgb), 0.75);
        padding: 16px 16px 6px;
        display: flex;
        flex-direction: column;
      }
      .settings {
        padding: 6px 16px;
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 4px;
      }
      h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 400;
      }
      .count {
        font-size: var(--glass-text-small);
        color: var(--glass-text-muted);
      }
      .row {
        box-sizing: border-box;
        min-height: 54px;
        display: flex;
        align-items: center;
        gap: 12px;
        border-top: 1px solid rgba(var(--glass-line-rgb), 0.07);
      }
      .row.first {
        border-top: none;
        min-height: 56px;
      }
      .row.faded {
        opacity: 0.6;
      }
      .row.link {
        all: unset;
        box-sizing: border-box;
        min-height: 56px;
        display: flex;
        align-items: center;
        gap: 12px;
        border-top: 1px solid rgba(var(--glass-line-rgb), 0.07);
        cursor: pointer;
      }
      .row.link .n {
        flex: 1;
      }
      .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.2;
      }
      .n {
        font-size: var(--glass-text-body);
      }
      .sub {
        font-size: var(--glass-text-small);
        color: var(--glass-text-muted);
      }
      .sub.warn {
        color: var(--glass-attention-ink);
      }
      .devices {
        font-size: var(--glass-text-caption);
        color: var(--glass-text-secondary);
        text-align: right;
      }
      .switch {
        all: unset;
        position: relative;
        width: 52px;
        height: 32px;
        flex: none;
        border-radius: 16px;
        background: rgba(var(--glass-line-rgb), 0.15);
        cursor: pointer;
        transition: background 0.2s ease;
      }
      .switch.on {
        background: var(--glass-go);
      }
      .knob {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
        transition: left 0.2s ease;
      }
      .switch.on .knob {
        left: 23px;
      }
      button:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
    `,
  ];
}

/** A Lucide icon for a room from its name. */
function areaIcon(name: string): IconName {
  const n = name.toLowerCase();
  if (/living|lounge|sitting/.test(n)) return 'sofa';
  if (/guest/.test(n)) return 'bed-single';
  if (/bed/.test(n)) return 'bed-double';
  if (/office|study/.test(n)) return 'monitor';
  if (/kitchen/.test(n)) return 'cooking-pot';
  if (/bath|shower/.test(n)) return 'shower-head';
  if (/garden|outside|yard/.test(n)) return 'trees';
  if (/utility|laundry/.test(n)) return 'washing-machine';
  if (/server|network/.test(n)) return 'server';
  if (/landing|stairs/.test(n)) return 'layers';
  if (/hall|entrance|front|back|porch/.test(n)) return 'door-closed';
  if (/conservatory/.test(n)) return 'sprout';
  return 'house';
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-room-options-sheet': GlassRoomOptionsSheet;
  }
}

import { css, html, nothing, type CSSResultGroup } from 'lit';
import '../elements/glass-rows.js';
import '../elements/glass-button.js';
import { heading } from '../elements/type.js';
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
  protected sheetIconBg = 'var(--glass-amber)';

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
              (a) => html`<glass-button
                kind="tile"
                ?dark=${a.id === 'off'}
                ?disabled=${!reachable.length}
                hint=${this.done === a.id ? 'Done' : a.hint}
                @click=${() => this.run(a.id, reachable)}
                >${a.name}</glass-button
              >`,
            )}
          </div>`
        : nothing}
      ${room.lights.length
        ? html`<glass-row-group heading="Show on this screen" count="${room.lights.length - room.lights.filter((l) => hidden.has(l.id)).length} of ${room.lights.length}">
            ${room.lights.map((l) => {
              const e = hass.states[l.id];
              const offline = isUnavailable(e);
              const pct = brightnessPct(e);
              const note = offline ? 'Offline' : l.on ? (pct === undefined ? 'On' : `On · ${pct}%`) : 'Off';
              const shown = !hidden.has(l.id);
              return html`<glass-grouped-row name=${l.name} line=${note} ?faded=${offline}>
                ${this.switch(shown, `Show ${l.name}`, () => this.toggleHidden(l.id, shown))}
              </glass-grouped-row>`;
            })}
          </glass-row-group>`
        : nothing}
      <glass-row-group aria-label="Room settings">
        <glass-grouped-row name="Pin to Home" line="Show this room first on Home">
          ${this.switch(pinned, 'Pin to Home', () =>
            updatePrefs(hass, (p) => ({
              ...p,
              pinned: pinned ? p.pinned.filter((id) => id !== this.area) : [...p.pinned, this.area],
            })),
          )}
        </glass-grouped-row>
        ${devices.length || lowBattery
          ? html`<glass-grouped-row
              name="Room devices"
              line=${lowBattery ? `${lowBattery.device || lowBattery.room} battery ${lowBattery.level}%` : ''}
              ?warn=${!!lowBattery}
              value=${devices.join(' · ')}
            ></glass-grouped-row>`
          : nothing}
      </glass-row-group>
    `;
  }

  private switch(on: boolean, label: string, toggle: () => void) {
    return html`<glass-switch ?checked=${on} label=${label} @change=${toggle}></glass-switch>`;
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
        gap: 12px;
      }
      h2 {
        ${heading}
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

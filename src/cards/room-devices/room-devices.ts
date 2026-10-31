import { css, html, nothing, type PropertyValues } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, isUnavailable, openMoreInfo, registerCard } from '../../ha.js';
import { areaEntityIds } from '../../rooms.js';
import { batteries } from '../../batteries.js';
import { formatValue } from '../../format.js';
import './room-devices-editor.js';

export interface RoomDevicesConfig extends LovelaceCardConfig {
  area: string;
}

/**
 * A room's small devices as a row of chips at the bottom of its screen: each
 * battery ("Hue remote · 90%") and what each plug is drawing ("Sarah's side
 * plug · 0.1 W"). Tap a chip for its pop-up.
 */
@customElement('glass-room-devices')
export class GlassRoomDevices extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: RoomDevicesConfig;
  private watched: string[] = [];

  static getConfigElement() {
    return document.createElement('glass-room-devices-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<RoomDevicesConfig> {
    return { area: Object.keys(hass.areas ?? {})[0] ?? '' };
  }

  setConfig(config: RoomDevicesConfig): void {
    if (!config.area) throw new Error('Choose a room');
    this.config = config;
  }

  getCardSize(): number {
    return 1;
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
    return !old || old.entities !== this.hass!.entities || this.watched.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  /** "Hue remote", "Sarah's side plug": the device's name without the room's. */
  private deviceName(id: string, areaName: string): string {
    const deviceId = this.hass!.entities?.[id]?.device_id;
    const d = deviceId ? this.hass!.devices?.[deviceId] : undefined;
    const name = String(d?.name_by_user ?? d?.name ?? this.hass!.states[id].attributes.friendly_name ?? id);
    const short = name.replace(new RegExp(`^${areaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i'), '').trim() || name;
    return short.charAt(0).toUpperCase() + short.slice(1);
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const hass = this.hass;
    const areaName = hass.areas?.[this.config.area]?.name ?? '';
    const ids = new Set(areaEntityIds(hass, this.config.area));
    const battery = batteries(hass).filter((b) => ids.has(b.id) && !b.phone);
    const power = [...ids].filter(
      (id) => id.startsWith('sensor.') && hass.states[id]?.attributes.device_class === 'power' && !isUnavailable(hass.states[id]) && !hass.entities?.[id]?.hidden,
    );
    this.watched = [...battery.map((b) => b.id), ...power];
    const chips = [
      ...battery.map((b) => ({ id: b.id, text: `${this.deviceName(b.id, areaName)} · ${b.level}%` })),
      ...power.map((id) => ({ id, text: `${this.deviceName(id, areaName)} · ${formatValue(hass.states[id]).value}` })),
    ];
    if (!chips.length) return nothing;
    return html`<section aria-label="Devices">
      ${chips.map((c) => html`<button type="button" @click=${() => openMoreInfo(this, c.id)}>${c.text}</button>`)}
    </section>`;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      section {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      button {
        all: unset;
        height: 36px;
        padding: 0 14px;
        border-radius: 18px;
        background: rgba(var(--glass-surface-rgb), 0.7);
        font-size: var(--glass-text-caption);
        display: flex;
        align-items: center;
        cursor: pointer;
      }
      button:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
    `,
  ];
}

registerCard({
  type: 'glass-room-devices',
  name: 'Glass · Room devices',
  description: 'A room’s batteries and what its plugs are drawing, as a row of chips.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-room-devices': GlassRoomDevices;
  }
}

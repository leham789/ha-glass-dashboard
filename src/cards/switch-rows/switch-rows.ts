import { css, html, nothing, type PropertyValues } from 'lit';
import '../../elements/glass-rows.js';
import '../../elements/glass-button.js';
import { heading } from '../../elements/type.js';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, isUnavailable, registerCard } from '../../ha.js';
import { formatValue } from '../../format.js';
import { nameInRoom } from '../../rooms.js';
import { haptic } from '../../motion.js';
import './switch-rows-editor.js';

export interface SwitchRowsConfig extends LovelaceCardConfig {
  /** Plugs and switches, in order. A plain switch can say what it does: { entity, secondary: Mains switch for the ceiling bulb }. */
  entities: (string | { entity: string; secondary?: string })[];
  title?: string;
}

const idOf = (e: SwitchRowsConfig['entities'][number]) => (typeof e === 'string' ? e : e.entity);

/**
 * Smart plugs as 64-high glass rows with a switch: the name, and underneath
 * what it's drawing and has used ("2.2 W now · 3.69 kWh total"), found from
 * the plug's own power and energy sensors, or a line of your own.
 */
@customElement('glass-switch-rows')
export class GlassSwitchRows extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: SwitchRowsConfig;
  private watched: string[] = [];

  static getConfigElement() {
    return document.createElement('glass-switch-rows-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<SwitchRowsConfig> {
    return { entities: Object.keys(hass.states).filter((id) => id.startsWith('switch.')).slice(0, 3) };
  }

  setConfig(config: SwitchRowsConfig): void {

    this.needs = undefined;
    if (!Array.isArray(config.entities) || !config.entities.length) return this.setUp(config, 'Choose at least one switch');
    this.config = config;
  }

  getCardSize(): number {
    return 1 + this.config!.entities.length;
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

  /** The plug's own power (W) and energy (kWh) sensors, from the same device. */
  private readings(id: string): string[] {
    const hass = this.hass!;
    const device = hass.entities?.[id]?.device_id;
    if (!device) return [];
    const siblings = Object.values(hass.entities).filter((e) => e.device_id === device && e.entity_id !== id);
    const find = (cls: string) =>
      siblings.map((e) => hass.states[e.entity_id]).find((e) => e && e.attributes.device_class === cls && !isUnavailable(e));
    return [find('power'), find('energy')].filter((e) => !!e).map((e) => e!.entity_id);
  }

  render() {
    if (this.needs) return this.renderSetup('plug');
    if (!this.config || !this.hass) return nothing;
    const hass = this.hass;
    this.watched = this.config.entities.map(idOf).flatMap((id) => [id, ...this.readings(id)]);
    return html`<section aria-labelledby="h">
      <h2 id="h">${this.config.title ?? 'Power'}</h2>
      <div class="rows">
      ${this.config.entities.map((entry) => {
        const id = idOf(entry);
        const e = hass.states[id];
        if (!e) return nothing;
        const on = e.state === 'on';
        const offline = isUnavailable(e);
        const detail = this.readings(id)
          .map((r, i) => {
            const { value } = formatValue(hass.states[r]);
            return `${value} ${i === 0 ? 'now' : 'total'}`;
          })
          .join(' · ') || (typeof entry === 'object' ? (entry.secondary ?? '') : '');
        const name = nameInRoom(hass, e);
        return html`<glass-pill-row look="glass" name=${name} line=${offline ? 'Offline' : detail} ?faded=${offline}>
          <glass-switch ?checked=${on} label=${name}
            ?disabled=${offline} @change=${() => (haptic('light'), hass.callService('homeassistant', on ? 'turn_off' : 'turn_on', { entity_id: id }))}></glass-switch>
        </glass-pill-row>`;
      })}
      </div>
    </section>`;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      .rows {
        display: flex;
        flex-direction: column;
        gap: var(--glass-space-chip);
      }
      section {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      h2 {
        ${heading}
      }
    `,
  ];
}

registerCard({
  type: 'glass-switch-rows',
  name: 'Glass · Power switches',
  description: 'Smart plugs as switch rows with what they’re drawing and have used.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-switch-rows': GlassSwitchRows;
  }
}

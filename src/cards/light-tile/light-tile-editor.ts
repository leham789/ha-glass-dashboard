import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { type HomeAssistant, fireEvent } from '../../ha.js';
import { ICONS } from '../../icons.js';
import type { LightTileConfig } from './light-tile.js';

// Built from HA's own form controls (ha-form + selectors), so the editor
// looks and behaves like the built-in cards' editors.
const SCHEMA = [
  { name: 'entity', required: true, selector: { entity: { domain: 'light' } } },
  { name: 'name', selector: { text: {} } },
  {
    name: 'icon',
    selector: {
      select: {
        mode: 'dropdown',
        options: Object.keys(ICONS).map((value) => ({ value, label: value })),
      },
    },
  },
];

const LABELS: Record<string, string> = {
  entity: 'Light',
  name: 'Name (optional)',
  icon: 'Icon (default: lightbulb)',
};

@customElement('glass-light-tile-editor')
export class GlassLightTileEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: LightTileConfig;

  setConfig(config: LightTileConfig): void {
    this.config = config;
  }

  render() {
    if (!this.hass || !this.config) return nothing;
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this.config}
        .schema=${SCHEMA}
        .computeLabel=${(s: { name: string }) => LABELS[s.name] ?? s.name}
        @value-changed=${this.valueChanged}
      ></ha-form>
    `;
  }

  private valueChanged(e: CustomEvent<{ value: LightTileConfig }>) {
    const config = { ...e.detail.value };
    // Drop empty optional fields so the saved YAML stays tidy.
    for (const key of ['name', 'icon'] as const) if (!config[key]) delete config[key];
    fireEvent(this, 'config-changed', { config });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-light-tile-editor': GlassLightTileEditor;
  }
}

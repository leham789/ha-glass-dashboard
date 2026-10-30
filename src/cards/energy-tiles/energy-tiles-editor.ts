import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { EnergyTilesConfig } from './energy-tiles.js';

@customElement('glass-energy-tiles-editor')
export class GlassEnergyTilesEditor extends GlassFormEditor<EnergyTilesConfig> {
  protected fields() {
    return [
      { name: 'climate', label: 'Thermostat', selector: { entity: { domain: 'climate' } } },
      { name: 'power', label: 'Power now (W or kW)', selector: { entity: { domain: 'sensor', device_class: 'power' } } },
      { name: 'cost_entities', label: "Today's cost sensors, added together (optional)", selector: { entity: { domain: 'sensor', multiple: true } } },
      { name: 'cost_label', label: 'Words after the cost, e.g. "elec + gas" (optional)', selector: { text: {} } },
      { name: 'navigation_path', label: 'Open this view on tap, e.g. Heating & Energy (optional)', selector: { navigation: {} } },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-energy-tiles-editor': GlassEnergyTilesEditor;
  }
}

import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { ElectricityConfig } from './electricity.js';

@customElement('glass-electricity-editor')
export class GlassElectricityEditor extends GlassFormEditor<ElectricityConfig> {
  protected fields() {
    return [
      { name: 'energy', label: 'Energy sensor (kWh today, or the meter total)', required: true, selector: { entity: { domain: 'sensor', device_class: 'energy' } } },
      { name: 'cost', label: "Today's cost (optional)", selector: { entity: { domain: 'sensor' } } },
      {
        name: 'fuel',
        label: 'Electricity or gas',
        selector: { select: { mode: 'dropdown', options: [{ value: 'electricity', label: 'Electricity (green)' }, { value: 'gas', label: 'Gas (heating colours)' }] } },
      },
      { name: 'title', label: 'Title (default: Electricity today, or Gas today)', selector: { text: {} } },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-electricity-editor': GlassElectricityEditor;
  }
}

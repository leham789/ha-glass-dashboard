import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { ThermostatDialConfig } from './thermostat-dial.js';

@customElement('glass-thermostat-dial-editor')
export class GlassThermostatDialEditor extends GlassFormEditor<ThermostatDialConfig> {
  protected fields() {
    return [
      { name: 'entity', label: 'Thermostat', required: true, selector: { entity: { domain: 'climate' } } },
      { name: 'name', label: 'Name (optional)', selector: { text: {} } },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-thermostat-dial-editor': GlassThermostatDialEditor;
  }
}

import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { ThermostatDialConfig } from './thermostat-dial.js';

@customElement('glass-thermostat-dial-editor')
export class GlassThermostatDialEditor extends GlassFormEditor<ThermostatDialConfig> {
  protected popupGroup = false;

  protected fields() {
    return [
      { name: 'entity', label: 'Thermostat', required: true, selector: { entity: { domain: 'climate' } } },
      { name: 'name', label: 'Name (optional)', selector: { text: {} } },
      { name: 'show_presets', label: 'Show the thermostat’s presets (Comfort, Eco…) under the dial', selector: { boolean: {} } },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-thermostat-dial-editor': GlassThermostatDialEditor;
  }
}

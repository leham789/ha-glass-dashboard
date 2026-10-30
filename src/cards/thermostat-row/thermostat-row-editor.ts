import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { ThermostatRowConfig } from './thermostat-row.js';

@customElement('glass-thermostat-row-editor')
export class GlassThermostatRowEditor extends GlassFormEditor<ThermostatRowConfig> {
  protected fields() {
    return [{ name: 'entity', label: 'Thermostat', required: true, selector: { entity: { domain: 'climate' } } }];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-thermostat-row-editor': GlassThermostatRowEditor;
  }
}

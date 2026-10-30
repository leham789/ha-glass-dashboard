import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { SwitchRowsConfig } from './switch-rows.js';

@customElement('glass-switch-rows-editor')
export class GlassSwitchRowsEditor extends GlassFormEditor<SwitchRowsConfig> {
  protected fields() {
    return [
      { name: 'entities', label: 'Plugs and switches, in order', required: true, selector: { entity: { domain: ['switch', 'input_boolean', 'fan'], multiple: true } } },
      { name: 'title', label: 'Title (default: Power)', selector: { text: {} } },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-switch-rows-editor': GlassSwitchRowsEditor;
  }
}

import { customElement } from 'lit/decorators.js';
import { GlassFormEditor, listField } from '../../editor.js';
import type { SwitchRowsConfig } from './switch-rows.js';

@customElement('glass-switch-rows-editor')
export class GlassSwitchRowsEditor extends GlassFormEditor<SwitchRowsConfig> {
  protected fields() {
    return [
      listField(
        'entities',
        'Switches, in order',
        {
          entity: { label: 'Switch', required: true, selector: { entity: { domain: ['switch', 'input_boolean', 'fan'] } } },
          secondary: { label: 'Line under the name, if it has no power sensors (optional)', selector: { text: {} } },
        },
        { labelField: 'entity', descriptionField: 'secondary', required: true, entityShorthand: true },
      ),
      { name: 'title', label: 'Title (default: Power)', selector: { text: {} } },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-switch-rows-editor': GlassSwitchRowsEditor;
  }
}

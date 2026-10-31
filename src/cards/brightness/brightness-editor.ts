import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { BrightnessConfig } from './brightness.js';

@customElement('glass-brightness-editor')
export class GlassBrightnessEditor extends GlassFormEditor<BrightnessConfig> {
  protected fields() {
    return [
      { name: 'entity', label: 'Light or light group', required: true, selector: { entity: { domain: 'light' } } },
      { name: 'name', label: 'Name (optional)', selector: { text: {} } },
      { name: 'lamps', label: "Show the group's lights as small tiles underneath", selector: { boolean: {} } },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-brightness-editor': GlassBrightnessEditor;
  }
}

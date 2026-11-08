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
      {
        name: 'lamps_style',
        label: 'Lamps as (default: automatic, tiles or rows when narrow)',
        selector: {
          select: {
            mode: 'dropdown',
            options: [
              { value: 'auto', label: 'Automatic' },
              { value: 'tiles', label: 'Tiles' },
              { value: 'rows', label: 'Rows' },
            ],
          },
        },
      },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-brightness-editor': GlassBrightnessEditor;
  }
}

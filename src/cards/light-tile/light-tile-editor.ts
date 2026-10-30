import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import { ICONS } from '../../icons.js';
import type { LightTileConfig } from './light-tile.js';

@customElement('glass-light-tile-editor')
export class GlassLightTileEditor extends GlassFormEditor<LightTileConfig> {
  protected fields() {
    return [
      { name: 'entity', label: 'Light', required: true, selector: { entity: { domain: 'light' } } },
      { name: 'name', label: 'Name (optional)', selector: { text: {} } },
      {
        name: 'icon',
        label: 'Icon (default: lightbulb)',
        selector: {
          select: { mode: 'dropdown', options: Object.keys(ICONS).map((value) => ({ value, label: value })) },
        },
      },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-light-tile-editor': GlassLightTileEditor;
  }
}

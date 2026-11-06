import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import { ICONS } from '../../icons.js';
import type { LightTileConfig } from './light-tile.js';

@customElement('glass-light-tile-editor')
export class GlassLightTileEditor extends GlassFormEditor<LightTileConfig> {
  protected fields() {
    return [
      { name: 'entity', label: 'Entity', required: true, selector: { entity: {} } },
      { name: 'name', label: 'Name (optional)', selector: { text: {} } },
      {
        name: 'icon',
        label: 'Icon (default: lightbulb)',
        selector: {
          select: { mode: 'dropdown', options: Object.keys(ICONS).map((value) => ({ value, label: value })) },
        },
      },
      {
        name: 'style',
        label: 'Style',
        selector: {
          select: {
            mode: 'dropdown',
            options: [
              { value: 'tile', label: 'Tile (default)' },
              { value: 'small', label: 'Small' },
              { value: 'row', label: 'Row' },
            ],
          },
        },
      },
      {
        name: 'icon_style',
        label: 'Icon',
        selector: {
          select: {
            mode: 'dropdown',
            options: [
              { value: 'ring', label: 'In a ring (default)' },
              { value: 'plain', label: 'On its own' },
            ],
          },
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

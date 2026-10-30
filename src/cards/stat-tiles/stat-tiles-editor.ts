import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { StatTilesConfig } from './stat-tiles.js';

// Each tile has a few settings, so the list is edited as a small block of
// YAML inside HA's own object editor.
@customElement('glass-stat-tiles-editor')
export class GlassStatTilesEditor extends GlassFormEditor<StatTilesConfig> {
  protected fields() {
    return [
      {
        name: 'tiles',
        label: 'Tiles: entity, and optionally name, secondary, icon, dark',
        required: true,
        selector: { object: {} },
      },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-stat-tiles-editor': GlassStatTilesEditor;
  }
}

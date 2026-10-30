import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { RoomTileConfig } from './room-tile.js';

@customElement('glass-room-tile-editor')
export class GlassRoomTileEditor extends GlassFormEditor<RoomTileConfig> {
  protected fields() {
    return [
      { name: 'area', label: 'Area', required: true, selector: { area: {} } },
      { name: 'name', label: 'Name (optional)', selector: { text: {} } },
      { name: 'navigation_path', label: 'Open this view on tap (optional)', selector: { navigation: {} } },
      {
        name: 'exclude_entities',
        label: "Lights or sensors to leave out (optional)",
        selector: { entity: { multiple: true } },
      },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-room-tile-editor': GlassRoomTileEditor;
  }
}

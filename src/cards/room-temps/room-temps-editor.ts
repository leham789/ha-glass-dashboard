import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { RoomTempsConfig } from './room-temps.js';

@customElement('glass-room-temps-editor')
export class GlassRoomTempsEditor extends GlassFormEditor<RoomTempsConfig> {
  protected fields() {
    return [
      { name: 'title', label: 'Title (default: By room)', selector: { text: {} } },
      { name: 'exclude_areas', label: 'Rooms to leave out (optional)', selector: { area: { multiple: true } } },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-room-temps-editor': GlassRoomTempsEditor;
  }
}

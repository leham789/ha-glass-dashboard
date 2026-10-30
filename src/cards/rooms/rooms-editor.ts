import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { RoomsConfig } from './rooms.js';

@customElement('glass-rooms-editor')
export class GlassRoomsEditor extends GlassFormEditor<RoomsConfig> {
  protected fields() {
    return [
      { name: 'title', label: 'Title (default: Rooms)', selector: { text: {} } },
      { name: 'exclude_areas', label: 'Areas to hide (optional)', selector: { area: { multiple: true } } },
      {
        name: 'room_path',
        label: 'Open a view on tap, {area} = area id (optional, e.g. /glass/{area})',
        selector: { text: {} },
      },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-rooms-editor': GlassRoomsEditor;
  }
}

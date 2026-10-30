import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { RoomLightsConfig } from './room-lights.js';

@customElement('glass-room-lights-editor')
export class GlassRoomLightsEditor extends GlassFormEditor<RoomLightsConfig> {
  protected fields() {
    return [
      { name: 'area', label: 'Room', required: true, selector: { area: {} } },
      { name: 'exclude_entities', label: 'Lights to leave out (optional)', selector: { entity: { domain: 'light', multiple: true } } },
      { name: 'title', label: 'Title (default: Lights)', selector: { text: {} } },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-room-lights-editor': GlassRoomLightsEditor;
  }
}

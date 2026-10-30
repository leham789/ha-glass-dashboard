import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { RoomClimateConfig } from './room-climate.js';

@customElement('glass-room-climate-editor')
export class GlassRoomClimateEditor extends GlassFormEditor<RoomClimateConfig> {
  protected fields() {
    return [{ name: 'area', label: 'Room', required: true, selector: { area: {} } }];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-room-climate-editor': GlassRoomClimateEditor;
  }
}

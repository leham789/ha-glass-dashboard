import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { RoomDevicesConfig } from './room-devices.js';

@customElement('glass-room-devices-editor')
export class GlassRoomDevicesEditor extends GlassFormEditor<RoomDevicesConfig> {
  protected fields() {
    return [{ name: 'area', label: 'Room', required: true, selector: { area: {} } }];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-room-devices-editor': GlassRoomDevicesEditor;
  }
}

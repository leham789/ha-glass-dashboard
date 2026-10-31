import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { RoomHeaderConfig } from './room-header.js';

@customElement('glass-room-header-editor')
export class GlassRoomHeaderEditor extends GlassFormEditor<RoomHeaderConfig> {
  protected fields() {
    return [
      { name: 'area', label: 'This screen’s room', required: true, selector: { area: {} } },
      { name: 'room_path', label: 'Room views, {area} = area id (e.g. /glass/{area})', required: true, selector: { text: {} } },
      { name: 'pinned', label: 'Rooms first in the switcher (optional)', selector: { area: { multiple: true } } },
      { name: 'exclude_areas', label: 'Rooms to leave out (optional)', selector: { area: { multiple: true } } },
      {
        name: 'quiet_hours',
        label: 'Not reporting after (hours, optional): raise for a sensor that reports less often, e.g. door: 24 or binary_sensor.back_door: 48',
        selector: { object: {} },
      },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-room-header-editor': GlassRoomHeaderEditor;
  }
}

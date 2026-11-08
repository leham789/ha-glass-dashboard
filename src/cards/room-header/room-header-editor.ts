import { customElement } from 'lit/decorators.js';
import { GlassFormEditor, quietHoursField } from '../../editor.js';
import type { RoomHeaderConfig } from './room-header.js';

@customElement('glass-room-header-editor')
export class GlassRoomHeaderEditor extends GlassFormEditor<RoomHeaderConfig> {
  protected fields() {
    return [
      { name: 'area', label: 'This screen’s room', required: true, selector: { area: {} } },
      { name: 'room_path', label: 'Room views, {area} = area id (e.g. /glass/{area})', required: true, selector: { text: {} } },
      {
        name: 'show',
        label: 'Big number',
        selector: {
          select: {
            mode: 'dropdown',
            options: [
              { value: 'lights', label: 'Lights on (default)' },
              { value: 'temperature', label: 'Temperature' },
              { value: 'power', label: 'Power use' },
              { value: 'sensor', label: 'One sensor' },
              { value: 'none', label: 'Nothing' },
            ],
          },
        },
      },
      { name: 'sensor', label: 'The sensor, for One sensor', selector: { entity: { domain: 'sensor' } } },
      { name: 'pinned', label: 'Rooms first in the switcher (optional)', selector: { area: { multiple: true } } },
      { name: 'exclude_areas', label: 'Rooms to leave out (optional)', selector: { area: { multiple: true } } },
      quietHoursField(),
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-room-header-editor': GlassRoomHeaderEditor;
  }
}

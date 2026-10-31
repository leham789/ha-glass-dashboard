import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { RoomTempsConfig } from './room-temps.js';

@customElement('glass-room-temps-editor')
export class GlassRoomTempsEditor extends GlassFormEditor<RoomTempsConfig> {
  protected fields() {
    return [
      { name: 'title', label: 'Title (default: By room)', selector: { text: {} } },
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
    'glass-room-temps-editor': GlassRoomTempsEditor;
  }
}

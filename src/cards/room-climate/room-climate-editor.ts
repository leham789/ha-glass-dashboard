import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { RoomClimateConfig } from './room-climate.js';

@customElement('glass-room-climate-editor')
export class GlassRoomClimateEditor extends GlassFormEditor<RoomClimateConfig> {
  protected fields() {
    return [
      { name: 'area', label: 'Room', required: true, selector: { area: {} } },
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
    'glass-room-climate-editor': GlassRoomClimateEditor;
  }
}

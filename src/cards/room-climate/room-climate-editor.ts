import { customElement } from 'lit/decorators.js';
import { GlassFormEditor, quietHoursField } from '../../editor.js';
import type { RoomClimateConfig } from './room-climate.js';

@customElement('glass-room-climate-editor')
export class GlassRoomClimateEditor extends GlassFormEditor<RoomClimateConfig> {
  protected fields() {
    return [
      { name: 'area', label: 'Room', required: true, selector: { area: {} } },
      { name: 'temperature_band', label: 'Show the temperature band (Cold, Comfy, Warm…)', selector: { boolean: {} }, default: true },
      { name: 'humidity_band', label: 'Show the humidity band (Dry, Comfy, Damp)', selector: { boolean: {} }, default: true },
      quietHoursField(),
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-room-climate-editor': GlassRoomClimateEditor;
  }
}

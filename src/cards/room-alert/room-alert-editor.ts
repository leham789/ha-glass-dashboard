import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { RoomAlertConfig } from './room-alert.js';

@customElement('glass-room-alert-editor')
export class GlassRoomAlertEditor extends GlassFormEditor<RoomAlertConfig> {
  protected fields() {
    return [
      { name: 'light', label: 'Smart bulb', required: true, selector: { entity: { domain: 'light' } } },
      { name: 'switch', label: 'The switch or plug that powers it', required: true, selector: { entity: { domain: ['switch', 'input_boolean'] } } },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-room-alert-editor': GlassRoomAlertEditor;
  }
}

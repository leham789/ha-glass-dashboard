import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { DoorsConfig } from './doors.js';

@customElement('glass-doors-editor')
export class GlassDoorsEditor extends GlassFormEditor<DoorsConfig> {
  protected fields() {
    return [
      { name: 'entities', label: 'Door and window sensors (default: all)', selector: { entity: { domain: 'binary_sensor', multiple: true } } },
      { name: 'title', label: 'Screen title above, with an overall pill (e.g. Security)', selector: { text: {} } },
      { name: 'heading', label: 'Section heading (default: Doors)', selector: { text: {} } },
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
    'glass-doors-editor': GlassDoorsEditor;
  }
}

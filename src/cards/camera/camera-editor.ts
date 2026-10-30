import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { CameraConfig } from './camera.js';

@customElement('glass-camera-editor')
export class GlassCameraEditor extends GlassFormEditor<CameraConfig> {
  protected fields() {
    return [
      { name: 'entity', label: 'Camera', required: true, selector: { entity: { domain: 'camera' } } },
      { name: 'name', label: 'Name (optional)', selector: { text: {} } },
      { name: 'motion_entity', label: 'Motion sensor (optional)', selector: { entity: { domain: 'binary_sensor' } } },
      { name: 'ding_entity', label: 'Doorbell press sensor (optional)', selector: { entity: { domain: ['binary_sensor', 'event'] } } },
      { name: 'heading', label: 'Heading above, e.g. Cameras (optional)', selector: { text: {} } },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-camera-editor': GlassCameraEditor;
  }
}

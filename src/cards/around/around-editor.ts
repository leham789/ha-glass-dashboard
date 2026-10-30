import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { AroundConfig } from './around.js';

@customElement('glass-around-editor')
export class GlassAroundEditor extends GlassFormEditor<AroundConfig> {
  protected fields() {
    return [
      { name: 'bins', label: 'Bin sensors (e.g. Waste Collection Schedule)', selector: { entity: { domain: 'sensor', multiple: true } } },
      { name: 'printer_status', label: "3D printer's status sensor", selector: { entity: { domain: 'sensor' } } },
      { name: 'printer_progress', label: 'Print progress sensor (%)', selector: { entity: { domain: 'sensor' } } },
      { name: 'printer_remaining', label: 'Time remaining sensor', selector: { entity: { domain: 'sensor' } } },
      { name: 'printer_task', label: 'Print name sensor', selector: { entity: { domain: 'sensor' } } },
      { name: 'printer_name', label: 'Printer name (e.g. P1S)', selector: { text: {} } },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-around-editor': GlassAroundEditor;
  }
}

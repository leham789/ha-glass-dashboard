import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { StatusChipsConfig } from './status-chips.js';

@customElement('glass-status-chips-editor')
export class GlassStatusChipsEditor extends GlassFormEditor<StatusChipsConfig> {
  protected fields() {
    return [
      { name: 'security_path', label: 'Open this view from an open-door chip (optional)', selector: { navigation: {} } },
      { name: 'energy_path', label: 'Heating & Energy view, linked from the temperatures pop-up (optional)', selector: { navigation: {} } },
      { name: 'exclude_areas', label: 'Areas to leave out (optional)', selector: { area: { multiple: true } } },
      { name: 'printer_status', label: '3D printer status sensor, for a chip while it prints (optional)', selector: { entity: { domain: 'sensor' } } },
      { name: 'printer_progress', label: 'Printer progress sensor (optional)', selector: { entity: { domain: 'sensor' } } },
      { name: 'printer_remaining', label: 'Printer time-left sensor (optional)', selector: { entity: { domain: 'sensor' } } },
      { name: 'printer_name', label: 'Printer name on the chip (default: 3D printer)', selector: { text: {} } },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-status-chips-editor': GlassStatusChipsEditor;
  }
}

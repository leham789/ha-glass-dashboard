import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { PrinterCardConfig } from './printer-card.js';

@customElement('glass-printer-editor')
export class GlassPrinterEditor extends GlassFormEditor<PrinterCardConfig> {
  protected fields() {
    const sensor = { entity: { domain: 'sensor' } };
    return [
      { name: 'printer_status', label: 'Print status sensor', required: true, selector: sensor },
      { name: 'printer_progress', label: 'Print progress (%)', selector: sensor },
      { name: 'printer_remaining', label: 'Time remaining', selector: sensor },
      { name: 'printer_task', label: 'Print name', selector: sensor },
      { name: 'name', label: 'Printer name (e.g. P1S)', selector: { text: {} } },
      { name: 'camera', label: 'Chamber camera (optional)', selector: { entity: { domain: 'camera' } } },
      { name: 'chamber_light', label: 'Chamber light (optional)', selector: { entity: { domain: 'light' } } },
      { name: 'nozzle_temp', label: 'Nozzle temperature (optional)', selector: sensor },
      { name: 'bed_temp', label: 'Bed temperature (optional)', selector: sensor },
      { name: 'ams_humidity', label: 'AMS humidity (optional)', selector: sensor },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-printer-editor': GlassPrinterEditor;
  }
}

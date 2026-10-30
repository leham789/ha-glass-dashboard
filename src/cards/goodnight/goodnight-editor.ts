import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { GoodnightConfig } from './goodnight.js';

@customElement('glass-goodnight-editor')
export class GlassGoodnightEditor extends GlassFormEditor<GoodnightConfig> {
  protected fields() {
    return [
      { name: 'areas', label: 'Rooms whose lights it turns off (default: your lowest floor)', selector: { area: { multiple: true } } },
      { name: 'script', label: 'Run this script instead (optional, e.g. script.goodnight)', selector: { entity: { domain: 'script' } } },
      { name: 'show_after', label: 'Show from (default 22:00)', selector: { time: {} } },
      { name: 'show_until', label: 'Show until (default 05:00)', selector: { time: {} } },
      { name: 'always_show', label: 'Always show, whatever the time', selector: { boolean: {} } },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-goodnight-editor': GlassGoodnightEditor;
  }
}

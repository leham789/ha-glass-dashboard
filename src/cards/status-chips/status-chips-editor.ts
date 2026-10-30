import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { StatusChipsConfig } from './status-chips.js';

@customElement('glass-status-chips-editor')
export class GlassStatusChipsEditor extends GlassFormEditor<StatusChipsConfig> {
  protected fields() {
    return [
      { name: 'security_path', label: 'Open this view from an open-door chip (optional)', selector: { navigation: {} } },
      { name: 'exclude_areas', label: 'Areas to leave out (optional)', selector: { area: { multiple: true } } },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-status-chips-editor': GlassStatusChipsEditor;
  }
}

import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { HomeHeaderConfig } from './home-header.js';

@customElement('glass-home-header-editor')
export class GlassHomeHeaderEditor extends GlassFormEditor<HomeHeaderConfig> {
  protected fields() {
    return [
      { name: 'area', label: 'Room for the big temperature (default: first with a sensor)', selector: { area: {} } },
      { name: 'person', label: 'Person to greet (default: you)', selector: { entity: { domain: 'person' } } },
      { name: 'weather', label: 'Weather (default: first weather entity)', selector: { entity: { domain: 'weather' } } },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-home-header-editor': GlassHomeHeaderEditor;
  }
}

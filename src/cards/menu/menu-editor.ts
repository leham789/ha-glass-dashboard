import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { MenuConfig } from './menu.js';

@customElement('glass-menu-editor')
export class GlassMenuEditor extends GlassFormEditor<MenuConfig> {
  protected fields() {
    return [
      { name: 'home_path', label: 'Home view', selector: { navigation: {} } },
      { name: 'rooms_path', label: 'Rooms view (any other view in the dashboard counts as a room)', selector: { navigation: {} } },
      { name: 'energy_path', label: 'Energy view', selector: { navigation: {} } },
      { name: 'security_path', label: 'Security view', selector: { navigation: {} } },
      { name: 'floating', label: 'Float over the bottom of the screen (default on)', selector: { boolean: {} } },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-menu-editor': GlassMenuEditor;
  }
}

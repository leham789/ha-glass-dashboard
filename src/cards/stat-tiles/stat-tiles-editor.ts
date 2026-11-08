import { customElement } from 'lit/decorators.js';
import { GlassFormEditor, listField } from '../../editor.js';
import { ICONS } from '../../icons.js';
import type { StatTilesConfig } from './stat-tiles.js';

// The tiles as a list: each row a sensor; open one for its name, second sensor, icon and dark look.
@customElement('glass-stat-tiles-editor')
export class GlassStatTilesEditor extends GlassFormEditor<StatTilesConfig> {
  protected fields() {
    return [
      listField(
        'tiles',
        'Tiles',
        {
          entity: { label: 'Sensor', required: true, selector: { entity: {} } },
          name: { label: 'Name (default: the sensor’s name)', selector: { text: {} } },
          secondary: { label: 'Second sensor, shown after the name (optional)', selector: { entity: {} } },
          icon: { label: 'Icon (optional)', selector: { select: { mode: 'dropdown', options: Object.keys(ICONS) } } },
          dark: { label: 'Dark tile, to stand out', selector: { boolean: {} } },
        },
        { labelField: 'entity', descriptionField: 'name', required: true },
      ),
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-stat-tiles-editor': GlassStatTilesEditor;
  }
}

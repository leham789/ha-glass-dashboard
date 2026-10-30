import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { FavouritesConfig } from './favourites.js';

@customElement('glass-favourites-editor')
export class GlassFavouritesEditor extends GlassFormEditor<FavouritesConfig> {
  protected fields() {
    return [
      {
        name: 'entities',
        label: 'Favourites, in order (lights, switches, scenes, scripts…)',
        required: true,
        selector: { entity: { multiple: true } },
      },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-favourites-editor': GlassFavouritesEditor;
  }
}

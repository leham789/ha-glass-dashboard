import { customElement } from 'lit/decorators.js';
import { GlassFormEditor, listField } from '../../editor.js';
import type { ScenesConfig } from './scenes.js';

@customElement('glass-scenes-editor')
export class GlassScenesEditor extends GlassFormEditor<ScenesConfig> {
  protected fields() {
    return [
      listField(
        'entities',
        'Scenes, in order',
        {
          entity: { label: 'Scene or script', required: true, selector: { entity: { domain: ['scene', 'script'] } } },
          hint: { label: 'Hint line, e.g. Cool white (optional)', selector: { text: {} } },
        },
        { labelField: 'entity', descriptionField: 'hint', required: true, entityShorthand: true },
      ),
      { name: 'title', label: 'Title (default: Scenes)', selector: { text: {} } },
      {
        name: 'style',
        label: 'Style',
        selector: { select: { mode: 'list', options: [{ value: 'card', label: 'In a card, with which one is on' }, { value: 'plain', label: 'On their own, with a hint line' }] } },
      },
      {
        name: 'look',
        label: 'Look',
        selector: { select: { mode: 'list', options: [{ value: 'colour', label: 'Coloured by the scene’s name (default)' }, { value: 'glass', label: 'Glass, like a Favourites tile' }] } },
      },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-scenes-editor': GlassScenesEditor;
  }
}

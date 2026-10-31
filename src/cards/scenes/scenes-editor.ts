import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { ScenesConfig } from './scenes.js';

@customElement('glass-scenes-editor')
export class GlassScenesEditor extends GlassFormEditor<ScenesConfig> {
  protected fields() {
    return [
      { name: 'entities', label: 'Scenes, in order', required: true, selector: { entity: { domain: ['scene', 'script'], multiple: true } } },
      { name: 'title', label: 'Title (default: Scenes)', selector: { text: {} } },
      {
        name: 'style',
        label: 'Style (hint lines are set in YAML: { entity, hint })',
        selector: { select: { mode: 'list', options: [{ value: 'card', label: 'In a card, with which one is on' }, { value: 'plain', label: 'On their own, with a hint line' }] } },
      },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-scenes-editor': GlassScenesEditor;
  }
}

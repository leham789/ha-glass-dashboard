import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { MediaConfig } from './media.js';

@customElement('glass-media-editor')
export class GlassMediaEditor extends GlassFormEditor<MediaConfig> {
  protected fields() {
    return [
      { name: 'entity', label: 'Main player', required: true, selector: { entity: { domain: 'media_player' } } },
      { name: 'buttons', label: 'Other devices as buttons (optional)', selector: { entity: { multiple: true } } },
      {
        name: 'style',
        label: 'Look',
        selector: { select: { mode: 'list', options: [{ value: 'dark', label: 'Dark (TV)' }, { value: 'light', label: 'Light (music)' }] } },
      },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-media-editor': GlassMediaEditor;
  }
}

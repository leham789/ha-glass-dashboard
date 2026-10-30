import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { NowPlayingConfig } from './now-playing.js';

@customElement('glass-now-playing-editor')
export class GlassNowPlayingEditor extends GlassFormEditor<NowPlayingConfig> {
  protected fields() {
    return [
      { name: 'entities', label: 'Players to watch (default: all)', selector: { entity: { domain: 'media_player', multiple: true } } },
      { name: 'room_path', label: "Open a view on tap, {area} = player's area id (optional)", selector: { text: {} } },
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-now-playing-editor': GlassNowPlayingEditor;
  }
}

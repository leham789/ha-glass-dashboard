import { customElement } from 'lit/decorators.js';
import { GlassFormEditor } from '../../editor.js';
import type { TitleConfig } from './title.js';

@customElement('glass-title-editor')
export class GlassTitleEditor extends GlassFormEditor<TitleConfig> {
  protected fields() {
    return [{ name: 'title', label: 'Title', required: true, selector: { text: {} } }];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-title-editor': GlassTitleEditor;
  }
}

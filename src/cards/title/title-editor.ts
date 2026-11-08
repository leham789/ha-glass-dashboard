import { customElement } from 'lit/decorators.js';
import { GlassFormEditor, listField } from '../../editor.js';
import type { TitleConfig } from './title.js';

@customElement('glass-title-editor')
export class GlassTitleEditor extends GlassFormEditor<TitleConfig> {
  protected popupGroup = false;

  protected fields() {
    return [
      { name: 'title', label: 'Title', required: true, selector: { text: {} } },
      listField(
        'tabs',
        'Tabs (optional): each jumps to a card on this screen',
        {
          name: { label: 'Name', required: true, selector: { text: {} } },
          card: {
            label: 'Jumps to',
            required: true,
            selector: { select: { mode: 'dropdown', custom_value: true, options: cardTypes() } },
          },
        },
        { labelField: 'name' },
      ),
    ];
  }
}

/** Our cards, as HA's card picker lists them: "Thermostat dial" → glass-thermostat-dial. */
function cardTypes(): { value: string; label: string }[] {
  const cards = (window as unknown as { customCards?: { type: string; name: string }[] }).customCards ?? [];
  return cards.filter((c) => c.type.startsWith('glass-')).map((c) => ({ value: c.type, label: c.name.replace(/^Glass · /, '') }));
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-title-editor': GlassTitleEditor;
  }
}

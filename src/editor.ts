import { LitElement, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { type HomeAssistant, type LovelaceCardConfig, fireEvent } from './ha.js';
import { ICONS } from './icons.js';
import { POPUP_COLOURS } from './elements/glass-sheet.js';

export interface FormField {
  name: string;
  label: string;
  required?: boolean;
  selector: Record<string, unknown>;
}

/**
 * Base for every card's visual editor. It's built from HA's own form controls
 * (ha-form + selectors), so editors look and behave like the built-in cards'.
 * A card's editor only lists its fields.
 */
export abstract class GlassFormEditor<C extends LovelaceCardConfig> extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() protected config?: C;

  protected abstract fields(): FormField[];
  /** Cards that open a pop-up get the "Pop-up (optional)" group last: its name, icon and icon colour. */
  protected popupGroup = true;

  setConfig(config: C): void {
    this.config = config;
  }

  render() {
    if (!this.hass || !this.config) return nothing;
    const fields = this.fields();
    const popup = this.popupGroup ? POPUP_FIELDS : [];
    const labels = Object.fromEntries([...fields, ...popup].map((f) => [f.name, f.label]));
    const schema: unknown[] = fields.map(({ label, ...f }) => f);
    if (popup.length) schema.push({ type: 'expandable', name: '', title: 'Pop-up (optional)', flatten: true, schema: popup.map(({ label, ...f }) => f) });
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this.config}
        .schema=${schema}
        .computeLabel=${(s: { name: string }) => labels[s.name] ?? s.name}
        @value-changed=${this.valueChanged}
      ></ha-form>
    `;
  }

  private valueChanged(e: CustomEvent<{ value: C }>) {
    const config: Record<string, unknown> = { ...e.detail.value };
    // Drop empty optional fields so the saved YAML stays tidy.
    for (const [key, value] of Object.entries(config)) {
      if (value === '' || value === undefined || (Array.isArray(value) && value.length === 0)) delete config[key];
    }
    fireEvent(this, 'config-changed', { config });
  }
}

const words = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');

/** The Pop-up group (Library: Sheet, Settings): empty fields leave the pop-up to pick its own. */
const POPUP_FIELDS: FormField[] = [
  { name: 'popup_name', label: 'Pop-up name (default: the thing’s name)', selector: { text: {} } },
  {
    name: 'popup_icon',
    label: 'Icon (default: by type)',
    selector: { select: { mode: 'dropdown', options: Object.keys(ICONS).map((value) => ({ value, label: value })) } },
  },
  {
    name: 'popup_icon_colour',
    label: 'Icon colour (default: by type)',
    selector: { select: { mode: 'dropdown', options: Object.keys(POPUP_COLOURS).map((value) => ({ value, label: words(value) })) } },
  },
];

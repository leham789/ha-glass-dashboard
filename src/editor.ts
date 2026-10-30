import { LitElement, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { type HomeAssistant, type LovelaceCardConfig, fireEvent } from './ha.js';

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

  setConfig(config: C): void {
    this.config = config;
  }

  render() {
    if (!this.hass || !this.config) return nothing;
    const fields = this.fields();
    const labels = Object.fromEntries(fields.map((f) => [f.name, f.label]));
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this.config}
        .schema=${fields.map(({ label, ...f }) => f)}
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

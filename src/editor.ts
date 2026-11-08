import { LitElement, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { type HomeAssistant, type LovelaceCardConfig, fireEvent } from './ha.js';
import { ICONS } from './icons.js';
import { POPUP_COLOURS } from './elements/glass-sheet.js';
import { DEFAULT_QUIET_HOURS } from './stale.js';

export interface FormField {
  name: string;
  label: string;
  required?: boolean;
  selector: Record<string, unknown>;
  /** What the card does when it's left out: shown in the form, and not written to the YAML. */
  default?: unknown;
  /** The config value as the form shows it (a list from a map, objects from plain entity ids)… */
  toForm?: (value: unknown) => unknown;
  /** …and back to the config. */
  fromForm?: (value: unknown) => unknown;
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
    const schema: unknown[] = fields.map(({ label, toForm, fromForm, default: _d, ...f }) => f);
    const data: Record<string, unknown> = { ...this.config };
    for (const f of fields) if (data[f.name] === undefined && f.default !== undefined) data[f.name] = f.default;
    for (const f of fields) if (f.toForm && data[f.name] !== undefined) data[f.name] = f.toForm(data[f.name]);
    if (popup.length) schema.push({ type: 'expandable', name: '', title: 'Pop-up (optional)', flatten: true, schema: popup.map(({ label, ...f }) => f) });
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${schema}
        .computeLabel=${(s: { name: string }) => labels[s.name] ?? s.name}
        @value-changed=${this.valueChanged}
      ></ha-form>
    `;
  }

  private valueChanged(e: CustomEvent<{ value: C }>) {
    const config: Record<string, unknown> = { ...e.detail.value };
    for (const f of this.fields()) {
      if (f.fromForm && config[f.name] !== undefined) config[f.name] = f.fromForm(config[f.name]);
      if (f.default !== undefined && config[f.name] === f.default) delete config[f.name];
    }
    // Drop empty optional fields so the saved YAML stays tidy.
    for (const [key, value] of Object.entries(config)) {
      const emptyMap = value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;
      if (value === '' || value === undefined || (Array.isArray(value) && value.length === 0) || emptyMap) delete config[key];
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

type ListItemField = { label: string; required?: boolean; selector: Record<string, unknown> };

/**
 * A list editor (HA's object selector): each item a row you can reorder,
 * open as a small form, or remove, and + Add. `labelField` names each row.
 * `entityShorthand`: items that are just an entity id stay plain strings in
 * the YAML (switches, scenes), and the form sees { entity }.
 */
export function listField(
  name: string,
  label: string,
  fields: Record<string, ListItemField>,
  opts: { labelField: string; descriptionField?: string; required?: boolean; entityShorthand?: boolean },
): FormField {
  return {
    name,
    label,
    required: opts.required,
    selector: { object: { multiple: true, label_field: opts.labelField, description_field: opts.descriptionField, fields } },
    ...(opts.entityShorthand
      ? {
          toForm: (v: unknown) => (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? { entity: x } : x)) : v),
          fromForm: (v: unknown) =>
            Array.isArray(v)
              ? v
                  .filter((x) => x && (x as { entity?: string }).entity)
                  .map((x) => (Object.values(x).filter((y) => y !== '' && y !== undefined).length === 1 ? (x as { entity: string }).entity : x))
              : v,
        }
      : {}),
  };
}

/**
 * "Not reporting after": a list of rows, each a sensor type or one sensor and
 * its hours, + Add. The config keeps its map: { door: 24, binary_sensor.back_door: 48 }.
 */
export function quietHoursField(): FormField {
  return {
    name: 'quiet_hours',
    label: 'Not reporting after (optional): raise the hours for a sensor type, or for one sensor that reports rarely. Applies to the whole dashboard.',
    selector: {
      object: {
        multiple: true,
        label_field: 'type',
        description_field: 'sensor',
        fields: {
          type: {
            label: 'Sensor type',
            selector: { select: { mode: 'dropdown', options: Object.keys(DEFAULT_QUIET_HOURS).map((value) => ({ value, label: `${words(value.replace(/_/g, ' '))} (default ${DEFAULT_QUIET_HOURS[value]} h)` })) } },
          },
          sensor: { label: 'Or one sensor', selector: { entity: {} } },
          hours: { label: 'Hours', required: true, selector: { number: { min: 1, max: 720, mode: 'box', unit_of_measurement: 'h' } } },
        },
      },
    },
    toForm: (v) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? Object.entries(v as Record<string, number>).map(([k, hours]) => (k.includes('.') ? { sensor: k, hours } : { type: k, hours }))
        : v,
    fromForm: (v) =>
      Array.isArray(v)
        ? Object.fromEntries(
            (v as { type?: string; sensor?: string; hours?: number }[])
              .filter((r) => (r.sensor || r.type) && Number(r.hours) > 0)
              .map((r) => [r.sensor || r.type, Number(r.hours)]),
          )
        : v,
  };
}

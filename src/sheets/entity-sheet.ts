import { css, html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult } from 'lit';
import '../elements/glass-chip.js';
import '../elements/glass-number.js';
import '../elements/glass-popup-summary.js';
import { nil } from '../elements/nil.js';
import { heading } from '../elements/type.js';
import { cardSurface, tileSurface } from '../elements/surfaces.js';
import { property } from 'lit/decorators.js';
import { GlassSheet } from '../elements/glass-sheet.js';
import { type HassEntity, isUnavailable } from '../ha.js';
import { areaOf, nameInRoom } from '../rooms.js';
import { clock } from '../time.js';
import type { IconName } from '../icons.js';

/** A fact tile under a sheet's chart: "Lowest · 16.1°". */
export interface Fact {
  label: string;
  value: string | TemplateResult;
}

export type Tone = 'success' | 'attention' | 'info' | 'neutral';

/**
 * Base for the sheets that replace Home Assistant's more-info dialog. Each one
 * shows a single entity: its name (without the room) and room as the title,
 * and the shared parts below (big reading, state pill, chart card, facts).
 */
export abstract class GlassEntitySheet extends GlassSheet {
  @property() entityId = '';

  protected get entity(): HassEntity | undefined {
    return this.hass?.states[this.entityId];
  }

  protected sheetTitle = '';
  protected sheetIcon: IconName = 'gauge';

  /** The title pill follows the entity: its name, icon and icon colour. */
  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const e = this.entity;
    if (!e || !this.hass) return;
    const name = nameInRoom(this.hass, e);
    // "Living Room thermostat" in the Living Room is "Thermostat", not "thermostat".
    this.sheetTitle = name.charAt(0).toUpperCase() + name.slice(1);
    this.sheetIcon = this.iconFor(e);
    this.sheetIconBg = this.iconBgFor(e);
  }

  protected iconFor(_e: HassEntity): IconName {
    return 'gauge';
  }

  protected iconBgFor(_e: HassEntity): string {
    return 'var(--glass-accent)';
  }

  protected get sheetSubtitle(): string {
    const area = this.hass ? areaOf(this.hass, this.entityId) : undefined;
    return area ? (this.hass!.areas?.[area]?.name ?? '') : '';
  }

  protected get unavailable(): boolean {
    return isUnavailable(this.entity);
  }

  /** "Unavailable since 21:40" from the entity's last_changed. */
  protected sinceLine(prefix = 'Unavailable'): string {
    const e = this.entity;
    return e ? `${prefix} since ${clock(e.last_changed)}` : prefix;
  }

  /** The big reading: a value with its unit, or a word; a grey dash when there's none. */
  /** `dim`: the sensor has gone quiet, so its last value shows greyed. */
  protected renderReading(value: string | undefined, unit = '', caption = '', pill?: { text: string; tone: Tone }, dim = false): TemplateResult {
    return html`<glass-popup-summary .value=${value ?? ''} unit=${unit} line=${caption} ?grey=${dim}>${pill ? this.renderPill(pill.text, pill.tone) : nothing}</glass-popup-summary>`;
  }

  protected renderPill(text: string, tone: Tone): TemplateResult {
    return html`<glass-pill class="pill" tone=${tone}>${text}</glass-pill>`;
  }

  protected renderFacts(facts: Fact[]): TemplateResult {
    return html`<div class="facts">
      ${facts.map((f) => html`<span class="fact"><span class="label">${f.label}</span>${this.factValue(f.value)}</span>`)}
    </div>`;
  }

  /** A fact's value as a Small tile number (the grey dash when there's none); anything else as it is. */
  protected factValue(v: string | TemplateResult): TemplateResult {
    return typeof v === 'string' ? html`<glass-number size="small" .value=${v}></glass-number>` : v === nil ? html`<glass-number size="small" nil></glass-number>` : html`${v}`;
  }

  /** A row of option chips (presets, effects, speakers), the current one in ink. */
  protected renderChips(options: string[], current: string | undefined, pick: (o: string) => void, even = false): TemplateResult {
    return html`<div class="chips ${even ? 'even' : ''}">
      ${options.map(
        (o) => html`<glass-toggle-chip size=${even ? 'fill' : 'default'} ?on=${o === current} @click=${() => pick(o)}>${o}</glass-toggle-chip>`,
      )}
    </div>`;
  }

  static styles: CSSResultGroup = [
    GlassSheet.styles,
    css`
      .card {
        ${cardSurface}
        box-sizing: border-box;
        padding: var(--glass-space-edge);
        border-radius: var(--glass-radius-card);
        display: flex;
        flex-direction: column;
        gap: var(--glass-space-tile-gap);
      }
      .card-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }
      h2 {
        ${heading}
      }
      .note {
        font-size: var(--glass-text-caption);
        color: var(--glass-text-muted);
      }
      .facts {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      .fact,
      .tile {
        ${tileSurface}
        height: 92px;
        box-sizing: border-box;
        border-radius: var(--glass-radius-small-tile);
        padding: var(--glass-space-small-tile);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .fact .label,
      .tile .label {
        font-size: var(--glass-text-small);
        color: var(--glass-text-muted);
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--glass-space-chip);
      }
      button:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      .faded {
        opacity: 0.5;
        pointer-events: none;
      }
    `,
  ];
}

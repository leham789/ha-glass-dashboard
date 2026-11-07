import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HassEntity } from '../ha.js';
import { COLOUR_MODES } from '../light-colour.js';
import './glass-button.js';
import type { GlassSegmented } from './glass-button.js';
import './glass-chip.js';

const WHITES: [string, number][] = [['Warm', 2700], ['Neutral', 4000], ['Cool', 5500]];
const QUICK: [string, number][] = [['Red', 0], ['Orange', 30], ['Yellow', 50], ['Green', 130], ['Cyan', 185], ['Blue', 220], ['Purple', 275]];

/** Hue colours as the bar and quick colours draw them: 80% saturation, 62% lightness. */
export const hueCss = (h: number) => `hsl(${h}, 80%, 62%)`;

export function hueName(h: number): string {
  const names: [number, string][] = [[15, 'Red'], [40, 'Orange'], [65, 'Yellow'], [160, 'Green'], [200, 'Cyan'], [255, 'Blue'], [290, 'Purple'], [345, 'Pink'], [360, 'Red']];
  return names.find(([max]) => h <= max)![1];
}

/**
 * Colour controls (Library: Colour controls): White and Colour tabs (the
 * Segmented control) for a bulb that has both, the colour temperature bar
 * with the white presets, or the hue bar with the quick colours. The marker
 * stays 30 in from each end, clear of the bar's rounded ends.
 *
 * Reads the light's attributes from `entity`; fires `turn-on` with the
 * light.turn_on data (color_temp_kelvin or hs_color). `disabled` fades it.
 */
@customElement('glass-colour-controls')
export class GlassColourControls extends LitElement {
  @property({ attribute: false }) entity?: HassEntity;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @state() private tab?: 'White' | 'Colour';
  /** What the bars show while dragging, before HA reports back. */
  @state() private draft: { kelvin?: number; hue?: number } = {};

  private turnOn(data: Record<string, unknown>) {
    this.dispatchEvent(new CustomEvent('turn-on', { detail: data, bubbles: true, composed: true }));
  }

  render() {
    const e = this.entity;
    if (!e) return nothing;
    const a = e.attributes;
    const on = e.state === 'on';
    const modes: string[] = a.supported_color_modes ?? [];
    const hasWhite = modes.includes('color_temp');
    const hasColour = modes.some((m) => COLOUR_MODES.has(m));
    if (!hasWhite && !hasColour) return nothing;
    const tab = this.tab ?? (COLOUR_MODES.has(a.color_mode) ? 'Colour' : hasWhite ? 'White' : 'Colour');
    const kMin: number = a.min_color_temp_kelvin ?? 2000;
    const kMax: number = a.max_color_temp_kelvin ?? 6500;
    const kelvin = this.draft.kelvin ?? a.color_temp_kelvin ?? 2700;
    const hue = this.draft.hue ?? (Array.isArray(a.hs_color) ? Math.round(a.hs_color[0]) : 30);
    const val = (ev: Event) => Number((ev.target as HTMLInputElement).value);

    return html`
      ${hasWhite && hasColour
        ? html`<glass-segmented
            label="Colour mode"
            .options=${(['White', 'Colour'] as const).map((t) => ({ value: t, label: t }))}
            .value=${tab}
            @change=${(ev: Event) => (this.tab = (ev.target as GlassSegmented).value as 'White' | 'Colour')}
          ></glass-segmented>`
        : nothing}
      ${hasWhite && (tab === 'White' || !hasColour)
        ? html`<div class="row-label"><span>Colour temperature</span><span class="dim">${kelvin} K</span></div>
            <div class="bar temp">
              <span class="marker" style="--at: ${(kelvin - kMin) / (kMax - kMin)}"></span>
              <input
                type="range"
                min=${kMin}
                max=${kMax}
                step="50"
                .value=${String(kelvin)}
                aria-label="Colour temperature"
                @input=${(ev: Event) => (this.draft = { ...this.draft, kelvin: val(ev) })}
                @change=${(ev: Event) => {
                  ev.stopPropagation();
                  this.turnOn({ color_temp_kelvin: val(ev) });
                  this.draft = { ...this.draft, kelvin: undefined };
                }}
              />
            </div>
            <div class="whites">
              ${WHITES.map(([n, k]) => {
                const kk = Math.min(kMax, Math.max(kMin, k));
                const picked = on && a.color_mode === 'color_temp' && Math.abs(kelvin - kk) < 100;
                return html`<glass-colour-preset swatch="var(--glass-swatch-${n.toLowerCase()})" ?selected=${picked} @click=${() => this.turnOn({ color_temp_kelvin: kk })}>${n}</glass-colour-preset>`;
              })}
            </div>`
        : html`<div class="row-label"><span>Colour</span><span class="dim"><span class="dot" style="background: ${hueCss(hue)}"></span>${hueName(hue)}</span></div>
            <div class="bar hue">
              <span class="marker" style="--at: ${hue / 359}"></span>
              <input
                type="range"
                min="0"
                max="359"
                .value=${String(hue)}
                aria-label="Colour"
                @input=${(ev: Event) => (this.draft = { ...this.draft, hue: val(ev) })}
                @change=${(ev: Event) => {
                  ev.stopPropagation();
                  this.turnOn({ hs_color: [val(ev), 100] });
                  this.draft = { ...this.draft, hue: undefined };
                }}
              />
            </div>
            <div class="quick">
              ${QUICK.map(([n, h]) => {
                const picked = on && COLOUR_MODES.has(a.color_mode) && Math.abs(hue - h) < 8;
                return html`<glass-colour-preset swatch-only swatch=${hueCss(h)} label=${n} ?selected=${picked} @click=${() => this.turnOn({ hs_color: [h, 100] })}></glass-colour-preset>`;
              })}
            </div>`}
    `;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    :host([disabled]) {
      opacity: 0.5;
      pointer-events: none;
    }
    .row-label {
      display: flex;
      justify-content: space-between;
      font-size: var(--glass-text-body);
    }
    .dim {
      color: var(--glass-text-secondary);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dim .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    .bar {
      position: relative;
      box-sizing: border-box;
      height: 72px;
      border-radius: 36px;
      overflow: hidden;
    }
    .bar:has(input:focus-visible) {
      outline: 2px solid var(--glass-ink);
      outline-offset: 2px;
    }
    .bar.temp {
      border: 1px solid rgba(var(--glass-line-rgb), 0.06);
      background: var(--glass-kelvin-scale);
    }
    .bar.hue {
      background: var(--glass-hue-scale);
    }
    /* 30 in from each end, so the rounded ends never hide it. */
    .marker {
      position: absolute;
      top: 10px;
      bottom: 10px;
      left: calc(30px + (100% - 60px) * var(--at));
      width: 6px;
      margin-left: -3px;
      border-radius: 3px;
      background: var(--glass-knob);
      box-shadow: var(--glass-marker-shadow);
      pointer-events: none;
    }
    input {
      -webkit-appearance: none;
      appearance: none;
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      opacity: 0;
      background: transparent;
      cursor: ew-resize;
      touch-action: pan-y;
    }
    /* A 60-wide thumb maps the value onto the same 30-in span as the marker. */
    input::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 60px;
      height: 72px;
    }
    input::-moz-range-thumb {
      width: 60px;
      height: 72px;
      border: 0;
    }
    .whites {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .quick {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 8px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-colour-controls': GlassColourControls;
  }
}

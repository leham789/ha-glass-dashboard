import { css, html, nothing, type CSSResultGroup } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { GlassEntitySheet } from './entity-sheet.js';
import type { HassEntity } from '../ha.js';
import type { IconName } from '../icons.js';
import { brightnessPct, groupMembers, isLightOn, lightLook } from '../light-colour.js';
import { nameInRoom } from '../rooms.js';
import { clock } from '../time.js';

const COLOUR_MODES = ['hs', 'rgb', 'rgbw', 'rgbww', 'xy'];
const WHITES: [string, number][] = [['Warm', 2700], ['Neutral', 4000], ['Cool', 6500]];
const QUICK: [string, number][] = [['Red', 0], ['Orange', 30], ['Yellow', 50], ['Green', 130], ['Cyan', 185], ['Blue', 220], ['Purple', 275]];
/** Hue colours as the slider and quick colours draw them: 80% saturation, 62% lightness. */
const hueCss = (h: number) => `hsl(${h}, 80%, 62%)`;

/**
 * Replaces HA's light pop-up: brightness as the big number and slider, White
 * (colour temperature) and Colour tabs for the modes the bulb supports, its
 * effects, and for a group the lights inside it.
 */
@customElement('glass-light-sheet')
export class GlassLightSheet extends GlassEntitySheet {
  @state() private tab?: 'White' | 'Colour';
  /** What the sliders show while dragging, before HA reports back. */
  @state() private draft: { bri?: number; kelvin?: number; hue?: number } = {};

  protected iconFor(): IconName {
    return 'lightbulb';
  }

  protected iconBgFor(e: HassEntity): string {
    return isLightOn(e, this.hass!.states) ? lightLook(e).background : 'var(--glass-neutral-tint)';
  }

  private turnOn(data: Record<string, unknown>) {
    this.hass!.callService('light', 'turn_on', { entity_id: this.entityId, ...data });
  }

  protected renderBody() {
    const e = this.entity;
    if (!e) return html``;
    const a = e.attributes;
    const off = this.unavailable;
    const on = isLightOn(e, this.hass!.states);
    const modes: string[] = a.supported_color_modes ?? [];
    const dims = modes.some((m) => m !== 'onoff') || typeof a.brightness === 'number';
    const hasWhite = modes.includes('color_temp');
    const hasColour = modes.some((m) => COLOUR_MODES.includes(m));
    const tab = this.tab ?? (COLOUR_MODES.includes(a.color_mode) ? 'Colour' : hasWhite ? 'White' : 'Colour');
    const bri = this.draft.bri ?? brightnessPct(e) ?? 0;
    const kMin: number = a.min_color_temp_kelvin ?? 2000;
    const kMax: number = a.max_color_temp_kelvin ?? 6500;
    const kelvin = this.draft.kelvin ?? a.color_temp_kelvin ?? 2700;
    const hue = this.draft.hue ?? (Array.isArray(a.hs_color) ? Math.round(a.hs_color[0]) : 30);
    const look = lightLook(e, on);
    const fill = look.tone === 'colour' ? `linear-gradient(90deg, ${look.background} 0%, rgb(${(a.rgb_color ?? [255, 200, 120]).join(', ')}) 100%)` : 'var(--glass-light-fill)';
    const caption = off
      ? this.sinceLine()
      : !on
        ? `Off since ${clock(e.last_changed)}`
        : COLOUR_MODES.includes(a.color_mode)
          ? `${hueName(hue)} · on since ${clock(e.last_changed)}`
          : a.color_mode === 'color_temp'
            ? `${kelvin} K · ${kelvin < 3000 ? 'warm' : kelvin < 4500 ? 'neutral' : 'cool'} white`
            : `On since ${clock(e.last_changed)}`;
    const members = groupMembers(e);
    const effects: string[] = Array.isArray(a.effect_list) ? a.effect_list : [];

    return html`
      <div class="reading">
        <span class="left">
          <span class="value ${on ? '' : 'none'}">
            <span class="big">${off ? html`<i class="nil"></i>` : on ? (dims ? bri : 'On') : 'Off'}</span>
            ${on && dims ? html`<span class="unit">%</span>` : nothing}
          </span>
          <span class="caption">${caption}</span>
        </span>
        <span class="right">
          ${off ? this.renderPill('Unavailable', 'neutral') : nothing}
          <button
            type="button"
            role="switch"
            class="switch ${on ? 'on' : ''}"
            aria-checked=${on ? 'true' : 'false'}
            aria-label="Power"
            ?disabled=${off}
            @click=${() => this.hass!.callService('light', on ? 'turn_off' : 'turn_on', { entity_id: e.entity_id })}
          ></button>
        </span>
      </div>

      ${dims
        ? html`<div class="slider ${off ? 'faded' : ''}">
            <span class="fill" style="width: ${on ? bri : 0}%; background: ${fill}"></span>
            <glass-icon name="sun" size="22"></glass-icon>
            <input
              type="range"
              min="1"
              max="100"
              .value=${String(bri)}
              aria-label="Brightness"
              @input=${(ev: Event) => (this.draft = { ...this.draft, bri: Number((ev.target as HTMLInputElement).value) })}
              @change=${(ev: Event) => {
                this.turnOn({ brightness_pct: Number((ev.target as HTMLInputElement).value) });
                this.draft = { ...this.draft, bri: undefined };
              }}
            />
          </div>`
        : nothing}

      ${hasWhite || hasColour
        ? html`<div class="colour ${off ? 'faded' : ''}">
            ${hasWhite && hasColour
              ? html`<span class="tabs" role="group" aria-label="Colour mode">
                  ${(['White', 'Colour'] as const).map(
                    (t) => html`<button type="button" class=${t === tab ? 'on' : ''} aria-pressed=${t === tab ? 'true' : 'false'} @click=${() => (this.tab = t)}>${t}</button>`,
                  )}
                </span>`
              : nothing}
            ${hasWhite && (tab === 'White' || !hasColour)
              ? html`<label class="row-label"><span>Colour temperature</span><span class="dim">${kelvin} K</span></label>
                  <div class="bar temp">
                    <span class="marker" style="left: ${((kelvin - kMin) / (kMax - kMin)) * 100}%"></span>
                    <input
                      type="range"
                      min=${kMin}
                      max=${kMax}
                      step="50"
                      .value=${String(kelvin)}
                      aria-label="Colour temperature"
                      @input=${(ev: Event) => (this.draft = { ...this.draft, kelvin: Number((ev.target as HTMLInputElement).value) })}
                      @change=${(ev: Event) => {
                        this.turnOn({ color_temp_kelvin: Number((ev.target as HTMLInputElement).value) });
                        this.draft = { ...this.draft, kelvin: undefined };
                      }}
                    />
                  </div>
                  <div class="whites">
                    ${WHITES.map(([n, k]) => {
                      const kk = Math.min(kMax, Math.max(kMin, k));
                      const picked = on && a.color_mode === 'color_temp' && Math.abs(kelvin - kk) < 100;
                      return html`<button type="button" class=${picked ? 'on' : ''} aria-pressed=${picked ? 'true' : 'false'} @click=${() => this.turnOn({ color_temp_kelvin: kk })}>
                        <span class="swatch ${n.toLowerCase()}"></span>${n}
                      </button>`;
                    })}
                  </div>`
              : html`<label class="row-label"><span>Colour</span><span class="dim"><span class="dot" style="background: ${hueCss(hue)}"></span>${hueName(hue)}</span></label>
                  <div class="bar hue">
                    <span class="marker" style="left: ${(hue / 360) * 100}%"></span>
                    <input
                      type="range"
                      min="0"
                      max="359"
                      .value=${String(hue)}
                      aria-label="Colour"
                      @input=${(ev: Event) => (this.draft = { ...this.draft, hue: Number((ev.target as HTMLInputElement).value) })}
                      @change=${(ev: Event) => {
                        this.turnOn({ hs_color: [Number((ev.target as HTMLInputElement).value), 100] });
                        this.draft = { ...this.draft, hue: undefined };
                      }}
                    />
                  </div>
                  <div class="quick">
                    ${QUICK.map(([n, h]) => {
                      const picked = on && COLOUR_MODES.includes(a.color_mode) && Math.abs(hue - h) < 8;
                      return html`<button type="button" class=${picked ? 'on' : ''} aria-label=${n} aria-pressed=${picked ? 'true' : 'false'} style="background: ${hueCss(h)}" @click=${() => this.turnOn({ hs_color: [h, 100] })}></button>`;
                    })}
                  </div>`}
          </div>`
        : nothing}

      ${effects.length && !members
        ? html`<div class="section ${off ? 'faded' : ''}">
            <h2>Effects</h2>
            ${this.renderChips(['None', ...effects.filter((x) => x.toLowerCase() !== 'none')], a.effect && a.effect !== 'off' ? a.effect : 'None', (x) => this.turnOn({ effect: x === 'None' ? 'off' : x }))}
          </div>`
        : nothing}

      ${members
        ? html`<div class="section">
            <h2>In this group</h2>
            ${members.map((id) => {
              const m = this.hass!.states[id];
              const mOn = m?.state === 'on';
              const pct = brightnessPct(m) ?? (mOn ? 100 : 0);
              return html`<button type="button" class="member ${m && m.state !== 'unavailable' ? '' : 'faded'}" aria-pressed=${mOn ? 'true' : 'false'} @click=${() => this.hass!.callService('light', 'toggle', { entity_id: id })}>
                <span class="mfill" style="width: ${mOn ? pct : 0}%"></span>
                <span class="micon ${mOn ? 'lit' : ''}"><glass-icon name="lightbulb" size="19"></glass-icon></span>
                <span class="mname">${m ? nameInRoom(this.hass!, m) : id}</span>
                <span class="mstate">${!m || m.state === 'unavailable' ? 'Offline' : mOn ? `${pct}%` : 'Off'}</span>
              </button>`;
            })}
          </div>`
        : nothing}
    `;
  }

  static styles: CSSResultGroup = [
    GlassEntitySheet.styles,
    css`
      .right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 10px;
        padding-bottom: 6px;
      }
      .right .pill {
        margin: 0;
      }
      .slider,
      .bar {
        position: relative;
        height: 72px;
        border-radius: 36px;
        overflow: hidden;
      }
      .slider {
        background: rgba(var(--glass-line-rgb), 0.06);
        display: flex;
        align-items: center;
        padding-left: 22px;
      }
      .slider .fill {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        border-radius: 36px;
      }
      .slider glass-icon {
        position: relative;
      }
      input[type='range'] {
        -webkit-appearance: none;
        appearance: none;
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        background: transparent;
        cursor: ew-resize;
      }
      input[type='range']::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 24px;
        height: 64px;
        background: transparent;
      }
      .colour,
      .section {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .tabs {
        display: flex;
        gap: 4px;
        padding: 4px;
        border-radius: 26px;
        background: rgba(var(--glass-line-rgb), 0.06);
      }
      .tabs button {
        all: unset;
        flex: 1;
        height: 44px;
        border-radius: 22px;
        text-align: center;
        font-size: var(--glass-text-chip);
        cursor: pointer;
      }
      .tabs button.on {
        background: var(--glass-raised);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
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
        gap: 6px;
      }
      .dim .dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
      }
      .bar.temp {
        box-sizing: border-box;
        border: 1px solid rgba(var(--glass-line-rgb), 0.06);
        background: linear-gradient(90deg, #ffb46b 0%, #ffd9a8 30%, #fff1de 55%, #f2f4ff 80%, #d9e5ff 100%);
      }
      .bar.hue {
        background: linear-gradient(90deg, hsl(0, 80%, 62%), hsl(60, 80%, 62%), hsl(120, 80%, 62%), hsl(180, 80%, 62%), hsl(240, 80%, 62%), hsl(300, 80%, 62%), hsl(360, 80%, 62%));
      }
      .marker {
        position: absolute;
        top: 10px;
        bottom: 10px;
        width: 6px;
        margin-left: -3px;
        border-radius: 3px;
        background: #fff;
        box-shadow: 0 0 0 1px rgba(18, 19, 22, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15);
        pointer-events: none;
      }
      .whites {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .whites button {
        all: unset;
        box-sizing: border-box;
        height: 56px;
        border-radius: var(--glass-radius-inset);
        border: 1px solid rgba(var(--glass-line-rgb), 0.08);
        background: var(--glass-solid);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        font-size: var(--glass-text-small);
        cursor: pointer;
      }
      .whites button.on {
        border-color: var(--glass-ink);
      }
      .swatch {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        box-shadow: inset 0 0 0 1px rgba(18, 19, 22, 0.1);
      }
      .swatch.warm {
        background: #ffd9a8;
      }
      .swatch.neutral {
        background: #fff1de;
      }
      .swatch.cool {
        background: #d9e5ff;
      }
      .quick {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 8px;
      }
      .quick button {
        all: unset;
        height: 40px;
        border-radius: 20px;
        cursor: pointer;
      }
      .quick button.on {
        box-shadow: 0 0 0 2px var(--glass-sheet), 0 0 0 4px var(--glass-ink);
      }
      .member {
        all: unset;
        position: relative;
        overflow: hidden;
        box-sizing: border-box;
        height: 64px;
        border-radius: 32px;
        border: 1px solid rgba(var(--glass-line-rgb), 0.08);
        background: var(--glass-solid);
        padding: 0 16px 0 10px;
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
      }
      .mfill {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        border-radius: 32px;
        background: var(--glass-light-fill);
        transition: width 0.25s ease;
      }
      .micon,
      .mname,
      .mstate {
        position: relative;
      }
      .micon {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: var(--glass-neutral-tint);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .micon.lit {
        background: rgba(var(--glass-surface-rgb), 0.7);
      }
      .mname {
        flex: 1;
        font-size: var(--glass-text-body);
      }
      .mstate {
        font-size: var(--glass-text-caption);
        color: var(--glass-text-secondary);
      }
    `,
  ];
}

function hueName(h: number): string {
  const names: [number, string][] = [[15, 'Red'], [40, 'Orange'], [65, 'Yellow'], [160, 'Green'], [200, 'Cyan'], [255, 'Blue'], [290, 'Purple'], [345, 'Pink'], [360, 'Red']];
  return names.find(([max]) => h <= max)![1];
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-light-sheet': GlassLightSheet;
  }
}

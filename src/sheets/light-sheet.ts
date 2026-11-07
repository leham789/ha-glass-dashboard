import { css, html, nothing, type CSSResultGroup } from 'lit';
import '../elements/glass-chip.js';
import '../elements/glass-button.js';
import '../elements/glass-slider.js';
import type { GlassSlider } from '../elements/glass-slider.js';
import { hueName } from '../elements/glass-colour-controls.js';
import { customElement, state } from 'lit/decorators.js';
import { GlassEntitySheet } from './entity-sheet.js';
import type { HassEntity } from '../ha.js';
import type { IconName } from '../icons.js';
import { brightnessPct, groupMembers, isLightOn, lightLook } from '../light-colour.js';
import { nameInRoom } from '../rooms.js';
import { clock } from '../time.js';
import { haptic } from '../motion.js';

const COLOUR_MODES = ['hs', 'rgb', 'rgbw', 'rgbww', 'xy'];

/**
 * Replaces HA's light pop-up: brightness as the big number and slider, White
 * (colour temperature) and Colour tabs for the modes the bulb supports, its
 * effects, and for a group the lights inside it.
 */
@customElement('glass-light-sheet')
export class GlassLightSheet extends GlassEntitySheet {
  /** What the sliders show while dragging, before HA reports back. */
  @state() private draft: { bri?: number } = {};

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
    const bri = this.draft.bri ?? brightnessPct(e) ?? 0;
    const kelvin: number = a.color_temp_kelvin ?? 2700;
    const hue = Array.isArray(a.hs_color) ? Math.round(a.hs_color[0]) : 30;
    const look = lightLook(e, on);
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
          <glass-number size="display" .value=${off ? '' : on ? (dims ? String(bri) : 'On') : 'Off'} unit=${on && dims ? '%' : ''} ?grey=${!on}></glass-number>
          <span class="caption">${caption}</span>
        </span>
        <span class="right">
          ${off ? this.renderPill('Unavailable', 'neutral') : nothing}
          <glass-switch ?checked=${on} label="Power"
            ?disabled=${off} @change=${() => (haptic('light'), this.hass!.callService('light', on ? 'turn_off' : 'turn_on', { entity_id: e.entity_id }))}></glass-switch>
        </span>
      </div>

      ${dims
        ? html`<glass-slider
            label="Brightness"
            min="1"
            .value=${on ? bri : 1}
            fill=${look.tone === 'colour' ? 'colour' : 'light'}
            .rgb=${look.tone === 'colour' ? a.rgb_color : undefined}
            ?disabled=${off}
            @input=${(ev: Event) => (this.draft = { bri: (ev.target as GlassSlider).value })}
            @change=${(ev: Event) => {
              this.turnOn({ brightness_pct: (ev.target as GlassSlider).value });
              this.draft = {};
            }}
          ></glass-slider>`
        : nothing}

      ${modes.some((m) => m === 'color_temp' || COLOUR_MODES.includes(m))
        ? html`<glass-colour-controls .entity=${e} ?disabled=${off} @turn-on=${(ev: CustomEvent) => this.turnOn(ev.detail)}></glass-colour-controls>`
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
              return html`<button type="button" class="member ${m && m.state !== 'unavailable' ? '' : 'faded'}" aria-pressed=${mOn ? 'true' : 'false'} @click=${() => (haptic('light'), this.hass!.callService('light', 'toggle', { entity_id: id }))}>
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
        gap: 12px;
        padding-bottom: 8px;
      }
      .right .pill {
        margin: 0;
      }
      .section {
        display: flex;
        flex-direction: column;
        gap: 16px;
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
        padding: 0 16px 0 12px;
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

declare global {
  interface HTMLElementTagNameMap {
    'glass-light-sheet': GlassLightSheet;
  }
}

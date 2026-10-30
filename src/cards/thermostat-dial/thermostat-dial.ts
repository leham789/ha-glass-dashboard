import { LitElement, css, html, nothing, svg, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, isUnavailable, registerCard } from '../../ha.js';
import './thermostat-dial-editor.js';

export interface ThermostatDialConfig extends LovelaceCardConfig {
  entity: string;
  name?: string;
}

const SEND_AFTER_MS = 800;
// The dial: a half circle centred at (160, 170), radius 120.
const CX = 160;
const CY = 170;
const R = 120;

/**
 * The big thermostat: a half-circle dial (drag the knob, or use − and +),
 * the target in the middle with how warm it is now, and the heating modes.
 */
@customElement('glass-thermostat-dial')
export class GlassThermostatDial extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: ThermostatDialConfig;
  @state() private pending?: number;
  private timer?: number;
  private dragging = false;

  static getConfigElement() {
    return document.createElement('glass-thermostat-dial-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<ThermostatDialConfig> {
    return { entity: Object.keys(hass.states).find((id) => id.startsWith('climate.')) ?? '' };
  }

  setConfig(config: ThermostatDialConfig): void {
    if (!config.entity?.startsWith('climate.')) throw new Error('Choose a thermostat');
    this.config = config;
  }

  getCardSize(): number {
    return 7;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    ensureFonts();
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has('hass') || changed.size > 1 || !this.config) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    return !old || old.states[this.config.entity] !== this.hass!.states[this.config.entity];
  }

  private limits() {
    const a = this.hass!.states[this.config!.entity].attributes;
    return { min: a.min_temp ?? 10, max: a.max_temp ?? 30, step: a.target_temp_step ?? 0.5 };
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const e = this.hass.states[this.config.entity];
    if (!e) return nothing;
    const a = e.attributes;
    const off = e.state === 'off' || isUnavailable(e);
    const { min, max } = this.limits();
    const target: number = this.pending ?? a.temperature ?? min;
    const now: number | undefined = a.current_temperature;
    const heating = a.hvac_action === 'heating' || (!a.hvac_action && !off && now !== undefined && target > now);

    const status = isUnavailable(e) ? 'Offline' : off ? 'Heating off' : heating ? 'Heating' : 'Idle';
    const nowText = now === undefined ? '' : `Now ${now.toFixed(1)}°`;
    const nowLine = off
      ? [nowText, 'heating off'].filter(Boolean).join(' · ')
      : now === undefined
        ? ''
        : `${nowText} · ${target > now ? 'warming up' : target < now ? 'warmer than target' : 'on target'}`;

    const frac = Math.min(1, Math.max(0, (target - min) / (max - min)));
    const th = Math.PI * (1 - frac);
    const kx = CX + R * Math.cos(th);
    const ky = CY - R * Math.sin(th);
    const modes: string[] = (a.hvac_modes ?? []).filter((m: string) => ['heat', 'off', 'auto', 'cool', 'heat_cool'].includes(m));

    return html`<section aria-label="Thermostat">
      <span class="head">
        <span class="name">${this.config.name ?? a.friendly_name}</span>
        <span class="status ${heating && !off ? 'heating' : ''}"><span class="dot"></span>${status}</span>
      </span>
      <div class="dial">
        <svg
          viewBox="0 0 320 190"
          role="slider"
          tabindex=${off ? -1 : 0}
          aria-label="Target temperature"
          aria-valuemin=${min}
          aria-valuemax=${max}
          aria-valuenow=${target}
          aria-valuetext="${fmt(target)} degrees${now !== undefined ? `, currently ${now.toFixed(1)}` : ''}"
          @pointerdown=${this.onDown}
          @pointermove=${this.onMove}
          @pointerup=${this.onUp}
          @pointercancel=${this.onUp}
          @keydown=${this.onKey}
        >
          <defs>
            <linearGradient id="heat" x1="40" y1="170" x2="280" y2="170" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#9CC3F2"></stop>
              <stop offset="0.5" stop-color="#F7C66B"></stop>
              <stop offset="1" stop-color="#E0683A"></stop>
            </linearGradient>
          </defs>
          <path d="M 40 170 A 120 120 0 0 1 280 170" stroke="rgba(18,19,22,0.08)" stroke-width="14" stroke-linecap="round" fill="none"></path>
          ${off
            ? nothing
            : svg`<path d="M 40 170 A 120 120 0 0 1 ${kx.toFixed(1)} ${ky.toFixed(1)}" stroke="url(#heat)" stroke-width="14" stroke-linecap="round" fill="none"></path>
                  <circle cx=${kx.toFixed(1)} cy=${ky.toFixed(1)} r="11" fill="#FFFFFF" stroke="#121316" stroke-width="2"></circle>`}
        </svg>
        <span class="centre">
          <span class="target">${off ? 'Off' : `${fmt(target)}°`}</span>
          <span class="now">${nowLine}</span>
        </span>
      </div>
      <span class="controls">
        <button type="button" class="minus" aria-label="Lower target" ?disabled=${off} @click=${() => this.step(-1)}>−</button>
        ${modes.length > 1
          ? html`<span class="modes" role="group" aria-label="Mode">
              ${modes.map(
                (m) => html`<button
                  type="button"
                  class=${m === e.state ? 'current' : ''}
                  aria-pressed=${m === e.state ? 'true' : 'false'}
                  @click=${() => this.hass!.callService('climate', 'set_hvac_mode', { entity_id: e.entity_id, hvac_mode: m })}
                >
                  ${modeName(m)}
                </button>`,
              )}
            </span>`
          : nothing}
        <button type="button" class="plus" aria-label="Raise target" ?disabled=${off} @click=${() => this.step(1)}>+</button>
      </span>
    </section>`;
  }

  private step(dir: number) {
    const { step } = this.limits();
    const a = this.hass!.states[this.config!.entity].attributes;
    this.setTarget((this.pending ?? a.temperature ?? 18) + dir * step);
  }

  /** Clamp, snap to the thermostat's step, show at once, and send after a pause. */
  private setTarget(value: number) {
    const { min, max, step } = this.limits();
    const next = Math.min(max, Math.max(min, Math.round(value / step) * step));
    this.pending = next;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(async () => {
      await this.hass!.callService('climate', 'set_temperature', { entity_id: this.config!.entity, temperature: next });
      this.pending = undefined;
    }, SEND_AFTER_MS);
  }

  private fromPointer(e: PointerEvent) {
    const svgEl = e.currentTarget as SVGSVGElement;
    const box = svgEl.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * 320 - CX;
    const y = CY - ((e.clientY - box.top) / box.height) * 190;
    const angle = Math.atan2(Math.max(0, y), x); // 0 (right) … π (left)
    const { min, max } = this.limits();
    this.setTarget(min + (1 - angle / Math.PI) * (max - min));
  }

  private onDown(e: PointerEvent) {
    if (this.hass!.states[this.config!.entity].state === 'off') return;
    this.dragging = true;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    this.fromPointer(e);
  }

  private onMove(e: PointerEvent) {
    if (this.dragging) this.fromPointer(e);
  }

  private onUp() {
    this.dragging = false;
  }

  private onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') this.step(1);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') this.step(-1);
    else return;
    e.preventDefault();
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      section {
        box-sizing: border-box;
        padding: var(--glass-space-edge);
        border-radius: var(--glass-radius-card);
        background: rgba(255, 255, 255, 0.74);
        border: 1px solid var(--glass-surface-border);
        box-shadow: 0 20px 50px rgba(160, 90, 80, 0.12);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
      }
      .head {
        width: 100%;
        display: flex;
        justify-content: space-between;
        font-size: var(--glass-text-chip);
      }
      .name {
        color: var(--glass-text-secondary);
      }
      .status {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--glass-text-secondary);
      }
      .status .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #8a8d94;
      }
      .status.heating {
        color: var(--glass-attention-text);
      }
      .status.heating .dot {
        background: var(--glass-attention);
      }
      .dial {
        position: relative;
        width: 100%;
        max-width: 320px;
        aspect-ratio: 320 / 190;
      }
      svg {
        width: 100%;
        height: 100%;
        touch-action: none;
        cursor: pointer;
        outline: none;
      }
      svg:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 4px;
        border-radius: 16px;
      }
      .centre {
        position: absolute;
        left: 0;
        right: 0;
        top: 41%;
        display: flex;
        flex-direction: column;
        align-items: center;
        pointer-events: none;
      }
      .target {
        font-size: 64px;
        font-weight: 200;
        letter-spacing: -2px;
        line-height: 1;
      }
      .now {
        font-size: var(--glass-text-caption);
        color: var(--glass-text-muted);
      }
      .controls {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .controls > button {
        all: unset;
        box-sizing: border-box;
        width: 52px;
        height: 52px;
        flex: none;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        cursor: pointer;
      }
      .controls > .minus {
        background: #fff;
        border: 1px solid rgba(18, 19, 22, 0.12);
      }
      .controls > .plus {
        background: var(--glass-ink);
        color: #fff;
      }
      .controls > button:disabled {
        opacity: 0.4;
        cursor: default;
      }
      .modes {
        display: flex;
        gap: 6px;
        padding: 4px;
        border-radius: 26px;
        background: rgba(18, 19, 22, 0.06);
      }
      .modes button {
        all: unset;
        height: 44px;
        padding: 0 16px;
        border-radius: 22px;
        font-size: var(--glass-text-chip);
        cursor: pointer;
      }
      .modes button.current {
        background: #fff;
      }
      button:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
    `,
  ];
}

const fmt = (t: number) => (Number.isInteger(t) ? String(t) : t.toFixed(1));

function modeName(m: string): string {
  return ({ heat: 'Heat', off: 'Off', auto: 'Auto', cool: 'Cool', heat_cool: 'Auto' } as Record<string, string>)[m] ?? m;
}

registerCard({
  type: 'glass-thermostat-dial',
  name: 'Glass · Thermostat dial',
  description: 'The big thermostat: drag the dial or use − and +, with heating modes.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-thermostat-dial': GlassThermostatDial;
  }
}

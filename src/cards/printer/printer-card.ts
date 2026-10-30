import { css, html, nothing, svg, type PropertyValues } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, isUnavailable, openMoreInfo, registerCard } from '../../ha.js';
import { type PrinterEntities, type PrinterPhase, minutesOf, printerState } from '../../printer.js';
import { ago } from '../../time.js';
import { haptic, attentionStyles } from '../../motion.js';
import '../../elements/glass-icon.js';
import './printer-card-editor.js';

export interface PrinterCardConfig extends LovelaceCardConfig, PrinterEntities {
  /** Shown as "3D printer · <name>". */
  name?: string;
  /** The chamber camera. */
  camera?: string;
  chamber_light?: string;
  nozzle_temp?: string;
  bed_temp?: string;
  ams_humidity?: string;
}

const PILL: Record<PrinterPhase, { text: string; tone: string }> = {
  printing: { text: 'Printing', tone: 'info' },
  paused: { text: 'Paused', tone: 'attention' },
  done: { text: 'Done', tone: 'success' },
  failed: { text: 'Failed', tone: 'attention' },
  idle: { text: 'Idle', tone: 'neutral' },
};
const REFRESH_MS = 10_000;

/**
 * The 3D printer on its room screen. While printing (and for two hours after)
 * it's the full card: chamber camera with its light, a progress ring, the
 * print and time left, and nozzle / bed / AMS readings. Otherwise it's one
 * compact row that opens the full card when tapped.
 */
@customElement('glass-printer')
export class GlassPrinter extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: PrinterCardConfig;
  /** Opened by hand while idle. */
  @state() private expanded = false;
  @state() private tick = Date.now();
  private timer?: number;

  static getConfigElement() {
    return document.createElement('glass-printer-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<PrinterCardConfig> {
    const find = (re: RegExp) => Object.keys(hass.states).find((id) => re.test(id));
    return {
      printer_status: find(/^sensor\..*print_status$/),
      printer_progress: find(/^sensor\..*print_progress$/),
      printer_remaining: find(/^sensor\..*remaining_time$/),
      printer_task: find(/^sensor\..*task_name$/),
      camera: find(/^camera\..*(p1|x1|a1|chamber)/),
      chamber_light: find(/^light\..*chamber/),
      nozzle_temp: find(/^sensor\..*nozzle_temperature$/),
      bed_temp: find(/^sensor\..*bed_temperature$/),
      ams_humidity: find(/^sensor\..*ams.*humidity$/),
    };
  }

  setConfig(config: PrinterCardConfig): void {
    if (!config.printer_status) throw new Error('Choose the printer’s status sensor');
    this.config = config;
  }

  getCardSize(): number {
    return 6;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    ensureFonts();
    this.timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') this.tick = Date.now();
    }, REFRESH_MS);
  }

  disconnectedCallback(): void {
    window.clearInterval(this.timer);
    super.disconnectedCallback();
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has('hass') || changed.size > 1 || !this.config) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    const c = this.config;
    const ids = [c.printer_status, c.printer_progress, c.printer_remaining, c.printer_task, c.camera, c.chamber_light, c.nozzle_temp, c.bed_temp, c.ams_humidity];
    return !old || ids.some((id) => id && old.states[id] !== this.hass!.states[id]);
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const p = printerState(this.hass, this.config);
    if (!p) return nothing;
    const title = `3D printer${this.config.name ? ` · ${this.config.name}` : ''}`;
    if (!p.showFull && !this.expanded) {
      // Bambu printers keep saying "finish" until the next print, so a print
      // that ended over two hours ago reads as idle, with when it ended.
      const sub = p.phase === 'failed' ? `Last print failed ${ago(p.status.last_changed)}` : `Idle · last print ${ago(p.status.last_changed)}`;
      return html`<button type="button" class="compact" aria-label="Show 3D printer details" @click=${() => (this.expanded = true)}>
        <span class="round"><glass-icon name="printer" size="22"></glass-icon></span>
        <span class="text">
          <span class="t">${title}</span>
          <span class="sub">${sub}</span>
        </span>
        <glass-icon name="chevron-right" size="18" stroke="1.8"></glass-icon>
      </button>`;
    }
    return this.renderFull(p, title);
  }

  private renderFull(p: NonNullable<ReturnType<typeof printerState>>, title: string) {
    const c = this.config!;
    const hass = this.hass!;
    const pill = PILL[p.phase];
    const cam = c.camera ? hass.states[c.camera] : undefined;
    const pic = cam?.attributes.entity_picture as string | undefined;
    const src = pic && !pic.startsWith('data:') ? `${pic}${pic.includes('?') ? '&' : '?'}t=${this.tick}` : pic;
    const light = c.chamber_light ? hass.states[c.chamber_light] : undefined;
    const lightOn = light?.state === 'on';
    const pct = p.phase === 'done' ? 100 : Math.round(p.progress ?? 0);
    const circumference = 2 * Math.PI * 32;
    const rem = hass.states[c.printer_remaining ?? ''];
    const ends = rem && p.left && p.phase === 'printing' ? new Date(Date.now() + minutesOf(rem) * 60_000) : undefined;
    const line1 =
      p.phase === 'printing'
        ? [p.left ? `${p.left} left` : '', ends ? `ends ${ends.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : '']
            .filter(Boolean)
            .join(' · ')
        : p.phase === 'paused'
          ? 'Paused'
          : `Finished ${ago(p.status.last_changed)}`;
    const reading = (id?: string, unit = '') => {
      const e = id ? hass.states[id] : undefined;
      return e && !isUnavailable(e) ? `${Math.round(Number(e.state))}${unit}` : '–';
    };

    return html`<section aria-labelledby="h">
      <span class="head">
        <h2 id="h">${title}</h2>
        <span class="right">
          <span class="pill ${pill.tone} ${pill === PILL.done ? 'ringing' : ''}"><span class="dot"></span>${pill.text}</span>
          ${!p.showFull
            ? html`<button type="button" class="collapse" aria-label="Collapse printer card" @click=${() => (this.expanded = false)}>
                <glass-icon name="chevron-up" size="16" stroke="1.8"></glass-icon>
              </button>`
            : nothing}
        </span>
      </span>
      ${cam
        ? html`<div class="view">
            ${src && !isUnavailable(cam) ? html`<img src=${src} alt="" />` : html`<span class="none">Camera offline</span>`}
            <span class="badge"><span class="live"></span>Live</span>
            <button type="button" class="expand" aria-label="Open live view" @click=${() => openMoreInfo(this, c.camera!)}>
              <glass-icon name="maximize-2" size="16" stroke="1.8"></glass-icon>
            </button>
            ${light
              ? html`<button
                  type="button"
                  class="light"
                  aria-pressed=${lightOn ? 'true' : 'false'}
                  @click=${() => (haptic('light'), hass.callService('light', lightOn ? 'turn_off' : 'turn_on', { entity_id: c.chamber_light }))}
                >
                  Chamber light · ${lightOn ? 'On' : 'Off'}
                </button>`
              : nothing}
          </div>`
        : nothing}
      <div class="progress">
        <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label="Print ${pct}% complete">
          <circle cx="38" cy="38" r="32" stroke="currentColor" stroke-opacity="0.08" stroke-width="8" fill="none"></circle>
          ${svg`<circle cx="38" cy="38" r="32" stroke=${p.phase === 'done' ? '#2FB457' : '#3B7DD8'} stroke-width="8" fill="none"
            stroke-linecap="round" stroke-dasharray="${(pct / 100) * circumference} ${circumference}" transform="rotate(-90 38 38)"></circle>`}
          <text x="38" y="43" text-anchor="middle" font-family="Outfit, sans-serif" font-size="16" fill="currentColor">${pct}%</text>
        </svg>
        <span class="lines">
          <span class="l1">${line1}</span>
          <span class="l2">${p.task || 'No print name'}</span>
        </span>
      </div>
      <div class="readings">
        <span><span class="k">Nozzle</span><span class="v">${reading(c.nozzle_temp, '°')}</span></span>
        <span><span class="k">Bed</span><span class="v">${reading(c.bed_temp, '°')}</span></span>
        <span><span class="k">AMS humidity</span><span class="v">${reading(c.ams_humidity, '%')}</span></span>
      </div>
    </section>`;
  }

  static styles = [
    tokens,
    attentionStyles,
    css`
      :host {
        display: block;
      }
      .compact {
        all: unset;
        box-sizing: border-box;
        width: 100%;
        height: 76px;
        padding: 0 18px 0 12px;
        border-radius: 38px;
        background: var(--glass-surface);
        border: 1px solid var(--glass-surface-border);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        display: flex;
        align-items: center;
        gap: 14px;
        cursor: pointer;
      }
      .round {
        width: 52px;
        height: 52px;
        flex: none;
        border-radius: 50%;
        background: var(--glass-neutral-tint);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .text {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .t {
        font-size: var(--glass-text-body);
      }
      .sub {
        font-size: var(--glass-text-caption);
        color: var(--glass-text-muted);
      }
      section {
        box-sizing: border-box;
        padding: var(--glass-space-edge);
        border-radius: var(--glass-radius-card);
        background: rgba(var(--glass-surface-rgb), 0.8);
        border: 1px solid var(--glass-surface-border);
        box-shadow: 0 18px 44px rgba(40, 80, 30, 0.1);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 400;
      }
      .right {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .pill {
        height: 30px;
        padding: 0 12px;
        border-radius: 15px;
        font-size: var(--glass-text-caption);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .pill .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
      }
      .pill.info {
        background: var(--glass-info-tint);
        color: var(--glass-info-ink);
      }
      .pill.info .dot {
        background: var(--glass-info);
      }
      .pill.success {
        background: var(--glass-success-tint);
        color: var(--glass-success-ink);
      }
      .pill.success .dot {
        background: #2fa84f;
      }
      .pill.attention {
        background: var(--glass-attention-tint);
        color: var(--glass-attention-ink);
      }
      .pill.attention .dot {
        background: var(--glass-attention);
      }
      .pill.neutral {
        background: var(--glass-neutral-tint);
        color: var(--glass-text-secondary);
      }
      .pill.neutral .dot {
        background: #8a8d94;
      }
      .collapse {
        all: unset;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--glass-neutral-tint);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .view {
        position: relative;
        height: 180px;
        overflow: hidden;
        border-radius: var(--glass-radius-small-tile);
        background: linear-gradient(135deg, #2a2d33 0%, #4a4e57 100%);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .none {
        font-size: var(--glass-text-caption);
        color: rgba(255, 255, 255, 0.65);
      }
      .badge {
        position: absolute;
        top: 12px;
        left: 12px;
        height: 24px;
        padding: 0 10px;
        border-radius: 12px;
        background: rgba(0, 0, 0, 0.45);
        color: #fff;
        font-size: var(--glass-text-small);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .live {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ff5a4e;
      }
      .expand {
        all: unset;
        position: absolute;
        top: 12px;
        right: 12px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.45);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .light {
        all: unset;
        position: absolute;
        right: 12px;
        bottom: 12px;
        height: 36px;
        padding: 0 12px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.9);
        color: #121316; /* sits on the camera image in both themes */
        font-size: var(--glass-text-small);
        display: flex;
        align-items: center;
        cursor: pointer;
      }
      .progress {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .lines {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .l1 {
        font-size: var(--glass-text-caption);
        color: var(--glass-text-muted);
      }
      .l2 {
        font-size: var(--glass-text-tile-title);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .readings {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .readings > span {
        box-sizing: border-box;
        height: 64px;
        padding: 10px 12px;
        border-radius: var(--glass-radius-inset);
        background: var(--glass-inset);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .k {
        font-size: var(--glass-text-small);
        color: var(--glass-text-muted);
      }
      .v {
        font-size: var(--glass-text-tile-title);
      }
      button:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
    `,
  ];
}

registerCard({
  type: 'glass-printer',
  name: 'Glass · 3D printer',
  description: 'Full card while printing (camera, progress, temperatures); a compact row otherwise.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-printer': GlassPrinter;
  }
}

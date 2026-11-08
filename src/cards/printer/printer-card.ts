import { css, html, nothing, type PropertyValues } from 'lit';
import '../../elements/glass-rows.js';
import '../../elements/glass-chip.js';
import '../../elements/glass-camera-controls.js';
import '../../elements/glass-meters.js';
import { cameraBadge } from '../../elements/glass-camera-controls.js';
import type { Tone } from '../../elements/glass-chip.js';
import { heading } from '../../elements/type.js';
import { nil } from '../../elements/nil.js';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { cardSurface } from '../../elements/surfaces.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, isUnavailable, openMoreInfo, registerCard } from '../../ha.js';
import { type PrinterEntities, type PrinterPhase, minutesOf, printerState } from '../../printer.js';
import { ago } from '../../time.js';
import { attentionStyles } from '../../motion.js';
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

    this.needs = undefined;
    if (!config.printer_status) return this.setUp(config, 'Choose the printer’s status sensor');
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
    if (this.needs) return true;
    if (!changed.has('hass') || changed.size > 1 || !this.config) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    const c = this.config;
    const ids = [c.printer_status, c.printer_progress, c.printer_remaining, c.printer_task, c.camera, c.chamber_light, c.nozzle_temp, c.bed_temp, c.ams_humidity];
    return !old || ids.some((id) => id && old.states[id] !== this.hass!.states[id]);
  }

  render() {
    if (this.needs) return this.renderSetup('printer');
    if (!this.config || !this.hass) return nothing;
    const status = this.config.printer_status;
    if (status && !this.hass.states[status]) return this.renderMissing(status);
    const p = printerState(this.hass, this.config);
    if (!p) return nothing;
    const title = `3D printer${this.config.name ? ` · ${this.config.name}` : ''}`;
    if (!p.showFull && !this.expanded) {
      // Bambu printers keep saying "finish" until the next print, so a print
      // that ended over two hours ago reads as idle, with when it ended.
      const sub = p.phase === 'failed' ? `Last print failed ${ago(p.status.last_changed)}` : `Idle · last print ${ago(p.status.last_changed)}`;
      return html`<glass-pill-row look="glass" button icon="printer" name=${title} line=${sub} label="Show 3D printer details" @click=${() => (this.expanded = true)}
        ><glass-icon name="chevron-right" size="18" stroke="1.8"></glass-icon
      ></glass-pill-row>`;
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
    const rem = hass.states[c.printer_remaining ?? ''];
    const ends = rem && p.left && p.phase === 'printing' ? new Date(Date.now() + minutesOf(rem) * 60_000) : undefined;
    const line1 =
      p.phase === 'printing'
        ? [p.left ? `${p.left} left` : '', ends ? `ends ${ends.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : '']
            .filter(Boolean)
            .join(' · ')
        : p.phase === 'paused'
          ? 'Paused'
          : `${p.phase === 'failed' ? 'Failed' : 'Finished'} ${ago(p.status.last_changed)}`;
    const reading = (id?: string, unit = '') => {
      const e = id ? hass.states[id] : undefined;
      return e && !isUnavailable(e) ? `${Math.round(Number(e.state))}${unit}` : nil;
    };

    return html`<section aria-labelledby="h">
      <span class="head">
        <h2 id="h">${title}</h2>
        <span class="right">
          <glass-pill class=${pill === PILL.done ? 'ringing' : ''} tone=${pill.tone as Tone}>${pill.text}</glass-pill>
          ${!p.showFull
            ? html`<button type="button" class="collapse" aria-label="Collapse printer card" @click=${() => (this.expanded = false)}>
                <glass-icon name="chevron-up" size="16" stroke="1.8"></glass-icon>
              </button>`
            : nothing}
        </span>
      </span>
      ${cam
        ? html`<div class="view">
            ${src && !isUnavailable(cam) ? html`<img src=${src} alt="" />` : nothing}
            <glass-live-badge class="badge" state=${cameraBadge(cam)}></glass-live-badge>
            <glass-camera-button class="expand" icon="maximize-2" label="Open live view" @click=${() => openMoreInfo(this, c.camera!)}></glass-camera-button>
            ${light && !isUnavailable(cam) ? html`<glass-camera-light class="light" look="picture" name=${this.narrow ? 'Light' : 'Chamber light'} .entity=${light} .hass=${hass}></glass-camera-light>` : nothing}
          </div>`
        : nothing}
      <div class="progress">
        <glass-ring
          .value=${p.phase === 'done' ? 100 : p.progress || undefined}
          tone=${p.phase === 'done' ? 'go' : p.phase === 'printing' ? 'info' : 'attention'}
        ></glass-ring>
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
      section {
        ${cardSurface}
        box-sizing: border-box;
        padding: var(--glass-space-edge);
        border-radius: var(--glass-radius-card);
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      h2 {
        ${heading}
      }
      .right {
        display: flex;
        align-items: center;
        gap: 8px;
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
        background: var(--glass-dark-surface);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .badge {
        position: absolute;
        top: 12px;
        left: 12px;
      }
      .expand {
        position: absolute;
        top: 12px;
        right: 12px;
      }
      .light {
        position: absolute;
        right: 12px;
        bottom: 12px;
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
        gap: 4px;
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
        padding: 12px 12px;
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
      /* Half width: the pill under the title, a shorter picture, the ring above its lines, the readings as a list. */
      :host([narrow]) .head {
        flex-direction: column;
        align-items: flex-start;
      }
      :host([narrow]) .view {
        height: 120px;
      }
      :host([narrow]) .progress {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }
      :host([narrow]) .readings {
        grid-template-columns: minmax(0, 1fr);
        gap: 0;
      }
      :host([narrow]) .readings > span {
        height: auto;
        padding: 8px 0;
        flex-direction: row;
        justify-content: space-between;
        align-items: baseline;
        background: none;
        border: 0;
        box-shadow: none;
        border-radius: 0;
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

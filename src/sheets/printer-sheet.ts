import { css, html, nothing, type CSSResultGroup, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { GlassEntitySheet, type Fact, type Tone } from './entity-sheet.js';
import { GlassCameraFull } from '../elements/glass-camera-full.js';
import { type HassEntity, isUnavailable } from '../ha.js';
import type { IconName } from '../icons.js';
import { type PrinterEntities, minutesOf, printerState } from '../printer.js';
import { clock, duration } from '../time.js';
import { haptic } from '../motion.js';

/** What the printer sheet is told; anything left out is found on the printer's device. */
export interface PrinterSheetEntities extends PrinterEntities {
  printer_name?: string;
  camera?: string;
  chamber_light?: string;
  nozzle_temp?: string;
  bed_temp?: string;
  ams_humidity?: string;
}

const PILL: Record<string, { text: string; tone: Tone }> = {
  printing: { text: 'Printing', tone: 'info' },
  paused: { text: 'Paused', tone: 'attention' },
  done: { text: 'Done', tone: 'success' },
  failed: { text: 'Failed', tone: 'attention' },
};

/**
 * The 3D printer pop-up (from the printer tile on Home): progress as the big
 * number, time left and when it'll be done, the job and layer, the chamber
 * camera and light, nozzle / bed / AMS, and the printer's own Pause, Resume
 * and Stop buttons. Entities not given are found on the printer's device by
 * the Bambu Lab integration's names (…_pause, …_current_layer and so on).
 */
@customElement('glass-printer-sheet')
export class GlassPrinterSheet extends GlassEntitySheet {
  @property({ attribute: false }) printer: PrinterSheetEntities = {};
  @state() private confirmStop = false;

  protected iconFor(): IconName {
    return 'printer';
  }

  protected iconBgFor(): string {
    return '#9CC3F2';
  }

  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (this.printer.printer_name) this.sheetTitle = this.printer.printer_name;
  }

  protected get sheetSubtitle(): string {
    const room = super.sheetSubtitle;
    return room ? `${room} · 3D printer` : '3D printer';
  }

  /** An entity on the printer's device whose id ends with `suffix` (and is in `domain`). */
  private onDevice(domain: string, suffix = ''): HassEntity | undefined {
    const device = this.hass?.entities?.[this.entityId]?.device_id;
    if (!device) return undefined;
    const id = Object.keys(this.hass!.states).find((s) => s.startsWith(`${domain}.`) && s.endsWith(suffix) && this.hass!.entities?.[s]?.device_id === device);
    return id ? this.hass!.states[id] : undefined;
  }

  private given(id?: string): HassEntity | undefined {
    return id ? this.hass?.states[id] : undefined;
  }

  private press(button?: HassEntity) {
    if (button) haptic('light');
    if (button) this.hass!.callService('button', 'press', { entity_id: button.entity_id });
  }

  protected renderBody() {
    const hass = this.hass!;
    const p = printerState(hass, { ...this.printer, printer_status: this.entityId });
    if (!p) return html``;
    const off = isUnavailable(p.status);
    const active = p.phase === 'printing' || p.phase === 'paused';
    const remain = this.given(this.printer.printer_remaining);
    const doneAt = remain && Number(remain.state) > 0 ? new Date(Date.now() + minutesOf(remain) * 60_000).toISOString() : undefined;
    const layer = Number(this.onDevice('sensor', '_current_layer')?.state);
    const layers = Number(this.onDevice('sensor', '_total_layer_count')?.state);
    const camera = this.given(this.printer.camera) ?? this.onDevice('camera');
    const light = this.given(this.printer.chamber_light) ?? this.onDevice('light');
    const lightOn = light?.state === 'on';
    const nozzle = this.given(this.printer.nozzle_temp) ?? this.onDevice('sensor', '_nozzle_temperature');
    const bed = this.given(this.printer.bed_temp) ?? this.onDevice('sensor', '_bed_temperature');
    const ams = this.given(this.printer.ams_humidity) ?? this.onDevice('sensor', '_humidity');
    const nozzleTarget = Number(this.onDevice('sensor', '_target_nozzle_temperature')?.state);
    const bedTarget = Number(this.onDevice('sensor', '_target_bed_temperature')?.state);
    const pause = this.onDevice('button', '_pause');
    const resume = this.onDevice('button', '_resume');
    const stop = this.onDevice('button', '_stop');

    const big = off ? undefined : active || p.phase === 'done' ? `${Math.round(p.phase === 'done' ? 100 : (p.progress ?? 0))}` : p.phase === 'failed' ? 'Failed' : 'Idle';
    const caption = off
      ? this.sinceLine('Offline')
      : p.phase === 'printing'
        ? [p.left ? `${p.left} left` : '', doneAt ? `done at ${clock(doneAt)}` : ''].filter(Boolean).join(' · ')
        : p.phase === 'paused'
          ? [`Paused at ${clock(p.status.last_changed)}`, p.left ? `${p.left} left` : ''].filter(Boolean).join(' · ')
          : p.phase === 'done'
            ? `Finished ${duration(p.status.last_changed)} ago`
            : `Last print ended ${clock(p.status.last_changed)}`;
    const pill = off ? { text: 'Offline', tone: 'neutral' as Tone } : PILL[p.phase];
    // "220°" once it's there; "205° → 220°" while it heats up.
    const temp = (e?: HassEntity, target = 0) => {
      if (!e || isUnavailable(e)) return '—';
      const now = Math.round(Number(e.state));
      return active && target > 0 && Math.abs(now - target) > 2 ? `${now}° → ${Math.round(target)}°` : `${now}°`;
    };
    const facts: Fact[] = [
      { label: 'Nozzle', value: temp(nozzle, nozzleTarget) },
      { label: 'Bed', value: temp(bed, bedTarget) },
      { label: 'AMS humidity', value: ams && !isUnavailable(ams) ? `${Math.round(Number(ams.state))}%` : '—' },
    ];
    const pct = p.phase === 'done' ? 100 : (p.progress ?? 0);

    return html`
      ${this.renderReading(big, big && !Number.isNaN(Number(big)) ? '%' : '', caption, pill)}
      ${active || p.phase === 'done'
        ? html`<div class="job">
            <span class="bar"><span class="fill ${p.phase}" style="width: ${pct}%"></span></span>
            <span class="meta"><span>${p.task}</span><span>${layers > 0 ? (p.phase === 'done' ? `${layers} layers` : `Layer ${layer || 0} of ${layers}`) : ''}</span></span>
          </div>`
        : nothing}
      ${camera
        ? html`<div class="cam ${off ? 'faded' : ''}">
            ${camera.attributes.entity_picture && !isUnavailable(camera)
              ? html`<img src=${camera.attributes.entity_picture} alt="" draggable="false" />`
              : html`<span class="none">Camera offline</span>`}
            ${light
              ? html`<button type="button" class="light ${lightOn ? 'on' : ''}" aria-pressed=${lightOn ? 'true' : 'false'} @click=${() => (haptic('light'), hass.callService('homeassistant', lightOn ? 'turn_off' : 'turn_on', { entity_id: light.entity_id }))}>
                  <glass-icon name="lightbulb" size="16" stroke="1.7"></glass-icon>Light · ${lightOn ? 'On' : 'Off'}
                </button>`
              : nothing}
            <button type="button" class="expand" aria-label="Full screen" @click=${() => GlassCameraFull.open(hass, [
                  {
                    entity: camera.entity_id,
                    name: `${this.sheetTitle} chamber`,
                    light: light?.entity_id,
                    caption: active ? [PILL[p.phase].text, `${Math.round(pct)}%`, layers > 0 ? `layer ${layer || 0} of ${layers}` : ''].filter(Boolean).join(' · ') : '',
                  },
                ])}>
              <glass-icon name="maximize-2" size="16" stroke="1.8"></glass-icon>
            </button>
          </div>`
        : nothing}
      ${this.renderFacts(facts)}
      ${active && !off && (pause || resume || stop)
        ? html`<div class="controls">
            ${p.phase === 'printing' && pause
              ? html`<button type="button" class="main" @click=${() => this.press(pause)}><glass-icon name="pause" size="16" stroke="2" solid></glass-icon>Pause</button>`
              : p.phase === 'paused' && resume
                ? html`<button type="button" class="main" @click=${() => this.press(resume)}><glass-icon name="play" size="16" stroke="2" solid></glass-icon>Resume</button>`
                : nothing}
            ${stop
              ? html`<button
                  type="button"
                  class="stop"
                  @click=${() => {
                    // A stopped print can't be resumed, so it asks once more.
                    if (!this.confirmStop) {
                      this.confirmStop = true;
                      return;
                    }
                    this.confirmStop = false;
                    this.press(stop);
                  }}
                >
                  ${this.confirmStop ? 'Tap again to stop' : 'Stop print'}
                </button>`
              : nothing}
          </div>`
        : nothing}
    `;
  }

  static styles: CSSResultGroup = [
    GlassEntitySheet.styles,
    css`
      .job {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: -6px;
      }
      .bar {
        position: relative;
        height: 8px;
        border-radius: 4px;
        background: rgba(var(--glass-line-rgb), 0.08);
      }
      .fill {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        border-radius: 4px;
        background: var(--glass-info);
      }
      .fill.paused {
        background: var(--glass-attention);
      }
      .fill.done {
        background: var(--glass-go);
      }
      .meta {
        display: flex;
        justify-content: space-between;
        font-size: var(--glass-text-small);
        color: var(--glass-text-muted);
      }
      .cam {
        position: relative;
        height: 196px;
        border-radius: var(--glass-radius-small-tile);
        overflow: hidden;
        background: linear-gradient(135deg, #2a2d33 0%, #4a4e57 100%);
        color: #fff;
      }
      .cam img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .cam .none {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--glass-text-caption);
        color: rgba(255, 255, 255, 0.6);
      }
      .cam button {
        all: unset;
        position: absolute;
        bottom: 12px;
        height: 36px;
        border-radius: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: var(--glass-text-caption);
        background: rgba(0, 0, 0, 0.45);
        color: #fff;
        cursor: pointer;
      }
      .cam .light {
        left: 12px;
        padding: 0 12px;
      }
      .cam .light.on {
        background: var(--glass-light-default);
        color: #121316;
      }
      .cam .expand {
        right: 12px;
        width: 36px;
      }
      .controls {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
        gap: 10px;
      }
      .controls button {
        all: unset;
        box-sizing: border-box;
        height: 56px;
        border-radius: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: var(--glass-text-body);
        cursor: pointer;
      }
      .controls .main {
        background: var(--glass-ink);
        color: var(--glass-on-ink);
      }
      .controls .stop {
        border: 1px solid var(--glass-attention-edge);
        background: var(--glass-attention-tint);
        color: var(--glass-attention-ink);
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-printer-sheet': GlassPrinterSheet;
  }
}

import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import {
  type HassEntity,
  type HomeAssistant,
  type LovelaceCardConfig,
  navigate,
  openMoreInfo,
  registerCard,
  reportVisibility,
} from '../../ha.js';
import { type Collection, binColour, collections, daysUntil } from '../../bins.js';
import './around-editor.js';

export interface AroundConfig extends LovelaceCardConfig {
  /** Bin sensors, e.g. from Waste Collection Schedule. */
  bins?: string[];
  /** The printer's status sensor (running, pause, finish, idle…), e.g. sensor.p1s_print_status. */
  printer_status?: string;
  printer_progress?: string;
  printer_remaining?: string;
  printer_task?: string;
  /** Shown as "3D printer · <name>". */
  printer_name?: string;
  /** A view to open from the printer tile, e.g. the Office. */
  printer_path?: string;
}

const PRINTING = new Set(['running', 'printing', 'pause', 'paused', 'prepare', 'slicing', 'init', 'heating']);
const FINISHED = new Set(['finish', 'finished', 'completed', 'complete', 'failed', 'error']);
const AFTER_PRINT_MS = 2 * 60 * 60 * 1000;
const BINS_DAYS_AHEAD = 2;
const BINS_UNTIL_HOUR = 12;

interface Tile {
  key: string;
  render: () => unknown;
}

/**
 * Things that only matter for a while: bins from two days before collection
 * until collection morning, and the 3D printer while printing and for two
 * hours after. Two tiles share the row, one spans it, none hides the card.
 */
@customElement('glass-around')
export class GlassAround extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: AroundConfig;
  @state() private now = new Date();
  private timer?: number;

  static getConfigElement() {
    return document.createElement('glass-around-editor');
  }

  static getStubConfig(hass: HomeAssistant): Partial<AroundConfig> {
    const find = (re: RegExp) => Object.keys(hass.states).find((id) => re.test(id));
    return {
      bins: Object.keys(hass.states).filter((id) => /^sensor\..*(bin|waste|collection)/.test(id)).slice(0, 4),
      printer_status: find(/^sensor\..*print_status$/),
      printer_progress: find(/^sensor\..*print_progress$/),
      printer_remaining: find(/^sensor\..*remaining_time$/),
      printer_task: find(/^sensor\..*task_name$/),
    };
  }

  setConfig(config: AroundConfig): void {
    this.config = config;
  }

  getCardSize(): number {
    return this.tiles().length ? 3 : 0;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    ensureFonts();
    // Tiles appear and go with the clock (collection morning, 2h after a print).
    this.timer = window.setInterval(() => (this.now = new Date()), 60_000);
  }

  disconnectedCallback(): void {
    window.clearInterval(this.timer);
    super.disconnectedCallback();
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has('hass') || changed.size > 1 || !this.config) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    return !old || this.watched().some((id) => old.states[id] !== this.hass!.states[id]);
  }

  protected updated(): void {
    reportVisibility(this, this.tiles().length > 0);
  }

  private watched(): string[] {
    const c = this.config!;
    return [...(c.bins ?? []), c.printer_status, c.printer_progress, c.printer_remaining, c.printer_task].filter(
      (id): id is string => !!id,
    );
  }

  private tiles(): Tile[] {
    if (!this.config || !this.hass) return [];
    const tiles: Tile[] = [];
    const bins = this.binsDue();
    if (bins) tiles.push({ key: 'bins', render: () => this.renderBins(bins.next, bins.later) });
    const printer = this.printer();
    if (printer) tiles.push({ key: 'printer', render: () => this.renderPrinter(printer) });
    return tiles;
  }

  render() {
    const tiles = this.tiles();
    if (!tiles.length) return nothing;
    return html`<section class=${tiles.length === 1 ? 'one' : ''} aria-label="Around the house">
      ${tiles.map((t) => t.render())}
    </section>`;
  }

  private binsDue(): { next: Collection; later?: Collection } | undefined {
    const ids = this.config!.bins ?? [];
    if (!ids.length) return undefined;
    const list = collections(ids.map((id) => this.hass!.states[id]).filter(Boolean), this.now);
    const next = list[0];
    if (!next) return undefined;
    const days = daysUntil(next.date, this.now);
    if (days > BINS_DAYS_AHEAD || (days === 0 && this.now.getHours() >= BINS_UNTIL_HOUR)) return undefined;
    const later = list.find((c) => c !== next && c.bins.some((b) => !next.bins.includes(b)));
    return { next, later };
  }

  private renderBins(next: Collection, later?: Collection) {
    const days = daysUntil(next.date, this.now);
    const when = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`;
    const weekday = next.date.toLocaleDateString(undefined, { weekday: 'long' });
    const laterBins = later?.bins.filter((b) => !next.bins.includes(b));
    const laterText = later
      ? ` · ${listText(laterBins!).toLowerCase()} ${later.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
      : '';
    return html`<div class="tile">
      <span class="head">
        <span class="label">Bins · ${weekday}</span>
        <span class="dots" aria-hidden="true">
          ${next.bins.map((b) => html`<span class="bin" style="background: ${binColour(b)}"></span>`)}
        </span>
      </span>
      <span class="body">
        <span class="big">${when}</span>
        <span class="small">${sentence(listText(next.bins))}${laterText}</span>
      </span>
    </div>`;
  }

  private printer(): { status: HassEntity; active: boolean } | undefined {
    const status = this.hass!.states[this.config!.printer_status ?? ''];
    if (!status) return undefined;
    const s = status.state.toLowerCase();
    if (PRINTING.has(s)) return { status, active: true };
    if (FINISHED.has(s) && this.now.getTime() - Date.parse(status.last_changed) < AFTER_PRINT_MS) {
      return { status, active: false };
    }
    return undefined;
  }

  private renderPrinter({ status, active }: { status: HassEntity; active: boolean }) {
    const c = this.config!;
    const s = status.state.toLowerCase();
    const failed = s === 'failed' || s === 'error';
    const paused = s === 'pause' || s === 'paused';
    const progress = Number(this.hass!.states[c.printer_progress ?? '']?.state);
    const task = this.hass!.states[c.printer_task ?? '']?.state;
    const taskText = task && task !== 'unknown' && task !== 'unavailable' ? task : '';
    const left = remaining(this.hass!.states[c.printer_remaining ?? '']);

    const big = active ? (Number.isFinite(progress) ? `${Math.round(progress)}%` : 'Printing') : failed ? 'Failed' : 'Done';
    const small = active
      ? [paused ? 'Paused' : left ? `${left} left` : '', taskText].filter(Boolean).join(' · ')
      : taskText;
    const dot = active ? 'var(--glass-info)' : failed ? 'var(--glass-attention)' : 'var(--glass-go)';

    return html`<button
      type="button"
      class="tile"
      @click=${() => (c.printer_path ? navigate(c.printer_path) : openMoreInfo(this, status.entity_id))}
    >
      <span class="head">
        <span class="label">3D printer${c.printer_name ? ` · ${c.printer_name}` : ''}</span>
        <span class="dot" style="background: ${dot}"></span>
      </span>
      <span class="body">
        <span class="big">${big}</span>
        <span class="small">${small}</span>
      </span>
    </button>`;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      :host([hidden]) {
        display: none;
      }
      section {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--glass-space-tile-gap);
      }
      section.one .tile {
        grid-column: span 2;
      }
      .tile {
        all: unset;
        box-sizing: border-box;
        height: 132px;
        padding: var(--glass-space-tile);
        border-radius: var(--glass-radius-tile);
        background: var(--glass-surface);
        border: 1px solid var(--glass-surface-border);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-width: 0;
      }
      button.tile {
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      button.tile:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      .head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .label {
        font-size: var(--glass-text-caption);
        color: var(--glass-text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dots {
        display: flex;
        gap: 4px;
      }
      .bin {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
      .dot {
        width: 8px;
        height: 8px;
        flex: none;
        border-radius: 50%;
      }
      .body {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .big {
        font-size: 32px;
        font-weight: 300;
      }
      .small {
        font-size: var(--glass-text-small);
        color: var(--glass-text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ];
}

/** "1h 12m" from a remaining-time sensor in minutes, hours or seconds. */
function remaining(e?: HassEntity): string {
  const n = Number(e?.state);
  if (!e || !Number.isFinite(n) || n <= 0) return '';
  const unit = String(e.attributes.unit_of_measurement ?? 'min').toLowerCase();
  const mins = Math.round(unit.startsWith('h') ? n * 60 : unit.startsWith('s') ? n / 60 : n);
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
}

/** ["Green", "Red", "Grey"] → "Green, Red & Grey". */
function listText(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} & ${items[items.length - 1]}`;
}

/** "Green, Red & Grey" → "Green, red & grey". */
function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

registerCard({
  type: 'glass-around',
  name: 'Glass · Around the house',
  description: 'Bins before collection day and the 3D printer while it prints; hidden otherwise.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-around': GlassAround;
  }
}

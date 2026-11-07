import { LitElement, css, html, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/** A stretch of the chart's time, as fractions 0–1 of its width. */
export interface ChartBand {
  from: number;
  to: number;
  colour: string;
  opacity: number;
}

/** One entry in the chart's key: a solid or dashed line, or a box, in its colour. */
export interface ChartKey {
  label: string;
  look: 'line' | 'dashed' | 'box';
  colour: string;
  opacity?: number;
}

/**
 * The History chart (Library: History chart). Its shape follows the sensor:
 * - `line`: a measurement over time (temperature, battery), with an optional
 *   dashed `target` and tinted `runs` for when something was running
 * - `bars`: energy used per hour or per day, in `fill`, with optional `ticks`
 *   (yesterday's values) across each bar
 * - `timeline`: on/off or where-someone-was, as coloured bands
 *
 * Fixed height (120, 76 for a timeline): it's drawn at its own width and only
 * gets wider, its labels Small 11 at every width. Times along the bottom are
 * `xLabels`: left, middle, and the end ("Now", or "24:00" for bars that run
 * on to midnight). `loading`: a soft placeholder where the plot goes. No
 * values: no line, "No data" in the middle. `gapFrom` (0–1): a sensor that's
 * gone quiet; the line or timeline stops there, with "No data" after.
 * `key`: drawn under the plot.
 */
@customElement('glass-history-chart')
export class GlassHistoryChart extends LitElement {
  @property() kind: 'line' | 'bars' | 'timeline' = 'line';
  @property({ attribute: false }) values: number[] = [];
  @property({ attribute: false }) target?: number[];
  @property({ attribute: false }) runs: { from: number; to: number }[] = [];
  @property({ attribute: false }) bands: ChartBand[] = [];
  /** Bars from this index on are still to come (drawn faint). */
  @property({ type: Number }) fadedFrom = Infinity;
  @property({ type: Number }) gapFrom = Infinity;
  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 1;
  @property() hiLabel = '';
  @property() loLabel = '';
  @property({ attribute: false }) xLabels: string[] = ['', ''];
  @property() label = '';
  @property({ type: Boolean }) loading = false;
  /** The bars' colour (default the text colour at 85%). */
  @property() fill = '';
  /** Yesterday's value for each bar, drawn as a tick across it. */
  @property({ attribute: false }) ticks?: number[];
  @property({ attribute: false }) key: ChartKey[] = [];
  @state() private w = 310;

  private size = new ResizeObserver(([e]) => {
    const w = Math.round(e.contentRect.width);
    if (w > 0 && w !== this.w) this.w = w;
  });

  connectedCallback(): void {
    super.connectedCallback();
    this.size.observe(this);
  }

  disconnectedCallback(): void {
    this.size.disconnect();
    super.disconnectedCallback();
  }

  render() {
    const W = this.w;
    const timeline = this.kind === 'timeline';
    const h = timeline ? 76 : 120;
    const base = timeline ? 0 : 96; // bottom of the plot
    const top = 10;
    const labelY = h - 2;
    const end = this.xLabels[2] ?? (this.kind === 'bars' && this.fadedFrom < this.values.length ? '24:00' : 'Now');
    const empty = !this.loading && (timeline ? false : this.values.length < 2 && !(this.kind === 'bars' && this.values.length));
    return html`<svg width=${W} height=${h} viewBox="0 0 ${W} ${h}" role="img" aria-label=${this.loading ? `${this.label}, loading` : empty ? `${this.label}: no data` : this.label}>
        ${this.loading
          ? timeline
            ? svg`<rect x="0" y="8" width=${W} height="36" rx="10" class="skel"></rect>`
            : svg`<rect x="0" y=${top} width=${W} height=${base - top} rx="12" class="skel"></rect>`
          : timeline
            ? this.renderTimeline(W)
            : svg`
            ${this.runs.map((r) => svg`<rect x=${(r.from * W).toFixed(1)} y="0" width=${Math.max(4, (r.to - r.from) * W).toFixed(1)} height=${base} rx="6" style="fill: var(--glass-attention)" fill-opacity="0.12"></rect>`)}
            <line x1="0" x2=${W} y1=${top} y2=${top} stroke="currentColor" stroke-opacity="0.07"></line>
            <line x1="0" x2=${W} y1=${base} y2=${base} stroke="currentColor" stroke-opacity="0.07"></line>
            ${empty
              ? svg`<text x=${W / 2} y="56" text-anchor="middle" class="axis">No data</text>`
              : this.kind === 'bars'
                ? this.renderBars(W, base, top)
                : this.renderLine(W, base, top)}
            ${this.hiLabel && !empty ? svg`<text x="0" y=${top - 2} class="axis">${this.hiLabel}</text>` : nothing}
            ${this.loLabel && !empty ? svg`<text x="0" y=${base - 4} class="axis">${this.loLabel}</text>` : nothing}`}
        <text x="0" y=${labelY} class="axis">${this.xLabels[0]}</text>
        <text x=${W / 2} y=${labelY} text-anchor="middle" class="axis">${this.xLabels[1]}</text>
        <text x=${W} y=${labelY} text-anchor="end" class="axis">${end}</text>
      </svg>
      ${this.key.length && !this.loading
        ? html`<div class="key">
            ${this.key.map(
              (k) => html`<span
                ><i class=${k.look} style="${k.look === 'box' ? 'background' : 'border-color'}: ${k.colour}; opacity: ${k.opacity ?? 1}"></i>${k.label}</span
              >`,
            )}
          </div>`
        : nothing}`;
  }

  private renderTimeline(W: number) {
    const stop = this.gapFrom < 1 ? Math.max(0, this.gapFrom) : 1;
    return svg`<rect x="0" y="8" width=${(stop * W).toFixed(1)} height="36" rx="10" fill="currentColor" fill-opacity="0.06"></rect>
      ${this.bands
        .filter((b) => b.from < stop)
        .map((b) => svg`<rect x=${(b.from * W).toFixed(1)} y="8" width=${Math.max(3, (Math.min(b.to, stop) - b.from) * W).toFixed(1)} height="36" rx="4" style=${`fill: ${b.colour}`} fill-opacity=${b.opacity}></rect>`)}
      ${stop < 1 ? svg`<text x=${(((stop + 1) / 2) * W).toFixed(1)} y="30" text-anchor="middle" class="axis">No data</text>` : nothing}`;
  }

  private renderLine(W: number, base: number, top: number) {
    const n = this.values.length;
    const y = (v: number) => base - ((v - this.min) / (this.max - this.min || 1)) * (base - top);
    const x = (i: number, k: number) => (k <= 1 ? 0 : (i / (k - 1)) * W);
    const gap = this.gapFrom < 1 ? Math.max(1, Math.floor(this.gapFrom * (n - 1))) : n - 1;
    const shown = this.values.slice(0, gap + 1);
    const endX = x(gap, n);
    const pts = shown.map((v, i) => `${x(i, n).toFixed(1)} ${y(v).toFixed(1)}`);
    const t = this.target;
    // The target is a step line: it holds each value until the next.
    const steps = t && t.length > 1 ? t.map((v, i) => (i ? `L${x(i, t.length).toFixed(1)} ${y(t[i - 1]).toFixed(1)} L` : 'M') + `${x(i, t.length).toFixed(1)} ${y(v).toFixed(1)}`).join(' ') : '';
    return svg`
      <path d="M0 ${base} L${pts.join(' L')} L${endX.toFixed(1)} ${base} Z" fill="currentColor" fill-opacity=${t ? 0 : 0.05}></path>
      ${steps ? svg`<path d=${steps} fill="none" style="stroke: var(--glass-attention)" stroke-width="1.6" stroke-dasharray="4 4" stroke-linejoin="round"></path>` : nothing}
      <path d="M${pts.join(' L')}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
      <circle cx=${endX.toFixed(1)} cy=${y(shown[shown.length - 1]).toFixed(1)} r="4" fill="currentColor"></circle>
      ${gap < n - 1 ? svg`<text x=${((endX + W) / 2).toFixed(1)} y="56" text-anchor="middle" class="axis">No data</text>` : nothing}`;
  }

  private renderBars(W: number, base: number, top: number) {
    const n = this.values.length;
    const y = (v: number) => base - (v / (this.max || 1)) * (base - top);
    const gap = n > 12 ? 3 : 10;
    const w = (W - gap * (n - 1)) / n;
    const fill = this.fill || 'currentColor';
    return svg`${this.values.map((v, i) => {
      const t = Math.min(base - 2, y(v));
      const faded = i >= this.fadedFrom;
      return svg`<rect x=${(i * (w + gap)).toFixed(1)} y=${t.toFixed(1)} width=${w.toFixed(1)} height=${(base - t).toFixed(1)} rx="2"
        style=${`fill: ${faded ? 'currentColor' : fill}`} fill-opacity=${faded ? 0.12 : this.fill ? 1 : 0.85}></rect>`;
    })}
    ${(this.ticks ?? []).map((v, i) => svg`<rect x=${(i * (w + gap) - 1).toFixed(1)} y=${(y(v) - 1).toFixed(1)} width=${(w + 2).toFixed(1)} height="2" rx="1" fill="currentColor" fill-opacity="0.45"></rect>`)}`;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
    }
    svg {
      display: block;
      overflow: visible;
    }
    .axis {
      font-family: var(--glass-font);
      font-size: var(--glass-text-tiny);
      fill: currentColor;
      fill-opacity: 0.55;
    }
    .skel {
      fill: rgba(var(--glass-line-rgb), 0.08);
    }
    .key {
      display: flex;
      flex-wrap: wrap;
      column-gap: 16px;
      row-gap: 4px;
      font-family: var(--glass-font);
      font-size: var(--glass-text-small);
      color: var(--glass-text-muted);
    }
    .key span {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .key i {
      display: block;
      flex: none;
      width: 12px;
    }
    .key i.box {
      height: 12px;
      border-radius: 4px;
    }
    .key i.line,
    .key i.dashed {
      height: 0;
      border-top: 2px solid;
    }
    .key i.dashed {
      border-top-style: dashed;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-history-chart': GlassHistoryChart;
  }
}

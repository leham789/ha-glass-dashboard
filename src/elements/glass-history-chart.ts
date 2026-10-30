import { LitElement, css, html, nothing, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/** A stretch of the chart's time, as fractions 0–1 of its width. */
export interface ChartBand {
  from: number;
  to: number;
  colour: string;
  opacity: number;
}

const W = 310;

/**
 * The History chart from the design system. Its shape follows the sensor:
 * - `line`: a measurement over time (temperature, battery), with an optional
 *   dashed `target` and tinted `runs` for when something was running
 * - `bars`: energy used per hour or per day
 * - `timeline`: on/off or where-someone-was, as coloured bands
 * Times along the bottom are `xLabels` (left, middle) then "Now".
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
  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 1;
  @property() hiLabel = '';
  @property() loLabel = '';
  @property({ attribute: false }) xLabels: [string, string] = ['', ''];
  @property() label = '';

  render() {
    const timeline = this.kind === 'timeline';
    const h = timeline ? 76 : 120;
    const base = timeline ? 0 : 96; // bottom of the plot
    const top = 10;
    const y = (v: number) => base - ((v - this.min) / (this.max - this.min || 1)) * (base - top);
    const x = (i: number, n: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
    const n = this.values.length;
    const labelY = h - 2;
    return html`<svg viewBox="0 0 ${W} ${h}" role="img" aria-label=${this.label}>
      ${timeline
        ? svg`<rect x="0" y="8" width=${W} height="36" rx="10" fill="currentColor" fill-opacity="0.06"></rect>
            ${this.bands.map((b) => svg`<rect x=${(b.from * W).toFixed(1)} y="8" width=${Math.max(3, (b.to - b.from) * W).toFixed(1)} height="36" rx="4" fill=${b.colour} fill-opacity=${b.opacity}></rect>`)}`
        : svg`
            ${this.runs.map((r) => svg`<rect x=${(r.from * W).toFixed(1)} y="0" width=${Math.max(4, (r.to - r.from) * W).toFixed(1)} height=${base} rx="6" fill="#E0683A" fill-opacity="0.12"></rect>`)}
            <line x1="0" x2=${W} y1=${top} y2=${top} stroke="currentColor" stroke-opacity="0.07"></line>
            <line x1="0" x2=${W} y1=${base} y2=${base} stroke="currentColor" stroke-opacity="0.07"></line>
            ${this.kind === 'bars' ? this.renderBars(y, base) : this.renderLine(y, x, n, base)}
            ${this.hiLabel ? svg`<text x="0" y=${top - 2} class="axis">${this.hiLabel}</text>` : nothing}
            ${this.loLabel ? svg`<text x="0" y=${base - 4} class="axis">${this.loLabel}</text>` : nothing}`}
      <text x="0" y=${labelY} class="axis">${this.xLabels[0]}</text>
      <text x=${W / 2} y=${labelY} text-anchor="middle" class="axis">${this.xLabels[1]}</text>
      <text x=${W} y=${labelY} text-anchor="end" class="axis">Now</text>
    </svg>`;
  }

  private renderLine(y: (v: number) => number, x: (i: number, n: number) => number, n: number, base: number) {
    if (n < 2) return nothing;
    const pts = this.values.map((v, i) => `${x(i, n).toFixed(1)} ${y(v).toFixed(1)}`);
    const t = this.target;
    // The target is a step line: it holds each value until the next.
    const steps = t && t.length > 1 ? t.map((v, i) => (i ? `L${x(i, t.length).toFixed(1)} ${y(t[i - 1]).toFixed(1)} L` : 'M') + `${x(i, t.length).toFixed(1)} ${y(v).toFixed(1)}`).join(' ') : '';
    return svg`
      <path d="M0 ${base} L${pts.join(' L')} L${W} ${base} Z" fill="currentColor" fill-opacity=${t ? 0 : 0.05}></path>
      ${steps ? svg`<path d=${steps} fill="none" stroke="#E0683A" stroke-width="1.6" stroke-dasharray="4 4" stroke-linejoin="round"></path>` : nothing}
      <path d="M${pts.join(' L')}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
      <circle cx=${W} cy=${y(this.values[n - 1]).toFixed(1)} r="4" fill="currentColor"></circle>`;
  }

  private renderBars(y: (v: number) => number, base: number) {
    const n = this.values.length;
    if (!n) return nothing;
    const gap = n > 12 ? 3 : 10;
    const w = (W - gap * (n - 1)) / n;
    return this.values.map((v, i) => {
      const top = Math.min(base - 2, y(v));
      return svg`<rect x=${(i * (w + gap)).toFixed(1)} y=${top.toFixed(1)} width=${w.toFixed(1)} height=${(base - top).toFixed(1)} rx="2" fill="currentColor" fill-opacity=${i >= this.fadedFrom ? 0.12 : 0.85}></rect>`;
    });
  }

  static styles = css`
    :host {
      display: block;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
    }
    .axis {
      font-family: inherit;
      font-size: 11px;
      fill: currentColor;
      fill-opacity: 0.55;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-history-chart': GlassHistoryChart;
  }
}

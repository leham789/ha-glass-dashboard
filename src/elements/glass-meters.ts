import { LitElement, css, html, nothing, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * Meters (Library: Numbers and meters): the small things beside a number.
 * Progress is info while it runs, attention when paused or failed, go when
 * done. Nested parts don't carry the tokens: every --glass- value comes down
 * from the card they sit in.
 */

export type ProgressTone = 'info' | 'attention' | 'go';

const TONE: Record<ProgressTone, string> = {
  info: 'var(--glass-info)',
  attention: 'var(--glass-attention)',
  go: 'var(--glass-go)',
};

const nilStyle = css`
  .nil {
    display: inline-block;
    width: 0.5em;
    height: max(2px, 0.05em);
    border-radius: 1px;
    background: var(--glass-text-muted);
    vertical-align: 0.33em;
  }
`;

/**
 * Ring: a print's progress on its card. 76 across, an 8 stroke with round
 * ends from the top, the percent inside. No `value` yet: an empty ring with
 * the grey dash, never 0%.
 */
@customElement('glass-ring')
export class GlassRing extends LitElement {
  @property({ type: Number }) value?: number;
  @property() tone: ProgressTone = 'info';
  @property() label = '';

  render() {
    const c = 2 * Math.PI * 32;
    const pct = this.value === undefined ? 0 : Math.max(0, Math.min(100, Math.round(this.value)));
    return html`<svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label=${this.label || (this.value === undefined ? 'No progress yet' : `${pct}% complete`)}>
        <circle cx="38" cy="38" r="32" class="track" stroke-width="8" fill="none"></circle>
        ${pct > 0
          ? svg`<circle cx="38" cy="38" r="32" style=${`stroke: ${TONE[this.tone]}`} stroke-width="8" fill="none" stroke-linecap="round"
              stroke-dasharray="${(pct / 100) * c} ${c}" transform="rotate(-90 38 38)"></circle>`
          : nothing}
      </svg>
      <span class="in">${this.value === undefined ? html`<i class="nil"></i>` : `${pct}%`}</span>`;
  }

  static styles = [
    nilStyle,
    css`
      :host {
        position: relative;
        display: inline-block;
        flex: none;
        width: 76px;
        height: 76px;
        color: var(--glass-ink);
      }
      svg {
        display: block;
      }
      .track {
        stroke: rgba(var(--glass-line-rgb), 0.08);
      }
      .in {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--glass-font);
        font-size: 16px;
      }
    `,
  ];
}

/**
 * Bar: the print bar (8 high, radius 4, its tone on the line colour at 8%) or
 * `thin` (3 high, radius 2, ink on the line colour at 12%: a track's position,
 * the Cameras pop-up's time to the next camera). `value` 0–100.
 */
@customElement('glass-bar')
export class GlassBar extends LitElement {
  @property({ type: Number }) value = 0;
  @property() tone: ProgressTone = 'info';
  @property({ type: Boolean, reflect: true }) thin = false;
  /** Fill from `value` to the end over this many ms (the Cameras pop-up's time to the next camera). */
  @property({ type: Number }) run?: number;

  render() {
    const pct = Math.max(0, Math.min(100, this.value));
    const run = this.run ? `animation: run ${this.run}ms linear forwards;` : '';
    return html`<span class="fill" style="width: ${pct}%; ${this.thin ? '' : `background: ${TONE[this.tone]};`} ${run}"></span>`;
  }

  static styles = css`
    :host {
      position: relative;
      display: block;
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
      background: rgba(var(--glass-line-rgb), 0.08);
    }
    :host([thin]) {
      height: 3px;
      border-radius: 2px;
      background: rgba(var(--glass-line-rgb), 0.12);
    }
    .fill {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      border-radius: inherit;
      background: var(--glass-ink);
    }
    @keyframes run {
      to {
        width: 100%;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .fill {
        animation: none !important;
      }
    }
  `;
}

/**
 * Scale: a coloured strip with a 2-wide ink marker. `kind` temperature (8
 * high, a 16 marker, 12° to 26° with a flat comfort band) or humidity (6
 * high, a 14 marker, 0–100%: sandy Dry, green Comfy, blue Damp). Readings off
 * either end pin the marker there. `quiet` fades it to 35%.
 */
@customElement('glass-scale')
export class GlassScale extends LitElement {
  @property({ reflect: true }) kind: 'temperature' | 'humidity' = 'temperature';
  @property({ type: Number }) value = 0;
  @property({ type: Number }) min?: number;
  @property({ type: Number }) max?: number;
  @property({ type: Boolean, reflect: true }) quiet = false;

  render() {
    const [lo, hi] = this.kind === 'temperature' ? [this.min ?? 12, this.max ?? 26] : [this.min ?? 0, this.max ?? 100];
    const pos = Math.min(100, Math.max(0, ((this.value - lo) / (hi - lo)) * 100));
    return html`<span class="marker" style="left: ${pos}%"></span>`;
  }

  static styles = css`
    :host {
      position: relative;
      display: block;
      height: 8px;
      border-radius: 4px;
      background: var(--glass-temp-scale);
    }
    :host([kind='humidity']) {
      height: 6px;
      border-radius: 3px;
      background: var(--glass-humidity-scale);
    }
    :host([quiet]) {
      opacity: 0.35;
    }
    .marker {
      position: absolute;
      top: -4px;
      width: 2px;
      height: 16px;
      margin-left: -1px;
      border-radius: 1px;
      background: var(--glass-ink);
    }
    :host([kind='humidity']) .marker {
      height: 14px;
    }
  `;
}

/**
 * Lights dots: one 8 dot per light, ink when on, faint when off (an offline
 * light counts as off), then a dashed rule to the edge. `lights`: on or off, in order.
 */
@customElement('glass-light-dots')
export class GlassLightDots extends LitElement {
  @property({ attribute: false }) lights: boolean[] = [];

  render() {
    return html`${this.lights.map((on) => html`<span class="d ${on ? 'on' : ''}"></span>`)}<span class="rule"></span>`;
  }

  static styles = css`
    :host {
      display: flex;
      gap: 8px;
      align-items: center;
      min-height: 8px;
    }
    .d {
      width: 8px;
      height: 8px;
      flex: none;
      border-radius: 50%;
      background: rgba(var(--glass-line-rgb), 0.15);
    }
    .d.on {
      background: var(--glass-ink);
    }
    .rule {
      flex: 1;
      border-top: 1px dashed rgba(var(--glass-line-rgb), 0.18);
      margin-left: 4px;
    }
  `;
}

/**
 * Dot chart: energy by the hour, on a coloured card (which keeps its colours
 * in dark mode, so the dots do too). A column per hour, filled to that hour's
 * share of the busiest hour; hours after `now` (an index) stay faint, and so
 * does everything while `loading`. `levels` dots per column, `dot` across,
 * 4 apart. Columns spread across the width, or sit `gap` apart from the left.
 */
@customElement('glass-dot-chart')
export class GlassDotChart extends LitElement {
  @property({ attribute: false }) values: number[] = [];
  @property({ type: Number }) levels = 10;
  @property({ type: Number }) dot = 6;
  @property({ type: Number }) gap?: number;
  @property({ type: Number }) now?: number;
  @property({ type: Boolean }) loading = false;

  render() {
    const max = Math.max(...this.values, 0.001);
    const style = `--dot: ${this.dot}px; height: ${this.levels * this.dot + (this.levels - 1) * 4}px; ${this.gap !== undefined ? `justify-content: flex-start; gap: ${this.gap}px;` : ''}`;
    return html`<span class="chart" style=${style}>
      ${this.values.map((v, h) => {
        const lv = this.loading || (this.now !== undefined && h > this.now) ? 0 : Math.round((v / max) * this.levels);
        return html`<span class="col">${Array.from({ length: this.levels }, (_, k) => html`<span class="d ${k < lv ? 'on' : ''}"></span>`)}</span>`;
      })}
    </span>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    .chart {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .col {
      display: flex;
      flex-direction: column-reverse;
      gap: 4px;
    }
    .d {
      width: var(--dot);
      height: var(--dot);
      border-radius: 50%;
      background: var(--glass-chart-dot-empty);
    }
    .d.on {
      background: var(--glass-chart-dot);
    }
  `;
}

/**
 * Status note: one line in Caption 13, grey, after a 7 dot whose colour is the
 * severity: grey for something resting or dropped out, attention while working.
 */
@customElement('glass-status-note')
export class GlassStatusNote extends LitElement {
  @property({ reflect: true }) tone: 'grey' | 'attention' | 'go' | 'info' = 'grey';

  render() {
    return html`<i></i><slot></slot>`;
  }

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: var(--glass-font);
      font-size: var(--glass-text-caption);
      color: var(--glass-text-muted);
    }
    i {
      width: 7px;
      height: 7px;
      flex: none;
      border-radius: 50%;
      background: var(--glass-grey);
    }
    :host([tone='attention']) i {
      background: var(--glass-attention);
    }
    :host([tone='go']) i {
      background: var(--glass-go);
    }
    :host([tone='info']) i {
      background: var(--glass-info);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-ring': GlassRing;
    'glass-bar': GlassBar;
    'glass-scale': GlassScale;
    'glass-light-dots': GlassLightDots;
    'glass-dot-chart': GlassDotChart;
    'glass-status-note': GlassStatusNote;
  }
}

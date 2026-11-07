import { css, html, nothing, type CSSResultGroup, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../elements/glass-button.js';
import type { GlassSegmented } from '../elements/glass-button.js';
import '../elements/glass-history-chart.js';
import type { ChartKey } from '../elements/glass-history-chart.js';
import '../elements/glass-popup-summary.js';
import '../elements/glass-rows.js';
import { cardSurface } from '../elements/surfaces.js';
import { GlassSheet } from '../elements/glass-sheet.js';
import { comparison, formatValue } from '../format.js';
import { isUnavailable } from '../ha.js';
import { type DailyUsage, dailyUsage, usageByDay } from '../history.js';
import type { IconName } from '../icons.js';

type Period = 'Today' | 'Week';

/**
 * The Energy pop-up (Designs: Energy pop-up), from the Energy today card in
 * place of HA's own. Today's cost (or use) as the summary with the use and how
 * it compares with yesterday; Today and Week; the History chart's bars in the
 * fuel's colour (today hour by hour with yesterday's hours as ticks, or the
 * last 7 days); then grouped rows of facts.
 */
@customElement('glass-energy-sheet')
export class GlassEnergySheet extends GlassSheet {
  /** The energy sensor that counts up (kWh today, or a meter total). */
  @property() energy = '';
  /** Today's cost sensor (optional). */
  @property() cost = '';
  @property() fuel: 'electricity' | 'gas' = 'electricity';
  /** Today's use, if the card has it already. */
  @property({ attribute: false }) usage?: DailyUsage;
  @state() private period: Period = 'Today';
  @state() private week?: number[];
  @state() private failed = false;
  private loading = false;

  protected sheetTitle = 'Electricity';
  protected sheetIcon: IconName = 'zap';

  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const gas = this.fuel === 'gas';
    this.sheetTitle = gas ? 'Gas' : 'Electricity';
    this.sheetIcon = gas ? 'flame' : 'zap';
    this.sheetIconBg = gas ? 'var(--glass-peach)' : 'var(--glass-accent)';
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!this.hass || !this.energy || this.loading || (this.usage && this.week)) return;
    this.loading = true;
    Promise.all([this.usage ?? dailyUsage(this.hass, this.energy), usageByDay(this.hass, this.energy, 7)])
      .then(([u, w]) => {
        this.usage = u;
        this.week = w;
      })
      .catch(() => (this.failed = true));
  }

  protected renderBody() {
    const hass = this.hass!;
    const u = this.usage;
    const c = this.cost ? hass.states[this.cost] : undefined;
    const cost = c && !isUnavailable(c) ? formatValue(c).value : '';
    const waiting = !u && !this.failed;
    const big = cost || (u ? `${u.today.toFixed(1)}` : '');
    const unit = cost ? 'today' : u ? 'kWh today' : '';
    const compare = u && u.yesterdaySoFar > 0 ? comparison(u.today, u.yesterdaySoFar) : '';
    const line = [cost && u ? `${u.today.toFixed(1)} kWh` : '', compare].filter(Boolean).join(' · ');
    const week = this.period === 'Week';
    const fill = this.fuel === 'gas' ? 'var(--glass-gas-bar)' : 'var(--glass-energy-bar)';
    const nowHour = new Date().getHours();
    const values = week ? (this.week ?? []) : (u?.hours ?? []);
    const max = Math.max(...values, ...(week ? [] : (u?.yesterdayHours ?? [])), 0.1);
    const days = Array.from({ length: 7 }, (_, i) => (i === 6 ? 'Today' : new Date(Date.now() - (6 - i) * 86_400_000).toLocaleDateString(undefined, { weekday: 'short' })));
    const peak = u ? u.hours.slice(0, nowHour + 1).reduce((b, v, i, a) => (v > a[b] ? i : b), 0) : 0;
    const kwh = (n: number) => `${n.toFixed(1)} kWh`;

    return html`
      <glass-popup-summary .value=${big} unit=${unit} line=${line} .loading=${waiting && !big ? 160 : undefined}></glass-popup-summary>

      <glass-segmented
        label="Period"
        .options=${(['Today', 'Week'] as Period[]).map((p) => ({ value: p, label: p }))}
        .value=${this.period}
        @change=${(ev: Event) => (this.period = (ev.target as GlassSegmented).value as Period)}
      ></glass-segmented>

      <div class="card">
        <glass-history-chart
          kind="bars"
          ?loading=${week ? !this.week && !this.failed : waiting}
          .values=${values}
          .fadedFrom=${week ? Infinity : nowHour + 1}
          .ticks=${week ? undefined : u?.yesterdayHours}
          .max=${max}
          .hiLabel=${values.length ? `${max.toFixed(1)} kWh` : ''}
          fill=${fill}
          .xLabels=${week ? [days[0], days[3], 'Today'] : ['00:00', '12:00']}
          .key=${week
            ? []
            : ([
                { label: 'Today', look: 'box', colour: fill },
                { label: 'Yesterday', look: 'line', colour: 'rgba(var(--glass-line-rgb), 0.45)' },
              ] as ChartKey[])}
          label=${week ? 'Use each day, last 7 days' : 'Use each hour today, with yesterday'}
        ></glass-history-chart>
      </div>

      ${u || this.week
        ? html`<glass-row-group>
            ${u
              ? html`<glass-grouped-row name="Yesterday by now" value=${kwh(u.yesterdaySoFar)}></glass-grouped-row>
                  <glass-grouped-row name="Yesterday, all day" value=${kwh(u.yesterday)}></glass-grouped-row>
                  <glass-grouped-row name="Busiest hour today" value="${String(peak).padStart(2, '0')}:00 · ${kwh(u.hours[peak] ?? 0)}"></glass-grouped-row>`
              : nothing}
            ${this.week ? html`<glass-grouped-row name="Last 7 days" value="${this.week.reduce((a, b) => a + b, 0).toFixed(0)} kWh"></glass-grouped-row>` : nothing}
          </glass-row-group>`
        : nothing}
    `;
  }

  static styles: CSSResultGroup = [
    GlassSheet.styles,
    css`
      .card {
        ${cardSurface}
        box-sizing: border-box;
        padding: var(--glass-space-edge);
        border-radius: var(--glass-radius-card);
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-energy-sheet': GlassEnergySheet;
  }
}

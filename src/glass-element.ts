import { LitElement, css, html, type CSSResultGroup, type CSSResultOrNative, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import type { IconName } from './icons.js';
import './elements/glass-icon.js';
import type { HomeAssistant } from './ha.js';
import { GlassOffline } from './elements/glass-offline.js';
import { press, sliderHaptic, sliderStart } from './motion.js';
import { setQuietHours, useHass } from './stale.js';

/**
 * Sheets and full-screen views that are open right now. They live in <body>,
 * outside any card, so every card passes on the `hass` it is given to keep
 * them current.
 */
export const openOverlays = new Set<{ hass?: HomeAssistant }>();

/** While HA can't be reached, every card keeps its last states, faded and not tappable. */
const offlineStyles = css`
  :host([offline]) {
    opacity: 0.45;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }
`;

/**
 * The shared states (Library: Shared states), drawn once here for every card:
 * "needs setting up" in place of HA's red error card, "can't find it" when a
 * card's entity no longer exists, and the loading bar.
 */
const sharedStates = css`
  .glass-setup {
    box-sizing: border-box;
    padding: var(--glass-space-edge);
    border-radius: var(--glass-radius-card);
    background: var(--glass-surface);
    border: 1.5px dashed rgba(var(--glass-line-rgb), 0.2);
    display: flex;
    gap: 16px;
    align-items: center;
    font-family: var(--glass-font);
    color: var(--glass-ink);
  }
  .glass-setup .ic {
    width: 44px;
    height: 44px;
    flex: none;
    border-radius: 50%;
    background: var(--glass-neutral-tint);
    color: var(--glass-text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .glass-setup .t {
    display: block;
    font-size: var(--glass-text-body);
  }
  .glass-setup .s {
    display: block;
    font-size: var(--glass-text-caption);
    color: var(--glass-text-muted);
    line-height: 1.4;
  }
  .glass-missing {
    box-sizing: border-box;
    padding: var(--glass-space-edge);
    border-radius: var(--glass-radius-card);
    background: var(--glass-surface);
    border: 1px solid var(--glass-surface-border);
    box-shadow: var(--glass-tile-shadow);
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-family: var(--glass-font);
    color: var(--glass-ink);
  }
  .glass-missing .pill {
    align-self: flex-start;
    height: 30px;
    padding: 0 12px;
    border-radius: 15px;
    background: var(--glass-attention-tint);
    color: var(--glass-attention-ink);
    font-size: var(--glass-text-caption);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .glass-missing .pill i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--glass-attention);
  }
  .glass-missing .t {
    font-size: var(--glass-text-body);
    overflow-wrap: anywhere;
  }
  .glass-missing code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.9em;
  }
  .glass-missing .s {
    font-size: var(--glass-text-small);
    color: var(--glass-text-muted);
  }
  /* Loading: a soft bar the size of what's on its way (style its width and height) */
  .skel {
    display: block;
    border-radius: 8px;
    background: var(--glass-skel, rgba(var(--glass-line-rgb), 0.08)); /* a coloured card sets --glass-skel */
  }
`;

/**
 * Base for every card and sheet. It follows Home Assistant's light / dark
 * mode: when HA's dark theme is on, the host gets a `dark` attribute and the
 * tokens in tokens.ts switch to their dark values. While HA's connection is
 * down it gets `offline`, and the banner across the top shows.
 *
 * In cards and sheets alike, what you press shrinks a little and sliders
 * tick every tenth (motion.ts). Views themselves appear at once: no
 * animation on opening a page, so moving around stays snappy.
 */
// Every card redraws now and then, so a sensor that has died (and so never changes) still shows as quiet,
// and "3 h ago" stays true.
const TICK_MS = 5 * 60 * 1000;
const ticking = new Set<LitElement>();
let tick: number | undefined;

// Cards measure their own width (one observer for all of them): `narrow` below 260 (a half-width
// card is 169), `quarter` below 130 (a quarter is 79, 4 of 12 is 110). Both are reflected, for CSS, and are state,
// so a card can draw a different layout.
const NARROW = 260;
const QUARTER = 130;
const sizes = new ResizeObserver((entries) => {
  for (const e of entries) {
    const el = e.target as GlassElement;
    const w = e.contentRect.width;
    if (!w) continue;
    el.narrow = w < NARROW;
    el.quarter = w < QUARTER;
  }
});

export class GlassElement extends LitElement {
  /** Set by setConfig when a required option is missing: what to choose, in the card's own words. */
  @property({ attribute: false }) protected needs?: string;
  /** Narrower than 260 (half width): the card's compact layout. */
  @property({ type: Boolean, reflect: true }) narrow = false;
  /** Narrower than 130 (a quarter, or 4 of 12). */
  @property({ type: Boolean, reflect: true }) quarter = false;

  /**
   * In setConfig, in place of throwing: keep the config (so the editor still
   * opens) and show "needs setting up" until it's complete.
   */
  protected setUp(config: unknown, what: string): void {
    (this as unknown as { config?: unknown }).config = config;
    this.needs = what;
  }

  /** "Needs setting up": the card's icon, what's missing, and how to fix it. */
  protected renderSetup(icon: IconName): TemplateResult {
    return html`<div class="glass-setup" role="note">
      <span class="ic"><glass-icon name=${icon} size="20" stroke="1.7"></glass-icon></span>
      <span><span class="t">${this.needs}</span><span class="s">Edit this card to finish setting it up.</span></span>
    </div>`;
  }

  /** "Can't find it": the card was set up, but its entity no longer exists. */
  protected renderMissing(id: string): TemplateResult {
    return html`<div class="glass-missing" role="note">
      <span class="pill"><i></i>Check card settings</span>
      <span class="t">Can’t find <code>${id}</code></span>
      <span class="s">It may have been renamed. Open the card’s editor to pick it again.</span>
    </div>`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    sizes.observe(this);
    ticking.add(this);
    tick ??= window.setInterval(() => ticking.forEach((el) => el.requestUpdate()), TICK_MS);
  }

  disconnectedCallback(): void {
    sizes.unobserve(this);
    ticking.delete(this);
    super.disconnectedCallback();
  }

  protected static finalizeStyles(styles?: CSSResultGroup): CSSResultOrNative[] {
    return [...super.finalizeStyles(styles), offlineStyles, sharedStates];
  }

  constructor() {
    super();
    // Buttons and links shrink a little while pressed; sliders tick as they move (motion.ts).
    this.addEventListener('pointerdown', press);
    this.addEventListener('pointerdown', sliderStart);
    this.addEventListener('focusin', sliderStart);
    this.addEventListener('input', sliderHaptic);
  }

  // Before shouldUpdate, which most cards use to skip renders when their own entities haven't changed.
  protected performUpdate(): void {
    // Any card's quiet_hours option raises how long a sensor can be quiet before it counts, for the whole dashboard.
    setQuietHours((this as { config?: { quiet_hours?: Record<string, number> } }).config?.quiet_hours);
    const hass = (this as { hass?: HomeAssistant }).hass;
    if (hass) {
      useHass(hass);
      this.toggleAttribute('offline', hass.connected === false);
      GlassOffline.follow(hass);
    }
    super.performUpdate();
  }

  protected update(changed: PropertyValues): void {
    const hass = (this as { hass?: HomeAssistant }).hass;
    if (hass) {
      this.toggleAttribute('dark', !!hass.themes?.darkMode);
      for (const overlay of openOverlays) if (overlay !== this && overlay.hass !== hass) overlay.hass = hass;
    }
    super.update(changed);
  }
}

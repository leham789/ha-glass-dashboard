import { LitElement, type PropertyValues } from 'lit';
import type { HomeAssistant } from './ha.js';
import { arrive, press, sliderHaptic, sliderStart } from './motion.js';

/**
 * Sheets and full-screen views that are open right now. They live in <body>,
 * outside any card, so every card passes on the `hass` it is given to keep
 * them current.
 */
export const openOverlays = new Set<{ hass?: HomeAssistant }>();

/**
 * Base for every card and sheet. It follows Home Assistant's light / dark
 * mode: when HA's dark theme is on, the host gets a `dark` attribute and the
 * tokens in tokens.ts switch to their dark values.
 *
 * Cards also arrive as their view opens (motion.ts): headers fade in, the
 * rest rise in turn. That plays each time the card is put on the page, never
 * when HA updates it. In cards and sheets alike, what you press shrinks a
 * little and sliders tick every tenth.
 */
export class GlassElement extends LitElement {
  /** How a card arrives when its view opens. Headers set 'fade'. */
  protected static arriveAs: 'rise' | 'fade' | 'none' = 'rise';

  constructor() {
    super();
    // Buttons and links shrink a little while pressed; sliders tick as they move (motion.ts).
    this.addEventListener('pointerdown', press);
    this.addEventListener('pointerdown', sliderStart);
    this.addEventListener('focusin', sliderStart);
    this.addEventListener('input', sliderHaptic);
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Cards only (they have setConfig); sheets slide in their own way.
    const kind = (this.constructor as typeof GlassElement).arriveAs;
    if (kind !== 'none' && 'setConfig' in this) arrive(this, kind);
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

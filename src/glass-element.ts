import { LitElement, type PropertyValues } from 'lit';
import type { HomeAssistant } from './ha.js';

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
 */
export class GlassElement extends LitElement {
  protected update(changed: PropertyValues): void {
    const hass = (this as { hass?: HomeAssistant }).hass;
    if (hass) {
      this.toggleAttribute('dark', !!hass.themes?.darkMode);
      for (const overlay of openOverlays) if (overlay !== this && overlay.hass !== hass) overlay.hass = hass;
    }
    super.update(changed);
  }
}

import { LitElement, css, type CSSResultGroup, type CSSResultOrNative, type PropertyValues } from 'lit';
import type { HomeAssistant } from './ha.js';
import { GlassOffline } from './elements/glass-offline.js';

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
 * Base for every card and sheet. It follows Home Assistant's light / dark
 * mode: when HA's dark theme is on, the host gets a `dark` attribute and the
 * tokens in tokens.ts switch to their dark values. While HA's connection is
 * down it gets `offline`, and the banner across the top shows.
 */
export class GlassElement extends LitElement {
  protected static finalizeStyles(styles?: CSSResultGroup): CSSResultOrNative[] {
    return [...super.finalizeStyles(styles), offlineStyles];
  }

  // Before shouldUpdate, which most cards use to skip renders when their own entities haven't changed.
  protected performUpdate(): void {
    const hass = (this as { hass?: HomeAssistant }).hass;
    if (hass) {
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

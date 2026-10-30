/**
 * The small, stable slice of Home Assistant's frontend API the cards use:
 * the `hass` object, entity states, service calls and the more-info dialog.
 */

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown>;
  locale?: { language: string };
}

export interface LovelaceCardConfig {
  type: string;
  [key: string]: unknown;
}

/** Fires a DOM event the way HA's own elements do (bubbles across shadow roots). */
export function fireEvent(node: HTMLElement, type: string, detail?: unknown): void {
  node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
}

/** Opens HA's built-in more-info dialog for an entity. */
export function openMoreInfo(node: HTMLElement, entityId: string): void {
  fireEvent(node, 'hass-more-info', { entityId });
}

export const isUnavailable = (entity?: HassEntity): boolean =>
  !entity || entity.state === 'unavailable' || entity.state === 'unknown';

/** Lets HA's card picker list a card. */
export function registerCard(card: { type: string; name: string; description: string }): void {
  const w = window as unknown as { customCards?: unknown[] };
  w.customCards = w.customCards ?? [];
  w.customCards.push({ ...card, preview: true, documentationURL: undefined });
}

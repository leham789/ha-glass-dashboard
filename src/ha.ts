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

/** Registry entries HA's frontend keeps on `hass` (areas, floors, devices, entities). */
export interface EntityRegistryEntry {
  entity_id: string;
  area_id?: string | null;
  device_id?: string | null;
  /** The integration that made the entity, e.g. "mobile_app". */
  platform?: string;
  hidden?: boolean;
  entity_category?: string | null;
}

export interface DeviceRegistryEntry {
  id: string;
  area_id?: string | null;
  name?: string | null;
  /** The name you gave it in HA, if any. */
  name_by_user?: string | null;
  /** The integration set-ups the device comes from. */
  config_entries?: string[];
}

export interface AreaRegistryEntry {
  area_id: string;
  name: string;
  floor_id?: string | null;
  icon?: string | null;
  temperature_entity_id?: string | null;
  humidity_entity_id?: string | null;
}

export interface FloorRegistryEntry {
  floor_id: string;
  name: string;
  level?: number | null;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  entities: Record<string, EntityRegistryEntry>;
  devices: Record<string, DeviceRegistryEntry>;
  areas: Record<string, AreaRegistryEntry>;
  floors: Record<string, FloorRegistryEntry>;
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown>;
  /** HA's websocket API, e.g. for history. */
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
  /** The websocket itself, for messages that keep coming (e.g. a camera's live video set-up). */
  connection?: {
    subscribeMessage<T>(callback: (msg: T) => void, msg: Record<string, unknown>): Promise<() => Promise<void>>;
  };
  /** The signed-in HA user. */
  user?: { id: string; name: string };
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

/** Goes to another dashboard view without reloading, the way HA's own cards do. */
export function navigate(path: string): void {
  history.pushState(null, '', path);
  window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
}

/**
 * For cards that come and go (Goodnight, Now playing): hides the card and tells
 * HA, so its slot in the layout goes too (the signal HA's conditional cards use).
 */
export function reportVisibility(card: HTMLElement, visible: boolean): void {
  if (visible !== card.hasAttribute('hidden')) return;
  card.toggleAttribute('hidden', !visible);
  fireEvent(card, 'card-visibility-changed', { value: visible });
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

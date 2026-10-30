import type { HassEntity, HomeAssistant } from './ha.js';

/** Signed links last a day; they are made again after that. */
const SIGNED_FOR_S = 86_400;

const cache = new Map<string, { url: string; until: number }>();
const pending = new Map<string, Promise<string | undefined>>();

/**
 * A still picture of an event entity's last event, if its integration keeps one.
 * UniFi Protect does: each detection has a thumbnail, served by HA at
 * /api/unifiprotect/thumbnail/<config entry>/<event id>. The link is signed
 * so an <img> can load it. Anything else resolves to undefined.
 */
export function eventSnapshot(hass: HomeAssistant, event: HassEntity): Promise<string | undefined> {
  const eventId = event.attributes.event_id as string | undefined;
  const reg = hass.entities[event.entity_id];
  if (!eventId || reg?.platform !== 'unifiprotect') return Promise.resolve(undefined);
  const hit = cache.get(eventId);
  if (hit && hit.until > Date.now()) return Promise.resolve(hit.url);
  const entry = reg.device_id ? hass.devices[reg.device_id]?.config_entries?.[0] : undefined;
  if (!entry) return Promise.resolve(undefined);

  let p = pending.get(eventId);
  if (!p) {
    p = hass
      .callWS<{ path: string }>({ type: 'auth/sign_path', path: `/api/unifiprotect/thumbnail/${entry}/${eventId}`, expires: SIGNED_FOR_S })
      .then(({ path }) => {
        cache.set(eventId, { url: path, until: Date.now() + (SIGNED_FOR_S - 600) * 1000 });
        return path;
      })
      .catch(() => undefined)
      .finally(() => pending.delete(eventId));
    pending.set(eventId, p);
  }
  return p;
}

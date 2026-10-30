import type { HomeAssistant } from './ha.js';

/**
 * Choices made from Room options: lights hidden from a room's screen, and
 * rooms pinned to the top of Home. Saved in Home Assistant's own per-user
 * storage, so they follow your login across phone, tablet and computer.
 */
export interface Prefs {
  /** Area id → light entity ids hidden from that room's screen. */
  hidden: Record<string, string[]>;
  /** Area ids shown first. */
  pinned: string[];
}

const KEY = 'glass-dashboard';
const EMPTY: Prefs = { hidden: {}, pinned: [] };

let current: Prefs = EMPTY;
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();

export const prefs = (): Prefs => current;

/** Reads the saved choices once per page; cards re-render when they arrive. */
export function loadPrefs(hass: HomeAssistant): Promise<void> {
  loading ??= hass
    .callWS<{ value: Prefs | null }>({ type: 'frontend/get_user_data', key: KEY })
    .then((r) => {
      if (r?.value) set({ ...EMPTY, ...r.value });
    })
    .catch(() => {
      // Older HA or no access: choices last until the page reloads.
    });
  return loading;
}

export async function updatePrefs(hass: HomeAssistant, change: (p: Prefs) => Prefs): Promise<void> {
  set(change(current));
  try {
    await hass.callWS({ type: 'frontend/set_user_data', key: KEY, value: current });
  } catch {
    // Kept for this page only.
  }
}

/** Calls `fn` whenever the choices change; returns a function to stop. */
export function onPrefsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function set(next: Prefs) {
  current = next;
  listeners.forEach((fn) => fn());
}

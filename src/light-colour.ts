import type { HassEntity } from './ha.js';

/**
 * The light colour rule from the card library ("Light tile · all states"):
 * - a colour bulb shows its own rgb_color, softened 50% toward white
 * - a white bulb is warm white under 4000K, cool white from 4000K up
 * - anything else that's on (on/off only, groups, no colour data) is the default yellow
 * - off is pale glass with no glow
 */
export type LightTone = 'colour' | 'warm' | 'cool' | 'default' | 'off';

export interface LightLook {
  tone: LightTone;
  background: string;
  shadow: string;
}

const COLOUR_MODES = new Set(['hs', 'rgb', 'rgbw', 'rgbww', 'xy']);
const WARM_COOL_SPLIT_K = 4000;

const glow = (rgb: string) => `0 12px 26px rgba(${rgb}, 0.28)`;

/**
 * Whether a light is really on. A group (e.g. a Hue room) can report "on"
 * while none of its lights are, such as when a bulb is switched off at the
 * wall, so a group only counts as on if at least one member is on.
 */
export function isLightOn(entity: HassEntity | undefined, states: Record<string, HassEntity>): boolean {
  if (entity?.state !== 'on') return false;
  const members = groupMembers(entity);
  return !members || members.some((m) => states[m]?.state === 'on');
}

/** The member entity ids of a light group, or undefined for a single light. */
export function groupMembers(entity?: HassEntity): string[] | undefined {
  const ids = entity?.attributes.entity_id;
  return Array.isArray(ids) ? ids : undefined;
}

export function lightLook(entity: HassEntity | undefined, on = entity?.state === 'on'): LightLook {
  if (!entity || !on) {
    return { tone: 'off', background: 'var(--glass-light-off)', shadow: 'none' };
  }
  const a = entity.attributes;
  const rgb: number[] | undefined = a.rgb_color;

  if (COLOUR_MODES.has(a.color_mode) && Array.isArray(rgb) && rgb.length === 3) {
    const soft = rgb.map((c) => Math.round(255 - (255 - c) * 0.5)).join(', ');
    return { tone: 'colour', background: `rgb(${soft})`, shadow: glow(rgb.join(', ')) };
  }

  const kelvin = kelvinOf(a);
  if (a.color_mode === 'color_temp' && kelvin) {
    return kelvin < WARM_COOL_SPLIT_K
      ? { tone: 'warm', background: 'var(--glass-light-warm)', shadow: glow('var(--glass-light-warm-glow)') }
      : { tone: 'cool', background: 'var(--glass-light-cool)', shadow: glow('var(--glass-light-cool-glow)') };
  }

  return {
    tone: 'default',
    background: 'var(--glass-light-default)',
    shadow: glow('var(--glass-light-default-glow)'),
  };
}

// Newer HA reports color_temp_kelvin; older versions only mireds.
function kelvinOf(a: Record<string, any>): number | undefined {
  if (typeof a.color_temp_kelvin === 'number') return a.color_temp_kelvin;
  if (typeof a.color_temp === 'number' && a.color_temp > 0) return Math.round(1_000_000 / a.color_temp);
  return undefined;
}

/** Brightness 0–255 as a whole percent, or undefined if the light doesn't dim. */
export function brightnessPct(entity?: HassEntity): number | undefined {
  const b = entity?.attributes.brightness;
  return typeof b === 'number' ? Math.round((b / 255) * 100) : undefined;
}

import { css, html } from 'lit';
import { type HassEntity, type HomeAssistant, isUnavailable } from '../ha.js';
import { brightnessPct, COLOUR_MODES } from '../light-colour.js';
import { haptic } from '../motion.js';
import type { RoomLight } from '../rooms.js';
import './glass-rows.js';

export type LightFill = 'warm' | 'colour';

/**
 * The Light row (Library: Light row): the Pill row (solid) with the light's
 * brightness as a fill behind, the bulb, its name and state. Tap to toggle.
 * The Lights pop-up and Room lights (rows) use it.
 *
 * `fill`: warm (default) is the light fill; colour lets a light in colour
 * mode fill with a soft tint of its own colour (see-through in dark mode, like
 * the light fill). A white light always fills warm.
 */
export function lightRow(hass: HomeAssistant, l: RoomLight, fill: LightFill = 'warm') {
  const entity = hass.states[l.id];
  const offline = isUnavailable(entity);
  const pct = brightnessPct(entity);
  const width = l.on ? (pct ?? 100) : 0;
  const state = offline ? 'Offline' : l.on ? (pct === undefined ? 'On' : `${pct}%`) : 'Off';
  return html`<glass-pill-row
    look="solid"
    button
    icon="lightbulb"
    ?icon-on=${l.on}
    name=${l.name}
    state=${state}
    .fill=${width}
    fill-bg=${fill === 'colour' ? colourFill(entity) : 'var(--glass-light-fill)'}
    ?faded=${offline}
    ?disabled=${offline}
    .pressed=${l.on}
    @click=${() => (haptic('light'), hass.callService('light', l.on ? 'turn_off' : 'turn_on', { entity_id: l.id }))}
  ></glass-pill-row>`;
}

/** A soft tint of the bulb's own colour, when it's in colour mode; otherwise the warm light fill. */
function colourFill(e: HassEntity | undefined): string {
  const rgb: number[] | undefined = e?.attributes.rgb_color;
  if (!e || !COLOUR_MODES.has(e.attributes.color_mode) || !Array.isArray(rgb) || rgb.length !== 3) return 'var(--glass-light-fill)';
  const c = rgb.join(', ');
  return `linear-gradient(90deg, rgba(${c}, 0.25) 0%, rgba(${c}, 0.5) 100%)`;
}

/** Kept for the cards that list rows: they sit 8 apart. */
export const lightRowStyles = css`
  glass-pill-row {
    display: block;
  }
`;

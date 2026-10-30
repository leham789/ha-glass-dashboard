import { css, html } from 'lit';
import { type HomeAssistant, isUnavailable } from '../ha.js';
import { brightnessPct } from '../light-colour.js';
import type { RoomLight } from '../rooms.js';
import './glass-icon.js';

/**
 * A light as a 64-high row: the bulb, its name and state, with the brightness
 * as a fill behind. Tap to toggle. Used by the Lights pop-up and by a room's
 * lights card when it's set to rows.
 */
export function lightRow(hass: HomeAssistant, l: RoomLight) {
  const entity = hass.states[l.id];
  const offline = isUnavailable(entity);
  const pct = brightnessPct(entity);
  const fill = l.on ? (pct ?? 100) : 0;
  const state = offline ? 'Offline' : l.on ? (pct === undefined ? 'On' : `${pct}%`) : 'Off';
  return html`<button
    type="button"
    class="row ${l.on ? 'on' : ''}"
    ?disabled=${offline}
    aria-pressed=${l.on ? 'true' : 'false'}
    @click=${() => hass.callService('light', l.on ? 'turn_off' : 'turn_on', { entity_id: l.id })}
  >
    <span class="fill" style="width: ${fill}%"></span>
    <span class="bulb"><glass-icon name="lightbulb" size="18"></glass-icon></span>
    <span class="name">${l.name}</span>
    <span class="state">${state}</span>
  </button>`;
}

export const lightRowStyles = css`
  .row {
    all: unset;
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    height: 64px;
    padding: 0 16px 0 10px;
    border-radius: 32px;
    border: 1px solid var(--glass-hairline);
    background: var(--glass-solid);
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .row:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .row:focus-visible {
    outline: 2px solid var(--glass-ink);
    outline-offset: 2px;
  }
  .fill {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    border-radius: 32px;
    background: var(--glass-light-fill);
    transition: width 0.25s ease;
  }
  .bulb {
    position: relative;
    width: 44px;
    height: 44px;
    flex: none;
    border-radius: 50%;
    background: var(--glass-neutral-tint);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .row.on .bulb {
    background: rgba(var(--glass-surface-rgb), 0.75);
  }
  .name {
    position: relative;
    flex: 1;
    font-size: var(--glass-text-body);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .state {
    position: relative;
    font-size: var(--glass-text-caption);
    color: var(--glass-text-secondary);
  }
`;

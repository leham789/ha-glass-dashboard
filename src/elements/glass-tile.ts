import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { type HassEntity, type HomeAssistant, isUnavailable, openMoreInfo } from '../ha.js';
import { haptic, sweep } from '../motion.js';
import { brightnessPct, groupMembers, isLightOn, lightLook } from '../light-colour.js';
import { areaOf, shortName } from '../rooms.js';
import type { IconName } from '../icons.js';
import './glass-icon.js';
import './glass-chip.js';

/**
 * The Tile (Library: Tile): the one tile for any single thing. The Light tile
 * card is this on its own; Brightness's lamps, Favourites, Doors, Room lights
 * and Scenes' glass look nest it.
 *
 * Styles: tile (132), small (92, a 32 ring) and row (56, bulb on the left).
 * A tile narrower than a quarter (about 110) takes small by itself; a row
 * needs at least half, or it's small too.
 *
 * Looks, from the entity: a lit light takes its bulb's colour (light-colour.ts);
 * something else that's on is ink; a scene or script stays glass; off is glass.
 * `look="attention"` (Doors' open door) overrides it. Brightness and state sit
 * under the name in grey, never top right.
 *
 * Tap: a light toggles, a scene or script runs, anything else that switches
 * toggles; `tap="more-info"` opens its pop-up instead. Hold opens the pop-up.
 * Something with nothing to switch or run (a sensor) says "Can't be a tile".
 *
 * Nested, it inherits the card's tokens (no copy here, or dark mode breaks).
 */

const HOLD_MS = 500;
const RUN = new Set(['scene', 'script', 'button', 'input_button']);
const TOGGLE = new Set(['light', 'switch', 'input_boolean', 'fan', 'automation', 'humidifier', 'siren', 'media_player', 'climate', 'cover', 'group']);
const OFF_STATES = new Set(['off', 'idle', 'standby', 'closed', 'paused', 'unavailable', 'unknown']);
const ICONS: Record<string, IconName> = {
  light: 'lightbulb',
  switch: 'power',
  input_boolean: 'power',
  fan: 'fan',
  media_player: 'music',
  climate: 'thermometer',
  cover: 'layers',
  scene: 'sparkles',
  script: 'sparkles',
  button: 'sparkles',
  input_button: 'sparkles',
  automation: 'zap',
};

export type TileStyle = 'tile' | 'small' | 'row';
export type TileLook = 'auto' | 'attention';

@customElement('glass-tile')
export class GlassTile extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property() entity = '';
  @property() name?: string;
  @property() icon?: IconName;
  /** The style asked for; the tile may draw small when it's narrow. */
  @property({ attribute: 'tile-style' }) tileStyle: TileStyle = 'tile';
  @property({ attribute: 'icon-style' }) iconStyle: 'ring' | 'plain' = 'ring';
  @property() look: TileLook = 'auto';
  /** The grey line under the name, in place of the state (Doors' "Open for 12 min", a scene's hint). */
  @property() line?: string;
  @property() tap: 'auto' | 'more-info' = 'auto';

  @state() private narrow = false;
  @state() private tooNarrowForRow = false;

  private holdTimer?: number;
  private held = false;
  private tapAt?: { x: number; y: number; at: number };
  private wasOn?: boolean;
  private resize = new ResizeObserver(([e]) => {
    const w = e.contentRect.width;
    this.narrow = w > 0 && w < 110;
    this.tooNarrowForRow = w > 0 && w < 150;
  });

  connectedCallback(): void {
    super.connectedCallback();
    this.resize.observe(this);
  }

  disconnectedCallback(): void {
    this.resize.disconnect();
    super.disconnectedCallback();
  }

  /** Only redraw when this entity (or a group's members) changed. */
  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has('hass') || changed.size > 1) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    if (!old || !this.hass) return true;
    if (old.states[this.entity] !== this.hass.states[this.entity]) return true;
    return (groupMembers(this.hass.states[this.entity]) ?? []).some((m) => old.states[m] !== this.hass!.states[m]);
  }

  private get domain(): string {
    return this.entity.split('.')[0];
  }

  private get drawnStyle(): TileStyle {
    if (this.narrow) return 'small';
    if (this.tileStyle === 'row' && this.tooNarrowForRow) return 'small';
    return this.tileStyle;
  }

  private isOn(e: HassEntity): boolean {
    if (this.domain === 'light') return isLightOn(e, this.hass!.states);
    if (RUN.has(this.domain)) return false;
    if (this.domain === 'cover') return e.state === 'open';
    if (this.domain === 'media_player') return e.state === 'playing' || e.state === 'on';
    return !OFF_STATES.has(e.state);
  }

  /** A scene or script that's never been run is "unknown", not offline. */
  private offline(e: HassEntity): boolean {
    return RUN.has(this.domain) ? e.state === 'unavailable' : isUnavailable(e);
  }

  private stateText(e: HassEntity, on: boolean): string {
    if (this.offline(e)) return 'Offline';
    if (RUN.has(this.domain)) {
      // A scene keeps its room as its line ("Working" · "Office scene").
      const area = this.areaName(e);
      const kind = this.domain === 'script' ? 'script' : 'scene';
      return area ? `${area} ${kind}` : kind.charAt(0).toUpperCase() + kind.slice(1);
    }
    if (this.domain === 'light') {
      if (!on) return 'Off';
      const pct = brightnessPct(e);
      const members = groupMembers(e);
      if (members) {
        const n = members.filter((m) => this.hass!.states[m]?.state === 'on').length;
        return pct === undefined ? `${n} on` : `${n} on · ${pct}%`;
      }
      return pct === undefined ? 'On' : `${pct}%`;
    }
    if (on && this.domain !== 'switch' && this.domain !== 'input_boolean' && e.state !== 'on') return e.state.charAt(0).toUpperCase() + e.state.slice(1).replace(/_/g, ' ');
    return on ? 'On' : 'Off';
  }

  private areaName(e: HassEntity): string {
    const area = areaOf(this.hass!, e.entity_id);
    return (area && this.hass!.areas?.[area]?.name) || '';
  }

  /** Something it can switch or run: otherwise it can't be a tile. */
  private get usable(): boolean {
    return this.tap === 'more-info' || RUN.has(this.domain) || TOGGLE.has(this.domain);
  }

  render() {
    const style = this.drawnStyle;
    const cls = `tile ${style}`;
    if (!this.entity) return this.notice(style, 'Choose an entity', 'Edit this card to finish setting it up.');
    const e = this.hass?.states[this.entity];
    if (this.hass && !e) return this.missing(cls);
    if (!e) return nothing;
    if (!this.usable) return this.notice(style, 'Can’t be a tile', 'Pick a light, switch, scene or script.');

    const offline = this.offline(e);
    const on = this.isOn(e);
    const run = RUN.has(this.domain);
    const light = this.domain === 'light';
    const look = this.look === 'attention' ? 'attention' : run || !on ? 'off' : light ? 'lit' : 'ink';
    const lit = look === 'lit' ? lightLook(e, true) : undefined;
    const name = this.name || (run ? shortName(e, this.areaName(e)) : e.attributes.friendly_name) || this.entity;
    const line = this.line ?? this.stateText(e, on);
    const icon = this.icon ?? (this.domain === 'media_player' && e.attributes.device_class === 'tv' ? 'tv' : ICONS[this.domain] ?? 'power');
    const ring = style === 'tile' ? 40 : 32;
    const glyph = this.iconStyle === 'plain' ? 24 : style === 'tile' ? 19 : 16;

    return html`<button
      type="button"
      class="${cls} ${look}"
      style=${styleMap(lit ? { background: lit.background, boxShadow: lit.shadow } : {})}
      ?disabled=${offline}
      aria-pressed=${run || this.tap === 'more-info' ? nothing : on ? 'true' : 'false'}
      aria-label="${name}, ${line}"
      @pointerdown=${this.onPointerDown}
      @pointerup=${this.cancelHold}
      @pointerleave=${this.cancelHold}
      @pointercancel=${this.cancelHold}
      @contextmenu=${(ev: Event) => ev.preventDefault()}
      @click=${this.onClick}
    >
      <span class="bulb ${this.iconStyle}" style="--ring: ${ring}px"><glass-icon name=${icon} size=${glyph}></glass-icon></span>
      <span class="foot"><span class="name">${name}</span><span class="state">${line}</span></span>
    </button>`;
  }

  /** Needs setting up, or can't be a tile: the dashed tile from Shared states. */
  private notice(style: TileStyle, title: string, sub: string) {
    return html`<div class="tile ${style} notice dashed" role="note">
      <span class="bulb" style="--ring: ${style === 'tile' ? 40 : 32}px"><glass-icon name="lightbulb" size="16"></glass-icon></span>
      <span class="foot"><span class="name">${title}</span><span class="state">${sub}</span></span>
    </div>`;
  }

  private missing(cls: string) {
    return html`<div class="${cls} notice" role="note">
      <glass-pill class="pill" tone="attention" small>Check settings</glass-pill>
      <span class="foot"><span class="name">Can’t find it</span><code>${this.entity}</code></span>
    </div>`;
  }

  protected updated(): void {
    const e = this.hass?.states[this.entity];
    if (!e || this.domain !== 'light') return;
    const on = this.isOn(e);
    // Turned on by a tap here: the colour spreads out from the finger.
    if (on && this.wasOn === false && this.tapAt && performance.now() - this.tapAt.at < 3000) {
      const tile = this.renderRoot.querySelector<HTMLElement>('button');
      if (tile) sweep(tile, this.tapAt.x, this.tapAt.y, lightLook(e, true).background);
    }
    this.wasOn = on;
  }

  private onPointerDown(ev: PointerEvent) {
    if (ev.button !== 0) return;
    this.held = false;
    const box = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    this.tapAt = { x: ev.clientX - box.left, y: ev.clientY - box.top, at: performance.now() };
    if (this.tap === 'more-info') return;
    this.holdTimer = window.setTimeout(() => {
      this.held = true;
      openMoreInfo(this, this.entity);
    }, HOLD_MS);
  }

  private cancelHold() {
    window.clearTimeout(this.holdTimer);
  }

  private onClick() {
    // A hold already opened the pop-up; don't also toggle on release.
    if (this.held) {
      this.held = false;
      return;
    }
    const e = this.hass?.states[this.entity];
    if (!this.hass || !e) return;
    if (this.tap === 'more-info') return openMoreInfo(this, this.entity);
    haptic('light');
    const call = (domain: string, service: string) => this.hass!.callService(domain, service, { entity_id: this.entity }).catch(() => haptic('warning'));
    if (this.domain === 'scene' || this.domain === 'script') return void call(this.domain, 'turn_on');
    if (this.domain === 'button' || this.domain === 'input_button') return void call(this.domain, 'press');
    // Not light.toggle: a group that says "on" with no lights on shows as off, so tapping it must turn it on.
    if (this.domain === 'light') return void call('light', this.isOn(e) ? 'turn_off' : 'turn_on');
    return void call('homeassistant', 'toggle');
  }

  static styles = css`
    :host {
      display: block;
      min-width: 0;
      font-family: var(--glass-font);
    }
    .tile {
      all: unset;
      box-sizing: border-box;
      width: 100%;
      height: var(--glass-height-tile);
      padding: var(--glass-space-tile);
      border-radius: var(--glass-radius-tile);
      border: 1px solid var(--glass-surface-border);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 12px;
      position: relative;
      overflow: hidden;
      color: var(--glass-ink);
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      transition: background 0.25s ease, box-shadow 0.25s ease;
    }
    .tile.small {
      height: var(--glass-height-small-tile);
      padding: var(--glass-space-small-tile);
      border-radius: var(--glass-radius-small-tile);
      gap: 0;
    }
    .tile.row {
      height: 56px;
      padding: 0 12px;
      border-radius: var(--glass-radius-small-tile);
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      gap: 12px;
    }
    .tile:focus-visible {
      outline: 2px solid var(--glass-ink);
      outline-offset: 2px;
    }
    .tile:disabled {
      opacity: 0.5;
      cursor: default;
    }
    /* looks */
    .off,
    .notice {
      background: var(--glass-light-off);
      border-color: var(--glass-surface-border);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      --ring-colour: rgba(var(--glass-line-rgb), 0.12);
      --state: var(--glass-text-muted);
    }
    .lit {
      color: var(--glass-on-pastel); /* lit tiles keep the bulb colour, so their text stays dark */
      border-color: rgba(255, 255, 255, 0.95);
      --ring-colour: rgba(18, 19, 22, 0.25);
      --state: rgba(18, 19, 22, 0.65);
    }
    .ink {
      background: var(--glass-ink);
      border-color: var(--glass-ink);
      color: var(--glass-on-ink);
      --ring-colour: color-mix(in srgb, var(--glass-on-ink) 30%, transparent);
      --state: color-mix(in srgb, var(--glass-on-ink) 70%, transparent);
    }
    .attention {
      background: var(--glass-attention-tint);
      border-color: var(--glass-attention-edge);
      --ring-colour: var(--glass-attention-edge);
      --state: var(--glass-attention-ink);
    }
    .notice {
      cursor: default;
    }
    .notice.dashed {
      border: 1.5px dashed rgba(var(--glass-line-rgb), 0.2);
    }
    /* parts */
    .bulb,
    .foot,
    .pill {
      align-self: flex-start;
    }
    .bulb {
      width: var(--ring, 40px);
      height: var(--ring, 40px);
      flex: none;
      box-sizing: border-box;
      border-radius: 50%;
      border: 1px solid var(--ring-colour);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bulb.plain {
      border: 0;
      width: auto;
      height: auto;
      justify-content: flex-start;
      align-self: flex-start;
    }
    .row .bulb.plain {
      align-self: center;
    }
    .foot {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .small .foot {
      gap: 0;
    }
    .name {
      display: block;
      font-size: var(--glass-text-tile-title);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .small .name,
    .row .name {
      font-size: var(--glass-text-body);
    }
    .state {
      display: block;
      font-size: var(--glass-text-caption);
      color: var(--state);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .small .state,
    .row .state {
      font-size: var(--glass-text-small);
    }
    .pill {
      align-self: flex-start;
      height: 26px;
      padding: 0 12px;
      border-radius: 13px;
      background: var(--glass-attention-tint);
      color: var(--glass-attention-ink);
      font-size: var(--glass-text-small);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    code {
      display: block;
      font-family: ui-monospace, Menlo, monospace;
      font-size: var(--glass-text-small);
      color: var(--glass-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    @media (prefers-reduced-motion: reduce) {
      .tile {
        transition: none;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-tile': GlassTile;
  }
}

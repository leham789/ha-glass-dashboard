import { css, html, nothing } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, navigate, registerCard } from '../../ha.js';
import type { IconName } from '../../icons.js';
import '../../elements/glass-icon.js';
import './menu-editor.js';
import { EASE, haptic, reducedMotion } from '../../motion.js';

export interface MenuConfig extends LovelaceCardConfig {
  home_path?: string;
  rooms_path?: string;
  energy_path?: string;
  security_path?: string;
  /** Float over the bottom of the screen (default) or sit in the page like any card. */
  floating?: boolean;
}

interface Item {
  key: 'home' | 'rooms' | 'energy' | 'security';
  label: string;
  icon: IconName;
  path?: string;
}

const LAST_ROOM_KEY = 'glass-menu-last-room';

/**
 * Where the pill and each item were as you left a page. Every view has its
 * own menu, so the next page's menu reads this to slide from there.
 */
let leaving: { pill: { left: number; width: number }; lefts: Record<string, number>; at: number } | undefined;

/**
 * The bottom menu: Home, Rooms, Energy, Security. The current screen is the
 * dark pill with its name; the others are icons. Any other view in the same
 * dashboard counts as a room, so Rooms reopens the last room you viewed.
 * Tapping another item slides the pill over to it.
 */
@customElement('glass-menu')
export class GlassMenu extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: MenuConfig;
  @state() private path = location.pathname;
  /** Re-fits the pill if the current item changes size (e.g. once the font loads). */
  private fit = new ResizeObserver(() => this.placePill());
  private fitted?: HTMLElement;

  static getConfigElement() {
    return document.createElement('glass-menu-editor');
  }

  static getStubConfig(): Partial<MenuConfig> {
    const base = location.pathname.split('/')[1] ?? 'lovelace';
    return { home_path: `/${base}/0` };
  }

  setConfig(config: MenuConfig): void {
    this.config = config;
  }

  getCardSize(): number {
    return 2;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    ensureFonts();
    window.addEventListener('location-changed', this.onLocation);
    window.addEventListener('popstate', this.onLocation);
    this.onLocation();
    // HA keeps views it has shown: coming back to one puts this menu back without re-rendering it.
    if (this.hasUpdated) this.updateComplete.then(() => this.placePill());
  }

  disconnectedCallback(): void {
    window.removeEventListener('location-changed', this.onLocation);
    window.removeEventListener('popstate', this.onLocation);
    this.fit.disconnect();
    this.fitted = undefined;
    super.disconnectedCallback();
  }

  // Never re-render on HA state changes; only when the page changes.
  protected shouldUpdate(changed: Map<string, unknown>): boolean {
    return changed.has('config') || changed.has('path');
  }

  protected updated(): void {
    this.placePill();
  }

  /** Puts the pill under the current item; just after a tap, slides it (and the items) over from the last page. */
  private placePill() {
    const pill = this.renderRoot.querySelector<HTMLElement>('.pill');
    const current = this.renderRoot.querySelector<HTMLElement>('button.current');
    if (!pill) return;
    pill.hidden = !current;
    if (current !== this.fitted) {
      this.fit.disconnect();
      if (current) this.fit.observe(current);
      this.fitted = current ?? undefined;
    }
    if (!current) return;
    const to = { left: current.offsetLeft, width: current.offsetWidth };
    pill.style.transform = `translateX(${to.left}px)`;
    pill.style.width = `${to.width}px`;
    const from = leaving;
    if (!from || performance.now() - from.at > 1500 || reducedMotion()) return;
    leaving = undefined;
    const timing = { duration: 250, easing: EASE };
    // Transform only (slide, and stretch to the new width), never width itself: HA
    // builds the new page in one long busy spell right after the tap, and only
    // transform and opacity keep animating through that.
    pill.animate(
      [
        { transform: `translateX(${from.pill.left}px) scaleX(${from.pill.width / to.width})` },
        { transform: `translateX(${to.left}px) scaleX(1)` },
      ],
      timing,
    );
    // Each item glides from where it was; the new name fades in once the pill is under it.
    for (const b of this.renderRoot.querySelectorAll<HTMLElement>('button')) {
      const was = from.lefts[b.dataset.key!];
      if (was !== undefined && was !== b.offsetLeft) b.animate([{ transform: `translateX(${was - b.offsetLeft}px)` }, { transform: 'none' }], timing);
    }
    current.classList.add('arriving');
    current.querySelector('span')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, delay: 90, easing: 'ease', fill: 'backwards' });
    pill.getAnimations()[0]?.finished.finally(() => current.classList.remove('arriving'));
  }

  private onLocation = () => {
    this.path = location.pathname;
    if (this.currentKey() === 'rooms') rememberRoom(this.path);
  };

  private items(): Item[] {
    const c = this.config!;
    return [
      { key: 'home' as const, label: 'Home', icon: 'house' as const, path: c.home_path },
      { key: 'rooms' as const, label: 'Rooms', icon: 'layout-panel-top' as const, path: c.rooms_path },
      { key: 'energy' as const, label: 'Energy', icon: 'zap' as const, path: c.energy_path },
      { key: 'security' as const, label: 'Security', icon: 'cctv' as const, path: c.security_path },
    ].filter((i) => i.path);
  }

  /** Which item the current page belongs to. */
  private currentKey(): Item['key'] | undefined {
    if (!this.config) return undefined;
    const items = this.items();
    const exact = items.find((i) => i.key !== 'rooms' && samePath(i.path!, this.path));
    if (exact) return exact.key;
    const rooms = items.find((i) => i.key === 'rooms');
    if (rooms && sameDashboard(rooms.path!, this.path)) return 'rooms';
    return undefined;
  }

  render() {
    if (!this.config) return nothing;
    const current = this.currentKey();
    const floating = this.config.floating ?? true;
    return html`
      <nav class=${floating ? 'floating' : ''} aria-label="Main">
        <span class="pill" aria-hidden="true"></span>
        ${this.items().map((item) => {
          const on = item.key === current;
          return html`<button
            type="button"
            class=${on ? 'current' : ''}
            data-key=${item.key}
            aria-current=${on ? 'page' : 'false'}
            aria-label=${item.label}
            @click=${() => this.go(item)}
          >
            <glass-icon name=${item.icon} size=${on ? 20 : 22}></glass-icon>
            ${on ? html`<span>${item.label}</span>` : nothing}
          </button>`;
        })}
      </nav>
      ${floating ? html`<div class="spacer" aria-hidden="true"></div>` : nothing}
    `;
  }

  private go(item: Item) {
    const target = item.key === 'rooms' ? lastRoom(item.path!) : item.path!;
    if (samePath(target, location.pathname)) return;
    const current = this.renderRoot.querySelector<HTMLElement>('button.current');
    const lefts: Record<string, number> = {};
    for (const b of this.renderRoot.querySelectorAll<HTMLElement>('button')) lefts[b.dataset.key!] = b.offsetLeft;
    if (current) leaving = { pill: { left: current.offsetLeft, width: current.offsetWidth }, lefts, at: performance.now() };
    haptic('selection');
    navigate(target);
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      nav {
        box-sizing: border-box;
        height: 72px;
        padding: 8px;
        border-radius: 36px;
        background: rgba(var(--glass-surface-rgb), 0.7);
        border: 1px solid var(--glass-surface-border);
        box-shadow: 0 16px 40px rgba(20, 30, 20, 0.14);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .pill {
        position: absolute;
        top: 7px; /* 8px padding, less the nav's 1px border */
        left: 0;
        transform-origin: left center;
        height: 56px;
        border-radius: 28px;
        background: var(--glass-ink);
      }
      nav.floating {
        position: fixed;
        z-index: 5;
        left: 50%;
        transform: translateX(-50%);
        bottom: calc(16px + env(safe-area-inset-bottom, 0px));
        width: calc(100% - 2 * var(--glass-space-edge));
        max-width: 390px;
      }
      .spacer {
        height: 88px;
      }
      button {
        all: unset;
        box-sizing: border-box;
        height: 56px;
        min-width: 56px;
        border-radius: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        font-size: var(--glass-text-body);
        color: var(--glass-ink);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        position: relative; /* above the pill */
      }
      button.current {
        padding: 0 22px;
      }
      button.current:not(.arriving) {
        color: var(--glass-on-ink);
        transition: color 0.15s ease;
      }
      button:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
    `,
  ];
}

const trimSlash = (p: string) => p.replace(/\/+$/, '');
const samePath = (a: string, b: string) => trimSlash(a) === trimSlash(b);
const dashboardOf = (p: string) => p.split('/')[1] ?? '';
const sameDashboard = (a: string, b: string) => dashboardOf(a) === dashboardOf(b);

function rememberRoom(path: string) {
  try {
    localStorage.setItem(LAST_ROOM_KEY, path);
  } catch {
    // Private browsing: Rooms just opens its own view.
  }
}

/** The last room viewed on this device, if it's in the same dashboard; otherwise the Rooms view. */
function lastRoom(roomsPath: string): string {
  try {
    const last = localStorage.getItem(LAST_ROOM_KEY);
    if (last && sameDashboard(last, roomsPath)) return last;
  } catch {
    // Fall through to the default.
  }
  return roomsPath;
}

registerCard({
  type: 'glass-menu',
  name: 'Glass · Menu',
  description: 'The bottom menu: Home, Rooms, Energy, Security. Rooms reopens the last room.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-menu': GlassMenu;
  }
}

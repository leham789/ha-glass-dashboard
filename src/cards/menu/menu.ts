import { css, html, nothing } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, navigate, registerCard } from '../../ha.js';
import type { IconName } from '../../icons.js';
import '../../elements/glass-icon.js';
import './menu-editor.js';

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
 * The bottom menu: Home, Rooms, Energy, Security. The current screen is the
 * dark pill with its name; the others are icons. Any other view in the same
 * dashboard counts as a room, so Rooms reopens the last room you viewed.
 */
@customElement('glass-menu')
export class GlassMenu extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: MenuConfig;
  @state() private path = location.pathname;

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
  }

  disconnectedCallback(): void {
    window.removeEventListener('location-changed', this.onLocation);
    window.removeEventListener('popstate', this.onLocation);
    super.disconnectedCallback();
  }

  // Never re-render on HA state changes; only when the page changes.
  protected shouldUpdate(changed: Map<string, unknown>): boolean {
    return changed.has('config') || changed.has('path');
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
        ${this.items().map((item) => {
          const on = item.key === current;
          return html`<button
            type="button"
            class=${on ? 'current' : ''}
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
    if (!samePath(target, location.pathname)) navigate(target);
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
        display: flex;
        align-items: center;
        justify-content: space-between;
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
        transition: background 0.2s ease;
      }
      button.current {
        padding: 0 22px;
        background: var(--glass-ink);
        color: var(--glass-on-ink);
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

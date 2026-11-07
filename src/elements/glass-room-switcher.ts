import { LitElement, css, html, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { EASE, haptic, reducedMotion } from '../motion.js';

/** Where the highlight was as you left a room, so the next room's switcher slides it on. */
let leaving: { left: number; width: number; at: number } | undefined;

export interface SwitcherRoom {
  id: string;
  name: string;
  href: string;
}

/**
 * Room switcher (Library: Room switcher): every room in a glass track that
 * scrolls sideways and fades at the right edge; the current room on an ink
 * pill, which slides over to the next room as you switch. Fires `pick`
 * (detail: the room's id) for any other room; the card navigates.
 */
@customElement('glass-room-switcher')
export class GlassRoomSwitcher extends LitElement {
  @property({ attribute: false }) rooms: SwitcherRoom[] = [];
  @property() current = '';

  /** Re-fits the highlight if the current room's tab changes size (e.g. once the font loads). */
  private fit = new ResizeObserver(() => this.placePill());
  private fitted?: HTMLElement;

  connectedCallback(): void {
    super.connectedCallback();
    // HA keeps views it has shown: coming back to one puts this back without re-rendering it.
    if (this.hasUpdated) this.updateComplete.then(() => this.placePill());
  }

  disconnectedCallback(): void {
    this.fit.disconnect();
    this.fitted = undefined;
    super.disconnectedCallback();
  }

  protected updated(changed: PropertyValues): void {
    // Bring the current room into view, on arrival only, never while you're scrolling it.
    // (Scrolls only the switcher, never the page.)
    const firstRooms = changed.has('rooms') && !(changed.get('rooms') as SwitcherRoom[] | undefined)?.length;
    if (changed.has('current') || firstRooms) {
      const nav = this.renderRoot.querySelector<HTMLElement>('nav');
      const cur = this.renderRoot.querySelector<HTMLElement>('[aria-current="page"]');
      if (nav && cur) nav.scrollLeft = cur.offsetLeft - nav.clientWidth / 2 + cur.offsetWidth / 2;
    }
    this.placePill();
  }

  /** Puts the highlight under the current room, sliding it over from the last room if you just switched. */
  private placePill() {
    const pill = this.renderRoot.querySelector<HTMLElement>('.pill');
    const cur = this.renderRoot.querySelector<HTMLElement>('[aria-current="page"]');
    if (!pill) return;
    pill.hidden = !cur;
    if (cur !== this.fitted) {
      this.fit.disconnect();
      if (cur) this.fit.observe(cur);
      this.fitted = cur ?? undefined;
    }
    if (!cur) return;
    const to = { left: cur.offsetLeft, width: cur.offsetWidth };
    pill.style.transform = `translateX(${to.left}px)`;
    pill.style.width = `${to.width}px`;
    const from = leaving;
    if (!from || performance.now() - from.at > 1500 || reducedMotion()) return;
    leaving = undefined;
    // Transform only (slide, and stretch to the new width), never width itself: HA
    // builds the new room's page in one long busy spell right after the tap, and only
    // transform and opacity keep animating through that.
    pill.animate(
      [
        { transform: `translateX(${from.left}px) scaleX(${from.width / to.width})` },
        { transform: `translateX(${to.left}px) scaleX(1)` },
      ],
      { duration: 250, easing: EASE },
    );
    // Its name turns from dark to white as the highlight passes under it.
    cur.animate([{ color: 'var(--glass-ink)' }, { color: 'var(--glass-on-ink)' }], { duration: 120, delay: 100, easing: 'ease', fill: 'backwards' });
  }

  private go(e: Event, id: string) {
    e.preventDefault();
    if (id === this.current) return;
    const cur = this.renderRoot.querySelector<HTMLElement>('[aria-current="page"]');
    if (cur) leaving = { left: cur.offsetLeft, width: cur.offsetWidth, at: performance.now() };
    haptic('selection');
    this.dispatchEvent(new CustomEvent('pick', { detail: id, bubbles: true, composed: true }));
  }

  render() {
    return html`<nav aria-label="Rooms">
      <span class="pill" aria-hidden="true"></span>
      ${this.rooms.map(
        (r) => html`<a href=${r.href} aria-current=${r.id === this.current ? 'page' : 'false'} @click=${(e: Event) => this.go(e, r.id)}>${r.name}</a>`,
      )}
    </nav>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    nav {
      position: relative;
      display: flex;
      gap: 4px;
      padding: 4px;
      border-radius: 24px;
      border: 1px solid var(--glass-surface-border);
      background: rgba(var(--glass-surface-rgb), 0.6);
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-mask-image: linear-gradient(90deg, #000 80%, transparent 100%);
      mask-image: linear-gradient(90deg, #000 80%, transparent 100%);
    }
    nav::-webkit-scrollbar {
      display: none;
    }
    .pill {
      position: absolute;
      top: 4px;
      left: 0;
      transform-origin: left center;
      height: 38px;
      border-radius: 19px;
      background: var(--glass-ink);
    }
    a {
      position: relative; /* above the highlight */
      flex: none;
      height: 38px;
      padding: 0 16px;
      border-radius: 19px;
      display: flex;
      align-items: center;
      white-space: nowrap;
      font-family: var(--glass-font);
      font-size: var(--glass-text-chip);
      color: var(--glass-ink);
      text-decoration: none;
      -webkit-tap-highlight-color: transparent;
    }
    a[aria-current='page'] {
      color: var(--glass-on-ink);
    }
    a:focus-visible {
      outline: 2px solid var(--glass-ink);
      outline-offset: -2px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-room-switcher': GlassRoomSwitcher;
  }
}

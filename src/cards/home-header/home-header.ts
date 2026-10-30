import { css, html, nothing, type PropertyValues } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HassEntity, type HomeAssistant, type LovelaceCardConfig, openMoreInfo, registerCard } from '../../ha.js';
import { roomSummary } from '../../rooms.js';
import '../../elements/glass-icon.js';
import './home-header-editor.js';

export interface HomeHeaderConfig extends LovelaceCardConfig {
  /** The room whose temperature is the big number. Default: the first room with a sensor. */
  area?: string;
  /** Whose greeting and avatar. Default: the person linked to the signed-in user. */
  person?: string;
  /** Default: the first weather entity. */
  weather?: string;
}

/**
 * The top of Home: today's date, "Good evening, Liam" with your avatar and
 * whether you're home, then one room's temperature as the hero number with
 * chips for the room, outside and humidity.
 */
@customElement('glass-home-header')
export class GlassHomeHeader extends GlassElement {
  protected static arriveAs = 'fade' as const;
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: HomeHeaderConfig;
  @state() private now = new Date();
  private timer?: number;
  private lastKey = '';

  static getConfigElement() {
    return document.createElement('glass-home-header-editor');
  }

  static getStubConfig(): Partial<HomeHeaderConfig> {
    return {};
  }

  setConfig(config: HomeHeaderConfig): void {
    this.config = config;
  }

  getCardSize(): number {
    return 4;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    ensureFonts();
    // The date and greeting change with the clock.
    this.timer = window.setInterval(() => (this.now = new Date()), 60_000);
  }

  disconnectedCallback(): void {
    window.clearInterval(this.timer);
    super.disconnectedCallback();
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has('hass') || changed.size > 1 || !this.config) return true;
    const key = JSON.stringify(this.view());
    if (key === this.lastKey) return false;
    this.lastKey = key;
    return true;
  }

  private person(): HassEntity | undefined {
    const hass = this.hass!;
    if (this.config?.person) return hass.states[this.config.person];
    return Object.values(hass.states).find(
      (e) => e.entity_id.startsWith('person.') && e.attributes.user_id && e.attributes.user_id === hass.user?.id,
    );
  }

  private view() {
    const hass = this.hass!;
    const person = this.person();
    const name = String(person?.attributes.friendly_name ?? hass.user?.name ?? '').split(' ')[0];
    const areaId =
      this.config?.area ??
      Object.keys(hass.areas ?? {}).find((id) => roomSummary(hass, id).temperature !== undefined);
    const room = areaId ? roomSummary(hass, areaId) : undefined;
    const weather = this.config?.weather
      ? hass.states[this.config.weather]
      : Object.values(hass.states).find((e) => e.entity_id.startsWith('weather.'));
    const outside = weather?.attributes.temperature;
    return {
      name,
      picture: person?.attributes.entity_picture as string | undefined,
      home: person ? person.state === 'home' : undefined,
      personId: person?.entity_id,
      room: room?.name,
      temperature: room?.temperature,
      humidity: room?.humidity,
      outside: typeof outside === 'number' ? Math.round(outside) : undefined,
    };
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const v = this.view();
    const date = this.now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
    const [whole, decimal] = v.temperature !== undefined ? v.temperature.toFixed(1).split('.') : [];

    return html`
      <header>
        <span class="hello">
          <span class="date">${date}</span>
          <span class="greeting">${greeting(this.now)}${v.name ? `, ${v.name}` : ''}</span>
        </span>
        ${v.personId
          ? html`<button
              type="button"
              class="avatar"
              style=${v.picture ? `background-image: url("${v.picture}")` : ''}
              aria-label="${v.name}, ${v.home ? 'home' : 'away'}. Open profile"
              @click=${() => openMoreInfo(this, v.personId!)}
            >
              ${v.picture ? nothing : v.name.charAt(0)}
              <span class="presence ${v.home ? 'home' : 'away'}" aria-hidden="true"></span>
            </button>`
          : nothing}
      </header>
      ${whole !== undefined
        ? html`<section aria-label="${v.room} temperature">
            <span class="hero"><span>${whole}</span><span class="decimal">.${decimal}°</span></span>
            <span class="chips">
              <span class="chip subject">${v.room}</span>
              ${v.outside !== undefined
                ? html`<span class="chip"><glass-icon name="cloud" size="14" stroke="1.8"></glass-icon>${v.outside}° outside</span>`
                : nothing}
              ${v.humidity !== undefined
                ? html`<span class="chip"><glass-icon name="droplet" size="14" stroke="1.8"></glass-icon>${Math.round(v.humidity)}%</span>`
                : nothing}
            </span>
          </section>`
        : nothing}
    `;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .hello {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .date {
        font-size: var(--glass-text-chip);
        color: var(--glass-text-muted);
      }
      .greeting {
        font-size: 24px;
        letter-spacing: -0.3px;
      }
      .avatar {
        all: unset;
        position: relative;
        box-sizing: border-box;
        width: 48px;
        height: 48px;
        flex: none;
        border-radius: 50%;
        border: 2px solid var(--glass-solid);
        background: var(--glass-ink) center / cover;
        color: var(--glass-on-ink);
        font-size: var(--glass-text-tile-title);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 6px 20px rgba(20, 20, 40, 0.08);
        cursor: pointer;
      }
      .avatar:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      .presence {
        position: absolute;
        right: -1px;
        bottom: -1px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid var(--glass-ground);
        background: #8a8d94;
      }
      .presence.home {
        background: #2fa84f;
      }
      section {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .hero {
        display: flex;
        align-items: flex-start;
        line-height: 0.9;
        font-size: 104px;
        font-weight: 200;
        letter-spacing: -4px;
      }
      .decimal {
        color: #8a8d94;
      }
      .chips {
        display: flex;
        gap: 6px;
        white-space: nowrap;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .chip {
        flex: none;
        height: 32px;
        padding: 0 12px;
        border-radius: 16px;
        background: rgba(var(--glass-surface-rgb), 0.7);
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: var(--glass-text-caption);
      }
      .chip.subject {
        background: var(--glass-ink);
        color: var(--glass-on-ink);
      }
    `,
  ];
}

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

registerCard({
  type: 'glass-home-header',
  name: 'Glass · Home header',
  description: 'Date, greeting and your avatar, then one room’s temperature as the big number.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-home-header': GlassHomeHeader;
  }
}

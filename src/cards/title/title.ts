import { css, html, nothing } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, registerCard } from '../../ha.js';
import './title-editor.js';

export interface TitleConfig extends LovelaceCardConfig {
  title: string;
  /** Tabs under the title that jump to a card on this screen, e.g. { name: Energy, card: glass-electricity }. */
  tabs?: { name: string; card: string }[];
}

/** The first element with this tag anywhere on the page, looking inside every card's shadow root. */
function findDeep(root: Document | ShadowRoot | Element, tag: string): Element | undefined {
  const direct = root.querySelector(tag);
  if (direct) return direct;
  for (const el of root.querySelectorAll('*')) {
    const found = el.shadowRoot ? findDeep(el.shadowRoot, tag) : undefined;
    if (found) return found;
  }
  return undefined;
}

/**
 * A screen's title, in the pack's Screen title style ("Heating & Energy"),
 * with optional tabs underneath that scroll to each section.
 */
@customElement('glass-title')
export class GlassTitle extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: TitleConfig;
  @state() private current = 0;

  static getConfigElement() {
    return document.createElement('glass-title-editor');
  }

  static getStubConfig(): Partial<TitleConfig> {
    return { title: 'Heating & Energy' };
  }

  setConfig(config: TitleConfig): void {
    if (!config.title) throw new Error('Enter a title');
    this.config = config;
  }

  getCardSize(): number {
    return 1;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 3 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    ensureFonts();
  }

  // The title never depends on HA's state.
  protected shouldUpdate(changed: Map<string, unknown>): boolean {
    return changed.has('config') || changed.has('current');
  }

  private jump(i: number, card: string) {
    this.current = i;
    findDeep(document, card.replace(/^custom:/, ''))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  render() {
    if (!this.config) return nothing;
    const tabs = this.config.tabs ?? [];
    return html`<h1>${this.config.title}</h1>
      ${tabs.length
        ? html`<nav aria-label="Sections">
            ${tabs.map(
              (t, i) =>
                html`<button type="button" class=${i === this.current ? 'on' : ''} aria-current=${i === this.current ? 'true' : 'false'} @click=${() => this.jump(i, t.card)}>
                  ${t.name}
                </button>`,
            )}
          </nav>`
        : nothing}`;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 16px;
        min-height: 48px;
      }
      h1 {
        margin: 0;
        min-height: 48px;
        display: flex;
        align-items: center;
        font-size: 28px;
        font-weight: 400;
        letter-spacing: -0.4px;
      }
      nav {
        display: flex;
        gap: 8px;
      }
      button {
        all: unset;
        box-sizing: border-box;
        height: 40px;
        padding: 0 18px;
        border-radius: 20px;
        border: 1px solid var(--glass-surface-border);
        background: rgba(var(--glass-surface-rgb), 0.7);
        font-size: var(--glass-text-chip);
        display: flex;
        align-items: center;
        cursor: pointer;
      }
      button.on {
        border-color: var(--glass-ink);
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

registerCard({
  type: 'glass-title',
  name: 'Glass · Screen title',
  description: 'A screen’s title in the pack’s style, with optional tabs that jump to each section.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-title': GlassTitle;
  }
}

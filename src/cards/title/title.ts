import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, registerCard } from '../../ha.js';
import './title-editor.js';

export interface TitleConfig extends LovelaceCardConfig {
  title: string;
}

/** A screen's title, in the pack's Screen title style ("Heating & Energy"). */
@customElement('glass-title')
export class GlassTitle extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: TitleConfig;

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
    return changed.has('config');
  }

  render() {
    return this.config ? html`<h1>${this.config.title}</h1>` : nothing;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: flex;
        align-items: center;
        min-height: 48px;
      }
      h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 400;
        letter-spacing: -0.4px;
      }
    `,
  ];
}

registerCard({
  type: 'glass-title',
  name: 'Glass · Screen title',
  description: 'A screen’s title in the pack’s style.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-title': GlassTitle;
  }
}

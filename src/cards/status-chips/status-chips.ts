import { css, html, nothing, type PropertyValues } from 'lit';
import { GlassElement } from '../../glass-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from '../../tokens.js';
import { ensureFonts } from '../../fonts.js';
import { type HomeAssistant, type LovelaceCardConfig, navigate, registerCard } from '../../ha.js';
import type { IconName } from '../../icons.js';
import { lightsByArea, roomSummary, shortName } from '../../rooms.js';
import { GlassSheet } from '../../elements/glass-sheet.js';
import type { GlassLightsSheet } from '../../sheets/lights-sheet.js';
import type { GlassTempsSheet } from '../../sheets/temps-sheet.js';
import { LOW_BATTERY, batteries } from '../../batteries.js';
import { batteryIcon } from '../../climate.js';
import { type PrinterEntities, printerState } from '../../printer.js';
import type { GlassPrinterSheet } from '../../sheets/printer-sheet.js';
import '../../sheets/printer-sheet.js';
import '../../sheets/lights-sheet.js';
import '../../sheets/temps-sheet.js';
import '../../sheets/batteries-sheet.js';
import '../../elements/glass-icon.js';
import './status-chips-editor.js';
import { attentionStyles } from '../../motion.js';

export interface StatusChipsConfig extends LovelaceCardConfig, PrinterEntities {
  /** The printer's short name for its chip, e.g. "P1S". */
  printer_name?: string;
  /** Where an open-door chip goes, e.g. the Security view. */
  security_path?: string;
  /** Where the temperatures pop-up's "Go to Heating & Energy" goes. */
  energy_path?: string;
  exclude_areas?: string[];
}

interface Chip {
  key: string;
  label: string;
  icon: IconName;
  iconBg: string;
  attention?: boolean;
  onTap?: () => void;
}

const OPENINGS = new Set(['door', 'window', 'garage_door', 'opening']);

/**
 * Home's row of status chips, each a summary that opens more detail:
 * an open door (first, in peach, only while something is open), lights on,
 * the spread of room temperatures, low batteries, and a 3D printer while it
 * prints and for two hours after. One line; scrolls sideways.
 */
@customElement('glass-status-chips')
export class GlassStatusChips extends GlassElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: StatusChipsConfig;

  private sheet?: GlassSheet;
  private lastKey = '';

  static getConfigElement() {
    return document.createElement('glass-status-chips-editor');
  }

  static getStubConfig(): Partial<StatusChipsConfig> {
    return {};
  }

  setConfig(config: StatusChipsConfig): void {
    this.config = config;
  }

  getCardSize(): number {
    return 1;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    ensureFonts();
  }

  disconnectedCallback(): void {
    this.sheet?.close();
    super.disconnectedCallback();
  }

  // Re-render only when what the chips say changes; keep an open sheet current.
  protected shouldUpdate(changed: PropertyValues): boolean {
    if (this.sheet?.isConnected && this.hass) this.sheet.hass = this.hass;
    if (changed.has('config') || !this.hass) return true;
    const key = this.chips()
      .map((c) => c.label)
      .join('|');
    if (key === this.lastKey) return false;
    this.lastKey = key;
    return true;
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    return html`<nav aria-label="Status">
      ${this.chips().map(
        (c) => html`<button
          type="button"
          class="chip ${c.attention ? 'attention' : ''} ${c.key === 'open' ? 'ringing' : ''}"
          ?disabled=${!c.onTap}
          @click=${c.onTap}
        >
          <span class="icon" style="background: ${c.iconBg}; color: ${c.iconBg.includes('neutral') ? 'var(--glass-ink)' : '#121316'}"><glass-icon name=${c.icon} size="15" stroke="1.8"></glass-icon></span>
          ${c.label}
        </button>`,
      )}
    </nav>`;
  }

  private chips(): Chip[] {
    const hass = this.hass!;
    const exclude = this.config?.exclude_areas ?? [];
    const chips: Chip[] = [];

    const open = Object.keys(hass.states).filter(
      (id) =>
        id.startsWith('binary_sensor.') &&
        !hass.entities?.[id]?.hidden &&
        OPENINGS.has(hass.states[id].attributes.device_class) &&
        hass.states[id].state === 'on',
    );
    if (open.length) {
      const path = this.config?.security_path;
      chips.push({
        key: 'open',
        label: open.length === 1 ? `${sentence(shortName(hass.states[open[0]], ''))} open` : `${open.length} doors open`,
        icon: 'door-open',
        iconBg: '#F7C2A4',
        attention: true,
        onTap: path ? () => navigate(path) : undefined,
      });
    }

    const lightsOn = lightsByArea(hass, exclude)
      .flatMap((g) => g.lights)
      .filter((l) => l.on).length;
    chips.push({
      key: 'lights',
      label: lightsOn === 1 ? '1 light on' : lightsOn ? `${lightsOn} lights on` : 'All lights off',
      icon: 'lightbulb',
      iconBg: lightsOn ? 'var(--glass-accent)' : 'var(--glass-neutral-tint)',
      onTap: () => this.openLights(),
    });

    const temps = Object.values(hass.areas ?? {})
      .filter((a) => !exclude.includes(a.area_id))
      .map((a) => roomSummary(hass, a.area_id).temperature)
      .filter((t): t is number => t !== undefined)
      .map(Math.round);
    if (temps.length) {
      const lo = Math.min(...temps);
      const hi = Math.max(...temps);
      chips.push({
        key: 'temps',
        label: lo === hi ? `Rooms ${lo}°` : `Rooms ${lo}–${hi}°`,
        icon: 'thermometer',
        iconBg: '#F7C2A4',
        onTap: () => this.openSheet<GlassTempsSheet>('glass-temps-sheet', (s) => (s.energyPath = this.config?.energy_path)),
      });
    }

    const all = batteries(hass);
    if (all.length) {
      const low = all.filter((b) => b.level < LOW_BATTERY).length;
      chips.push({
        key: 'batteries',
        label: low === 1 ? '1 low battery' : low ? `${low} low batteries` : 'Batteries OK',
        icon: batteryIcon(all[0].level),
        iconBg: '#CDB8F5',
        onTap: () => this.openSheet('glass-batteries-sheet'),
      });
    }

    const p = this.config?.printer_status ? printerState(hass, this.config) : undefined;
    if (p?.showFull) {
      const name = this.config!.printer_name ?? '3D printer';
      const active = p.phase === 'printing' || p.phase === 'paused';
      chips.push({
        key: 'printer',
        label: active
          ? [name, p.progress !== undefined ? `${Math.round(p.progress)}%` : '', p.phase === 'paused' ? 'paused' : p.left].filter(Boolean).join(' · ')
          : `${name} ${p.phase === 'failed' ? 'failed' : 'done'}`,
        icon: 'printer',
        iconBg: active ? '#9CC3F2' : p.phase === 'failed' ? '#F7C2A4' : '#9FE3B0',
        onTap: () =>
          this.openSheet<GlassPrinterSheet>('glass-printer-sheet', (s) => {
            s.printer = this.config!;
            s.entityId = this.config!.printer_status!;
          }),
      });
    }

    return chips;
  }

  private openLights() {
    this.openSheet<GlassLightsSheet>('glass-lights-sheet');
  }

  /** Opens one sheet at a time; every sheet gets the card's excluded areas where it uses them. */
  private openSheet<T extends GlassSheet>(tag: string, setup?: (sheet: T) => void) {
    if (this.sheet?.isConnected) return;
    const sheet = GlassSheet.open<T>(tag, this.hass!);
    (sheet as unknown as { excludeAreas?: string[] }).excludeAreas = this.config?.exclude_areas ?? [];
    setup?.(sheet);
    this.sheet = sheet;
  }

  static styles = [
    tokens,
    attentionStyles,
    css`
      :host {
        display: block;
      }
      nav {
        display: flex;
        gap: var(--glass-space-chip);
        overflow-x: auto;
        scrollbar-width: none;
      }
      nav::-webkit-scrollbar {
        display: none;
      }
      .chip {
        all: unset;
        flex: none;
        box-sizing: border-box;
        height: 40px;
        padding: 0 14px 0 6px;
        border-radius: 20px;
        background: rgba(var(--glass-surface-rgb), 0.55);
        border: 1px solid var(--glass-surface-border);
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: var(--glass-text-chip);
        white-space: nowrap;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .chip:disabled {
        cursor: default;
      }
      .chip.attention {
        background: var(--glass-attention-tint);
        border-color: var(--glass-attention-edge);
      }
      .chip:focus-visible {
        outline: 2px solid var(--glass-ink);
        outline-offset: 2px;
      }
      .icon {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `,
  ];
}

/** "Back Door" → "Back door". */
function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

registerCard({
  type: 'glass-status-chips',
  name: 'Glass · Status chips',
  description: 'Open doors, lights on, room temperatures and low batteries, in one scrolling row.',
});

declare global {
  interface HTMLElementTagNameMap {
    'glass-status-chips': GlassStatusChips;
  }
}

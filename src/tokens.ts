import { css } from 'lit';

/**
 * Design tokens from the canvas's Design system frame.
 * Every value is a CSS custom property with a --glass- prefix, so a theme
 * (or a user's card-level style) can override any of them.
 */
export const tokens = css`
  :host {
    /* Ink & surfaces */
    --glass-ink: #121316;
    --glass-text-secondary: #45484f;
    --glass-text-muted: #5f626a;
    --glass-ground: #edeef1;
    --glass-surface: rgba(255, 255, 255, 0.72);
    --glass-surface-border: rgba(255, 255, 255, 0.95);
    --glass-inset: #f6f6f8;
    --glass-hairline: rgba(18, 19, 22, 0.08);

    /* Accent & status */
    --glass-accent: #c6f432;
    --glass-go: #2fb457;
    --glass-success-tint: #e4f6e8;
    --glass-attention: #e0683a;
    --glass-attention-tint: #fcede6;
    --glass-info: #3b7dd8;

    /* Light tiles */
    --glass-light-default: #f6e3b0;
    --glass-light-default-glow: 247, 198, 107;
    --glass-light-warm: #fbeedb;
    --glass-light-warm-glow: 240, 200, 150;
    --glass-light-cool: #eef2f8;
    --glass-light-cool-glow: 170, 190, 220;
    --glass-light-off: rgba(255, 255, 255, 0.5);

    /* Radius */
    --glass-radius-inset: 16px;
    --glass-radius-small-tile: 24px;
    --glass-radius-tile: 28px;
    --glass-radius-card: 32px;
    --glass-radius-sheet: 40px;

    /* Spacing */
    --glass-space-chip: 8px;
    --glass-space-tile-gap: 12px;
    --glass-space-tile: 16px;
    --glass-space-edge: 20px;

    /* Type */
    --glass-font: 'Outfit', system-ui, sans-serif;
    --glass-text-tile-title: 17px;
    --glass-text-body: 15px;
    --glass-text-chip: 14px;
    --glass-text-caption: 13px;
    --glass-text-small: 12px;
    --glass-text-tiny: 11px;

    font-family: var(--glass-font);
    color: var(--glass-ink);
    -webkit-font-smoothing: antialiased;
  }
`;

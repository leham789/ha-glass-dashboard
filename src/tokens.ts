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
    --glass-solid: #fff; /* opaque card, row or button */
    --glass-raised: #fff; /* the selected option in a segmented control */
    --glass-sheet: rgba(248, 248, 250, 0.86);
    --glass-neutral-tint: #f1f1f4;
    --glass-on-ink: #fff; /* text and icons on an ink button */
    --glass-surface-rgb: 255, 255, 255; /* rgba(var(--glass-surface-rgb), a) surfaces */
    --glass-line-rgb: 18, 19, 22; /* rgba(var(--glass-line-rgb), a) lines, tracks, outlines */

    /* Accent & status */
    --glass-accent: #c6f432;
    --glass-go: #2fb457;
    --glass-success-tint: #e4f6e8;
    --glass-success-ink: #1e6e36;
    --glass-attention: #e0683a;
    --glass-attention-tint: #fcede6;
    --glass-attention-ink: #8a3a1c;
    --glass-attention-edge: #f2b8a2;
    --glass-info: #3b7dd8;
    --glass-info-tint: #e3eefb;
    --glass-info-ink: #1f4e8c;

    /* Light tiles */
    --glass-light-default: #f6e3b0;
    --glass-light-default-glow: 247, 198, 107;
    --glass-light-warm: #fbeedb;
    --glass-light-warm-glow: 240, 200, 150;
    --glass-light-cool: #eef2f8;
    --glass-light-cool-glow: 170, 190, 220;
    --glass-light-off: rgba(255, 255, 255, 0.5);
    --glass-light-fill: linear-gradient(90deg, #f6e3b0 0%, #f7c66b 100%); /* brightness fills */

    /* Room tiles */
    --glass-room-lit: rgba(255, 255, 255, 0.88);
    --glass-room-off: rgba(255, 255, 255, 0.4);
    --glass-room-alert: rgba(252, 237, 230, 0.9);
    --glass-attention-text: #9a3e22;
    --glass-tile-shadow: 0 10px 30px rgba(30, 20, 60, 0.06);

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

  /* Dark mode: set by GlassElement when HA's dark theme is on. Surfaces, ink,
     lines and status tints flip; the accent, status colours, light-tile colours
     and the heating / energy gradients stay the same. */
  :host([dark]) {
    --glass-ink: #f2f3f5;
    --glass-text-secondary: #c4c7ce;
    --glass-text-muted: #9a9ea8;
    --glass-ground: #141518;
    --glass-surface: rgba(40, 42, 48, 0.72);
    --glass-surface-border: rgba(255, 255, 255, 0.08);
    --glass-inset: #22242a;
    --glass-hairline: rgba(255, 255, 255, 0.08);
    --glass-solid: #26282e;
    --glass-raised: rgba(255, 255, 255, 0.16);
    --glass-sheet: rgba(28, 30, 34, 0.94);
    --glass-neutral-tint: rgba(255, 255, 255, 0.08);
    --glass-on-ink: #121316;
    --glass-surface-rgb: 40, 42, 48;
    --glass-line-rgb: 255, 255, 255;

    --glass-success-tint: rgba(47, 180, 87, 0.18);
    --glass-success-ink: #7fdb9a;
    --glass-attention-tint: rgba(224, 104, 58, 0.2);
    --glass-attention-ink: #f4a47f;
    --glass-attention-edge: rgba(224, 104, 58, 0.45);
    --glass-info-tint: rgba(59, 125, 216, 0.22);
    --glass-info-ink: #9cc3f2;

    --glass-light-off: rgba(40, 42, 48, 0.5);
    --glass-light-fill: linear-gradient(90deg, rgba(246, 227, 176, 0.22) 0%, rgba(247, 198, 107, 0.42) 100%);
    --glass-room-lit: rgba(40, 42, 48, 0.88);
    --glass-room-off: rgba(40, 42, 48, 0.4);
    --glass-room-alert: rgba(224, 104, 58, 0.2);
    --glass-attention-text: #f4a47f;
    --glass-tile-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);

    color-scheme: dark;
  }
`;

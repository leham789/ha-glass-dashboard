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
    --glass-on-dark: #fff; /* a button on a dark card (the dark Media card's play); the same in both themes */
    --glass-on-dark-ink: #121316; /* its icon */
    --glass-dark: #2a2d33; /* dark cards, artwork and camera placeholders, the dark secondary button; the same in both themes */
    --glass-dark-2: #4a4e57; /* its lighter end, and a dark button that's on */
    --glass-dark-surface: linear-gradient(135deg, #2a2d33 0%, #4a4e57 100%); /* the dark card: Media, Camera, 3D printer */
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
    --glass-colour-fill-from: 1; /* a slider in a bulb's colour: its soft tint's alpha… */
    --glass-colour-fill-to: 1; /* …and the colour's */

    /* Room tiles */
    --glass-room-lit: rgba(255, 255, 255, 0.88);
    --glass-room-off: rgba(255, 255, 255, 0.4);
    --glass-room-alert: rgba(252, 237, 230, 0.9);
    --glass-attention-text: #9a3e22;
    --glass-tile-shadow: 0 10px 30px rgba(30, 20, 60, 0.06);
    --glass-float-shadow: 0 16px 40px rgba(20, 20, 40, 0.16); /* things floating over the page: the connection banner */
    --glass-sheet-shadow: 0 -20px 60px rgba(20, 20, 40, 0.15);
    --glass-raised-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); /* the chosen segment */
    --glass-seek-shadow: 0 2px 8px rgba(0, 0, 0, 0.12); /* the seek bar's knob */
    --glass-knob: #fff; /* switch knobs and slider markers, in both themes */
    --glass-knob-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
    --glass-marker-shadow: 0 0 0 1px rgba(18, 19, 22, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15);
    --glass-dim: rgba(18, 19, 22, 0.25); /* the screen behind a pop-up */

    /* Pastels: icon circles on chips and pop-ups, and the dark icon on them (same in both themes) */
    --glass-peach: #f7c2a4;
    --glass-lilac: #cdb8f5;
    --glass-blue: #9cc3f2;
    --glass-mint: #9fe3b0;
    --glass-amber: #f7d9a0;
    --glass-on-pastel: #121316;
    --glass-grey: #8a8d94; /* offline dots, away, grey decimals */
    --glass-live: #ff5a4e; /* the live badge's dot */
    --glass-scrim: rgba(0, 0, 0, 0.45); /* controls on a camera picture */
    --glass-on-picture: #fff;
    --glass-on-picture-muted: rgba(255, 255, 255, 0.65);
    --glass-on-picture-soft: rgba(255, 255, 255, 0.85); /* words on a picture (the last motion) */
    --glass-on-picture-hint: rgba(255, 255, 255, 0.45); /* the hint under a full-screen picture */
    --glass-on-picture-dot: rgba(255, 255, 255, 0.35); /* full screen's other page dots */
    --glass-on-picture-glass: rgba(255, 255, 255, 0.14); /* full screen's buttons and pills, with a blur */
    --glass-on-picture-button: rgba(255, 255, 255, 0.9); /* the light button on a picture */
    --glass-on-light: #121316; /* words on the light-on colour, in both themes */
    --glass-full-screen: #000; /* behind a full-screen camera */
    --glass-on-go: #fff; /* the icon on a go-green knob */
    --glass-go-shadow: 0 8px 20px rgba(47, 180, 87, 0.35);
    --glass-hot-tint: #fde7e7;
    --glass-hot-ink: #9b1c1c;

    /* Fills */
    --glass-energy: linear-gradient(160deg, #7e9a2c 0%, #a6c23a 55%, #d2ee6a 100%); /* electricity cards and tiles */
    --glass-gas: linear-gradient(160deg, #c98579 0%, #b0675e 55%, #c59a72 100%); /* gas and heating */
    --glass-temp-scale: linear-gradient(90deg, #cfe3f7 0%, #e9f3d2 40%, #e9f3d2 60%, #f7c2a4 100%); /* cold, a flat comfort band, warm */
    --glass-humidity-scale: linear-gradient(90deg, #f3e2be 0%, #e9f3d2 40%, #e9f3d2 60%, #cfe3f7 100%); /* sandy Dry, green Comfy (40–60), blue Damp */
    --glass-chart-dot: #121316; /* a filled dot on a coloured card (energy, gas), both themes */
    --glass-chart-dot-empty: rgba(255, 255, 255, 0.35); /* an empty one */
    --glass-on-chart-dot: #fff; /* the icon on Energy today's dark disc */
    --glass-gas-ink: #fff; /* words on the gas card, both themes */
    --glass-energy-bar: #a6c23a; /* electricity's bars in the history chart (the Energy pop-up) */
    --glass-gas-bar: #c98579; /* gas's */
    --glass-kelvin-scale: linear-gradient(90deg, #ffb46b 0%, #ffd9a8 30%, #fff1de 55%, #f2f4ff 80%, #d9e5ff 100%);
    --glass-hue-scale: linear-gradient(90deg, hsl(0, 80%, 62%), hsl(60, 80%, 62%), hsl(120, 80%, 62%), hsl(180, 80%, 62%), hsl(240, 80%, 62%), hsl(300, 80%, 62%), hsl(360, 80%, 62%));
    --glass-dial-cool: #9cc3f2;
    --glass-dial-mid: #f7c66b;
    --glass-dial-warm: #e0683a;
    --glass-swatch-warm: #f5b866;
    --glass-swatch-neutral: #f6e7c8;
    --glass-swatch-cool: #cfe3f7;
    --glass-swatch-colour: conic-gradient(#f59aa0, #f7d58c, #9fe3b0, #9cc3f2, #cdb8f5, #f59aa0);

    /* Scene tiles, by the scene's name (pastel in both themes) */
    --glass-scene-focus: linear-gradient(160deg, #e8f1ff 0%, #a9c6ee 100%);
    --glass-scene-day: linear-gradient(160deg, #ffffff 0%, #dce7f5 100%);
    --glass-scene-bright: linear-gradient(160deg, #fff8e6 0%, #f6e3b0 100%);
    --glass-scene-read: linear-gradient(160deg, #fff1d6 0%, #f7d58c 100%);
    --glass-scene-relax: linear-gradient(160deg, #f7d58c 0%, #efa86a 100%);
    --glass-scene-night: linear-gradient(160deg, #e0683a 0%, #8a3a1c 100%);
    --glass-scene-party: linear-gradient(160deg, #9cc3f2 0%, #cdb8f5 50%, #f59aa0 100%);
    --glass-scene-default: linear-gradient(160deg, #ffffff 0%, #edeef1 100%);

    /* Bins, by the bin's name */
    --glass-bin-green: #4fa65b;
    --glass-bin-red: #d9473a;
    --glass-bin-blue: #3b7dd8;
    --glass-bin-brown: #8a5a3b;
    --glass-bin-yellow: #e5b22d;

    /* Radius */
    --glass-radius-inset: 16px;
    --glass-radius-small-tile: 24px;
    --glass-radius-tile: 28px;
    --glass-radius-card: 32px;
    --glass-radius-sheet: 40px;

    /* Tile heights (the Sizing frame): only these three */
    --glass-height-small-tile: 92px;
    --glass-height-tile: 132px;
    --glass-height-room-tile: 176px;

    /* Spacing */
    --glass-space-chip: 8px;
    --glass-space-tile-gap: 12px;
    --glass-space-tile: 16px;
    --glass-space-small-tile: 12px;
    --glass-space-edge: 20px;

    /* Type */
    --glass-font: 'Outfit', system-ui, sans-serif;
    --glass-text-heading: 20px; /* section headings and pop-up titles */
    --glass-text-tile-title: 17px;
    --glass-text-body: 15px;
    --glass-text-chip: 14px;
    --glass-text-caption: 13px;
    --glass-text-small: 12px;
    --glass-text-tiny: 11px;

    /* Numbers (Library: Numbers and meters): nine sizes, and the units after the big ones */
    --glass-number-hero: 104px;
    --glass-number-display: 88px;
    --glass-number-display-s: 72px;
    --glass-number-dial: 64px;
    --glass-number-dial-s: 56px;
    --glass-number-stat-l: 44px;
    --glass-number-stat-m: 40px;
    --glass-number-stat-s: 32px;
    --glass-number-small: 22px;
    --glass-number-unit-hero: 32px;
    --glass-number-unit: 22px; /* after a display or dial number; a stat's unit is Body 15 */

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
    --glass-colour-fill-from: 0.22; /* see-through, like the light fill */
    --glass-colour-fill-to: 0.42;
    --glass-room-lit: rgba(40, 42, 48, 0.88);
    --glass-room-off: rgba(40, 42, 48, 0.4);
    --glass-room-alert: rgba(224, 104, 58, 0.2);
    --glass-attention-text: #f4a47f;
    --glass-tile-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
    --glass-float-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
    --glass-dim: rgba(0, 0, 0, 0.5); /* darker behind a pop-up in dark mode, as on iPhone */

    color-scheme: dark;
  }

  /* No reading: the short grey dash (elements/nil.ts) */
  .nil {
    display: inline-block;
    width: 0.5em;
    height: max(2px, 0.05em);
    border-radius: 1px;
    color: var(--glass-text-muted);
    background: currentColor;
    vertical-align: 0.33em;
  }
`;

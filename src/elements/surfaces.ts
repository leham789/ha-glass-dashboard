import { css } from 'lit';

/**
 * The one card and tile surfaces (Library: Surfaces and lists). Each is a
 * block of declarations, interpolated into a card's own rule:
 *
 *   section { ${cardSurface} border-radius: var(--glass-radius-card); … }
 *
 * The radius stays in the card's rule, since tiles come in two radii.
 * Change the look here and every card and tile follows.
 */

/** Glass card: the --glass-surface fill, its edge, blur 24 and the one card shadow. */
export const cardSurface = css`
  background: var(--glass-surface);
  border: 1px solid var(--glass-surface-border);
  box-shadow: var(--glass-tile-shadow);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
`;

/** Glass tile (tile or small tile): the same fill and edge, blur 20 and the one shadow. */
export const tileSurface = css`
  background: var(--glass-surface);
  border: 1px solid var(--glass-surface-border);
  box-shadow: var(--glass-tile-shadow);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
`;

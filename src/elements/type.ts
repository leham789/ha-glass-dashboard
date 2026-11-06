import { css } from 'lit';

/**
 * The one Heading style (Type frame): section headings and pop-up titles,
 * 20 Regular. Interpolate into the heading's rule: h2 { ${heading} }.
 * The gap under a heading is 12 everywhere (--glass-space-tile-gap).
 */
export const heading = css`
  margin: 0;
  font-size: var(--glass-text-heading);
  font-weight: 400;
`;

// Outfit (latin, variable weight) is bundled into the pack, so cards work
// offline and nothing is fetched from Google. Fonts can't be declared inside
// a shadow root, so the @font-face is added to the page once.
import outfitLatin from '@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2?inline';

const STYLE_ID = 'glass-dashboard-fonts';

export function ensureFonts(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-display: swap;
  font-weight: 100 900;
  src: url(${outfitLatin}) format('woff2-variations');
}`;
  document.head.appendChild(style);
}

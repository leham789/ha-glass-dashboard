// Fonts can't be declared inside a shadow root, so Outfit is added to the
// page once, the first time any card renders.
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500&display=swap';

export function ensureFonts(): void {
  if (document.head.querySelector(`link[href="${FONT_HREF}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONT_HREF;
  document.head.appendChild(link);
}

import { css } from 'lit';

/**
 * Motion and haptics, as on the canvas's Motion frame. Short and quiet:
 * nothing bounces, and loops only run while something is waiting.
 */

/** The one curve for everything that moves: fast out, soft landing. */
export const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

export const reducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// ── Press: whatever you press shrinks to 97% ──────────────────────────────

/**
 * For a pointerdown anywhere in a card or sheet: the button or link under
 * the finger shrinks to 97% and comes back on release. It animates the CSS
 * `scale` property, so it adds to any transform the element already has and
 * leaves its own transitions alone. `data-no-press` opts an element out
 * (something you drag, like the Goodnight knob). A card-wide `.open` button
 * is invisible, so pressing it shrinks the card it covers instead.
 */
export function press(e: PointerEvent): void {
  if (e.button !== 0 || reducedMotion()) return;
  const el = e
    .composedPath()
    .find((n): n is HTMLElement => n instanceof HTMLElement && n.matches('button, a[href]'));
  if (!el?.animate || el.matches(':disabled, [data-no-press]')) return;
  const target = el.classList.contains('open') && el.parentElement ? el.parentElement : el;
  const down = target.animate([{ scale: '1' }, { scale: '0.97' }], { duration: 100, easing: 'ease', fill: 'forwards' });
  const up = () => {
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    down.reverse();
    down.finished.then(() => down.cancel()).catch(() => undefined);
  };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

// ── Sweep: a light's colour spreading out from where you tapped ───────────

/**
 * Lays `background` over `el` and grows it from (x, y), then takes it away,
 * leaving `el`'s own new background showing. `el` must be position: relative
 * (or absolute) with overflow: hidden; its content should sit above z-index 0.
 */
export function sweep(el: HTMLElement, x: number, y: number, background: string): void {
  if (reducedMotion() || !el.animate) return;
  const layer = document.createElement('span');
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, { position: 'absolute', inset: '0', background, pointerEvents: 'none', zIndex: '0', borderRadius: 'inherit' });
  el.prepend(layer);
  layer
    .animate([{ clipPath: `circle(0 at ${x}px ${y}px)` }, { clipPath: `circle(160% at ${x}px ${y}px)` }], { duration: 300, easing: EASE })
    .finished.finally(() => layer.remove());
}

// ── Roll: a number rolling to its new value ───────────────────────────────

/** Rolls `el` in from below (up = true) or above, as a number changes. */
export function roll(el: HTMLElement, up: boolean): void {
  if (!el.animate) return;
  const from = reducedMotion() ? 'none' : `translateY(${up ? 60 : -60}%)`;
  el.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }], { duration: 200, easing: EASE });
}

// ── Haptics ───────────────────────────────────────────────────────────────

export type Haptic = 'selection' | 'light' | 'medium' | 'success' | 'warning';

/**
 * Asks Home Assistant for a haptic. Its app turns this into the phone's own
 * taps, Chrome on Android buzzes, and it stays still when vibration is off in
 * the user's HA profile. Elsewhere nothing happens.
 */
export function haptic(type: Haptic): void {
  window.dispatchEvent(new CustomEvent('haptic', { detail: type, bubbles: true, composed: true }));
}

const sliderAt = new WeakMap<HTMLInputElement, number>();

/**
 * For input events anywhere in a card or sheet: a slider (range input) ticks
 * each tenth of its range it passes, and bumps on reaching either end.
 */
export function sliderHaptic(e: Event): void {
  const el = e.composedPath()[0];
  if (!(el instanceof HTMLInputElement) || el.type !== 'range') return;
  const min = Number(el.min || 0);
  const max = Number(el.max || 100);
  const to = Number(el.value);
  const from = sliderAt.get(el);
  sliderAt.set(el, to);
  if (from === undefined || from === to) return;
  const tenth = (max - min) / 10;
  if (to <= min || to >= max) haptic('medium');
  else if (Math.floor((from - min) / tenth) !== Math.floor((to - min) / tenth)) haptic('selection');
}

/** Remember where a slider starts, so its first move can tick. */
export function sliderStart(e: Event): void {
  const el = e.composedPath()[0];
  if (el instanceof HTMLInputElement && el.type === 'range') sliderAt.set(el, Number(el.value));
}

// ── Attention: a soft glow for 30 seconds ─────────────────────────────────

/**
 * Put `ringing` on a pill or chip that needs noticing (Motion, a door open).
 * A ring just inside its edge glows and fades for about 30 seconds from when
 * it appears, then rests. Only opacity animates, so it stays smooth on a
 * phone, and the ring sits inside the pill, so a scrolling row can't clip it.
 */
export const attentionStyles = css`
  /* Doubled class: beats a card's own "all: unset" on the same element. */
  .ringing.ringing {
    position: relative;
  }
  .ringing::after {
    content: '';
    position: absolute;
    inset: -1px; /* over the pill's own border */
    border-radius: inherit;
    box-shadow: inset 0 0 0 2px var(--glass-attention);
    pointer-events: none;
    opacity: 0;
    animation: glass-attention 1.6s ease-in-out 19;
  }
  @keyframes glass-attention {
    50% {
      opacity: 0.8;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ringing::after {
      animation: none;
    }
  }
`;

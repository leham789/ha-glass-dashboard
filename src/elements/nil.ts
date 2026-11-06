import { html } from 'lit';

/**
 * No reading: the short grey dash (Library: Numbers and meters). Use it
 * wherever HA has no value, never a typed "–" or "—"; the unit goes with it.
 * Its style lives in the shared tokens (.nil), so every card and pop-up has it.
 */
export const nil = html`<i class="nil" role="img" aria-label="No reading"></i>`;

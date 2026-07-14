const ANNOUNCER_ID = 'ngx-stack-announcer';

/**
 * Say a page's name out loud, once, to whoever is listening with a screen reader.
 *
 * A stack navigation is invisible to assistive tech: no document load, no focus change it can
 * infer meaning from — the DOM just quietly rearranges. A polite live region is the standard way
 * to give that back, and it's the same thing Angular's own `RouterOutlet` does not do for you.
 */
export function announce(doc: Document, message: string): void {
  let region = doc.getElementById(ANNOUNCER_ID);

  if (!region) {
    region = doc.createElement('div');
    region.id = ANNOUNCER_ID;
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    region.className = 'ngx-stack-announcer';
    doc.body.appendChild(region);
  }

  // Re-announcing the same string is a no-op for most screen readers, because the region's
  // content didn't change. Clearing first forces it to speak.
  region.textContent = '';
  region.textContent = message;
}

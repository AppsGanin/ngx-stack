const STYLE_ID = 'ngx-stack-styles';

/**
 * Page wrappers are created imperatively, outside any component template, so Angular's
 * style encapsulation can't reach them. These rules go in the document once instead.
 * Everything is driven by CSS custom properties so apps can restyle without `!important`.
 */
const CSS = `
.ngx-stack-host {
  display: block;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;

  /* Stop Chrome/Android turning a horizontal drag that is not an armed swipe into its own overscroll
     back-navigation, which would fire underneath the gesture and fight it. This is the one thing web
     content genuinely can do about a system gesture, and only on Android: iOS Safari's edge swipe is
     drawn by WebKit and no CSS or preventDefault suppresses it (that is what systemGesture is for,
     and why native shells are the easy target). Framework7 ships the same line for the same reason. */
  overscroll-behavior: none;
  /* Kills the 300ms double-tap-zoom delay without touching the pan/scroll the gesture relies on. */
  touch-action: manipulation;

  /* Notches, home indicators, and the Android navigation bar. Declared here so pages can just
     use var(--ngx-stack-safe-top) without every one of them repeating the env() dance — and so
     they still resolve to 0px on a browser that has never heard of a notch. */
  --ngx-stack-safe-top: env(safe-area-inset-top, 0px);
  --ngx-stack-safe-bottom: env(safe-area-inset-bottom, 0px);
  --ngx-stack-safe-left: env(safe-area-inset-left, 0px);
  --ngx-stack-safe-right: env(safe-area-inset-right, 0px);
}

/* Where page titles are announced to screen readers. Visually gone, but not display:none —
   which would take it out of the accessibility tree along with everything we're trying to say. */
.ngx-stack-announcer {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.ngx-stack-page {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: translateX(0);
  background: var(--ngx-stack-page-background, #fff);
  /* Only ever visible while the page is translated, i.e. mid-transition. */
  box-shadow: var(--ngx-stack-page-shadow, -6px 0 20px rgb(0 0 0 / 12%));
}

/* The routed component fills the wrapper and scrolls; the scrim sits on top of it.
   Wrapped in :where() so this weighs nothing: a page component only has to say
   ":host { display: flex }" to take the layout over, with no !important and no fight. */
:where(.ngx-stack-page > :not(.ngx-stack-scrim)) {
  flex: 1 1 auto;
  min-height: 0;
  display: block;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

/* Set while a page is being created, so it can't flash at its final position for a frame
   before the transition's first keyframe lands. */
.ngx-stack-page--invisible {
  opacity: 0;
}

.ngx-stack-page--animating {
  will-change: transform;
}

/* Buried pages — and, with tabs, every page of every inactive tab. content-visibility:hidden
   skips their rendering while preserving internal state (crucially, scroll offsets), so coming
   back to a page finds it exactly where you left it with no scroll-restoration bookkeeping on
   our side. They stay in the DOM: that is what makes a tab switch instant and a swipe possible. */
.ngx-stack-page--hidden {
  visibility: hidden;
  pointer-events: none;
  content-visibility: hidden;
}

/* Focused programmatically after a transition; never show a ring for it. */
.ngx-stack-page:focus {
  outline: none;
}

.ngx-stack-scrim {
  position: absolute;
  inset: 0;
  z-index: 10;
  opacity: 0;
  pointer-events: none;
  background: var(--ngx-stack-scrim-color, #000);
}
`;

/** Idempotent: safe to call from every outlet on every init. */
export function ensureStackStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}

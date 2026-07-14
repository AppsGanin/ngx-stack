import type { Route, Routes } from '@angular/router';

/** Split a URL into path segments, dropping the query and fragment. */
function segmentsOf(url: string): string[] {
  return url.split(/[?#]/, 1)[0].split('/').filter(Boolean);
}

/**
 * Find the route a set of URL segments would land on.
 *
 * A deliberately small re-implementation of route matching, because Angular's recogniser is not
 * public and we need an answer *before* any navigation has happened. It understands static
 * segments, `:params`, and children — which is what a URL hierarchy is made of.
 *
 * What it does not understand is `loadChildren`: the child routes are behind a dynamic import and
 * simply don't exist yet. Rather than guess, it declines to match into a lazy subtree, so pages in
 * one won't have a parent derived for them. Say so explicitly with `data: { parent }`.
 */
export function findRoute(routes: Routes | undefined, segments: string[]): Route | null {
  if (!routes) return null;

  for (const route of routes) {
    // A redirect isn't a page, and `**` matches everything — it would happily claim to be the
    // parent of anything, which is worse than having no parent at all.
    if (route.redirectTo !== undefined || route.path === '**') continue;

    const path = (route.path ?? '').split('/').filter(Boolean);
    if (segments.length < path.length) continue;

    const consumed = path.every((part, i) => part.startsWith(':') || part === segments[i]);
    if (!consumed) continue;

    const rest = segments.slice(path.length);

    if (rest.length === 0) {
      if (route.component || route.loadComponent) return route;
      // A componentless wrapper: the page is its empty-path child.
      const child = findRoute(route.children, []);
      if (child) return child;
      continue;
    }

    const child = findRoute(route.children, rest);
    if (child) return child;
  }

  return null;
}

/**
 * Where a page sits, when it's the first thing the app opened.
 *
 * Two sources, in order:
 *
 * 1. **`data: { parent: '/inbox' }`** on the route. The same declaration the back button uses, so
 *    you write it once and it drives both. Necessary whenever the URL doesn't tell the truth about
 *    the hierarchy — flat routes like `/item/42`, or a detail page reachable from two places.
 *
 * 2. **The URL's own nesting.** `/inbox/item/12/notes` → `/inbox/item/12` → `/inbox`: drop
 *    segments until what's left is a real page. Costs nothing to set up and is right most of the
 *    time, because most apps already nest their URLs the way their screens nest.
 */
export function deriveParentUrl(routes: Routes, url: string): string | null {
  const segments = segmentsOf(url);
  if (segments.length === 0) return null;

  const declared = findRoute(routes, segments)?.data?.['parent'];
  if (typeof declared === 'string') return declared;

  for (let length = segments.length - 1; length > 0; length--) {
    const candidate = segments.slice(0, length);
    const route = findRoute(routes, candidate);

    if (route?.component || route?.loadComponent) {
      return `/${candidate.join('/')}`;
    }
  }

  return null;
}

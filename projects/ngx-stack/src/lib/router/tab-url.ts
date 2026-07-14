import type { ActivatedRouteSnapshot } from '@angular/router';

/**
 * Which tab a URL belongs to, or `''` when the app has no tabs — or when the URL belongs to none of
 * them, which is what a login screen or a full-screen modal route looks like. Those get their own
 * stack, outside the tab bar, which is almost always what you want.
 */
export function tabOfUrl(url: string, tabs: readonly string[] | undefined): string {
  if (!tabs?.length) return '';

  // Strip the leading slash, query and fragment, then take the first segment.
  const path = url.replace(/^\/+/, '').split(/[?#]/, 1)[0];
  const first = path.split('/', 1)[0];

  return tabs.includes(first) ? first : '';
}

/**
 * `data: { tab: 'search' }` — for a page that belongs to a tab its URL doesn't name.
 *
 * Most apps nest their URLs by tab and never need this. But a flat route, or a tab whose pages live
 * under a different prefix, has no way to say where it belongs otherwise, and would silently land in
 * the no-tab stack: mounted, outside the tab bar, and stranded the moment you switch tabs.
 */
export function tabOfRouteData(
  data: Record<string, unknown> | undefined,
  tabs: readonly string[] | undefined,
): string | null {
  const tab = data?.['tab'];
  if (typeof tab !== 'string') return null;

  if (tabs?.length && !tabs.includes(tab)) {
    throw new Error(
      `[ngx-stack] A route declares data: { tab: '${tab}' }, but '${tab}' is not one of the ` +
        `configured tabs [${tabs.join(', ')}]. Its pages would go to a stack no tab can reach.`,
    );
  }

  return tab;
}

/** Structural, so the helpers stay testable without a router. */
interface RouteSnapshotLike {
  routeConfig: { data?: Record<string, unknown> } | null;
}

/**
 * The tab a route belongs to, asking it and then every route it is nested inside.
 *
 * The point of walking the ancestors: with nested routes you declare the tab **once**, on the tab's
 * root, and every page under it inherits — rather than repeating `data: { tab }` on each one.
 *
 * Deliberately reads `routeConfig.data` rather than the snapshot's own `data`. The snapshot's
 * version already merges in inherited data, but only from ancestors Angular considers inheritable
 * (componentless ones, unless you change `paramsInheritanceStrategy`). Walking the configs ourselves
 * means a tab root works whether or not it happens to have a component.
 */
export function tabOfRouteTree(
  pathFromRoot: readonly RouteSnapshotLike[],
  tabs: readonly string[] | undefined,
): string | null {
  // Innermost first, so a page can override the tab it is nested in.
  for (let i = pathFromRoot.length - 1; i >= 0; i--) {
    const tab = tabOfRouteData(pathFromRoot[i].routeConfig?.data, tabs);
    if (tab) return tab;
  }
  return null;
}

/**
 * Which stack a page belongs on: what the route tree says, and failing that, what its URL implies.
 *
 * The single place that answers this, so the outlet (which files the page) and `NgxStackTabs` (which
 * lights up the tab bar) can never disagree about where a page went.
 */
export function tabOfRoute(
  snapshot: ActivatedRouteSnapshot,
  url: string,
  tabs: readonly string[] | undefined,
): string {
  return tabOfRouteTree(snapshot.pathFromRoot, tabs) ?? tabOfUrl(url, tabs);
}

import {
  DestroyRef,
  DOCUMENT,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
  inject,
  type EnvironmentProviders,
} from '@angular/core';
import { NavigationStart, RouteReuseStrategy, Router } from '@angular/router';

import { NGX_STACK_CONFIG, NGX_STACK_DEFAULTS, type NgxStackConfig } from './config';
import { NGX_STACK_PLATFORM } from './platform/platform';
import { deriveParentUrl } from './router/parent-url';
import { NgxStackRouteReuseStrategy } from './router/route-reuse-strategy';
import { NgxStackNav, NGX_STACK_ANIMATED, NGX_STACK_DIRECTION } from './router/stack-nav';

/**
 * Wire up the stack. One call, everything in it.
 *
 * ```ts
 * bootstrapApplication(App, {
 *   providers: [
 *     provideRouter(routes),
 *     provideNgxStack({
 *       transitions: { ios: iosTransition, android: androidTransition, web: noneTransition },
 *       tabs: ['inbox', 'search'],
 *       deepLinks: true,     // needs withDisabledInitialNavigation() — see below
 *     }),
 *   ],
 * });
 * ```
 *
 * Installs {@link NgxStackRouteReuseStrategy}, which is required — Angular's default strategy
 * recycles a component when only the route params change, which would quietly merge `/item/1` and
 * `/item/2` into one page instead of two.
 */
export function provideNgxStack(config: NgxStackConfig = {}): EnvironmentProviders {
  const resolved = { ...NGX_STACK_DEFAULTS, ...config };

  return makeEnvironmentProviders([
    { provide: NGX_STACK_CONFIG, useValue: resolved },
    { provide: RouteReuseStrategy, useClass: NgxStackRouteReuseStrategy },

    ...(resolved.deepLinks ? [rebuildDeepLinks(resolved.deepLinks)] : []),
  ]);
}

/** Guards against a `parentOf` that never terminates. Ten screens is already an absurd stack. */
const MAX_ANCESTORS = 10;

/**
 * Build the pages that *should* have been underneath, when the app opens partway in.
 *
 * A push notification, a shared link, a refresh three screens deep: the router lands you on the
 * detail page and the stack has exactly one entry. Nothing is beneath it, so there is nothing for a
 * swipe to drag into view.
 *
 * The gesture needs the page below to be mounted and painted *before* the finger touches the
 * screen, and the only honest way to get it there is to have navigated to it. So that's what this
 * does: it rebuilds the ancestor chain at startup, silently, before the app is shown.
 */
function rebuildDeepLinks(
  deepLinks: true | ((url: string) => string | null),
): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const router = inject(Router);
    const destroyRef = inject(DestroyRef);

    const findParent =
      deepLinks === true ? (url: string) => deriveParentUrl(router.config, url) : deepLinks;

    let handled = false;

    // We intercept the very first navigation rather than letting it land and then correcting
    // ourselves, and the timing is the whole point: NavigationStart fires before anything is
    // recognised or activated, so nothing has been built yet. Asking the router for a different URL
    // here supersedes the one in flight — it is cancelled where it stands and never activates. The
    // deep page therefore gets constructed exactly once, at the end, on top of its ancestors.
    //
    // (Doing this after NavigationEnd would work too, and would build the deep page, throw it away,
    // and build it again — running its resolvers twice for the privilege.)
    const subscription = router.events.subscribe((event) => {
      if (handled || !(event instanceof NavigationStart)) return;
      handled = true;
      subscription.unsubscribe();

      const target = event.url;

      // Walk up from the target, collecting ancestors outermost-first.
      const chain: string[] = [];
      const seen = new Set<string>([target]);
      let current = target;

      while (chain.length < MAX_ANCESTORS) {
        const parent = findParent(current);
        if (!parent || seen.has(parent)) break;
        seen.add(parent);
        chain.unshift(parent);
        current = parent;
      }

      // Nothing above it — it *is* a root page. Let the navigation Angular already started proceed.
      if (chain.length === 0) return;

      void (async () => {
        // Root the stack at the outermost ancestor, replacing the history entry the browser already
        // has for the deep URL…
        await router.navigateByUrl(chain[0], {
          replaceUrl: true,
          state: { [NGX_STACK_DIRECTION]: 'root', [NGX_STACK_ANIMATED]: false },
        });

        // …then walk back down, pushing each page. The stack and the history end up exactly as they
        // would have been if the user had tapped their way here — which is the whole point.
        for (const url of [...chain.slice(1), target]) {
          await router.navigateByUrl(url, {
            state: { [NGX_STACK_DIRECTION]: 'forward', [NGX_STACK_ANIMATED]: false },
          });
        }
      })();
    });

    destroyRef.onDestroy(() => subscription.unsubscribe());
  });
}

/** The slice of `@capacitor/app` we need. Structural, so there is no dependency on Capacitor. */
export interface CapacitorAppLike {
  addListener(
    eventName: 'backButton',
    listenerFunc: (event: { canGoBack: boolean }) => void,
  ): Promise<unknown>;
  exitApp(): Promise<void>;
}

/**
 * Route the Android hardware back button (and the Android system back gesture, which Capacitor
 * reports through the same event) into the stack.
 *
 * Pass the plugin in rather than having the library import it, so `@capacitor/app` stays out of the
 * dependency graph of anyone shipping only to the web:
 *
 * ```ts
 * import { App } from '@capacitor/app';
 * provideCapacitorBack(App)
 * ```
 *
 * At the root of the stack this calls `exitApp()`, which is what Android users expect — back on the
 * first screen closes the app rather than doing nothing.
 *
 * The event's own `canGoBack` is deliberately ignored. It describes the *webview's* history, and
 * history is a single linear thread while tabs are several stacks — so it says yes when the only
 * thing behind you is a different tab. We ask the stack instead.
 */
export function provideCapacitorBack(app: CapacitorAppLike): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideEnvironmentInitializer(() => {
      const platform = inject(NGX_STACK_PLATFORM);
      if (!platform.isCapacitor) return;

      const nav = inject(NgxStackNav);
      void app.addListener('backButton', () => {
        if (nav.canGoBack()) {
          void nav.back();
        } else {
          void app.exitApp();
        }
      });
    }),
  ]);
}

/**
 * The same, for Cordova / PhoneGap.
 *
 * Cordova is a WKWebView (iOS) or WebView (Android) with plugins bolted on, so everything else in
 * this library already works there unchanged — the swipe, the transitions, the stacks, the tabs.
 * The one thing that isn't web is the Android hardware back button, which Cordova delivers as a
 * `backbutton` event on `document` once `deviceready` has fired.
 *
 * ```ts
 * provideCordovaBack()
 * ```
 *
 * Nothing to pass in: unlike Capacitor, Cordova's API is a global. At the root of the stack this
 * calls `navigator.app.exitApp()`.
 */
export function provideCordovaBack(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideEnvironmentInitializer(() => {
      const platform = inject(NGX_STACK_PLATFORM);
      if (!platform.isCordova) return;

      const nav = inject(NgxStackNav);
      const doc = inject(DOCUMENT);
      const destroyRef = inject(DestroyRef);

      const onBackButton = (event: Event): void => {
        event.preventDefault();

        if (nav.canGoBack()) {
          void nav.back();
          return;
        }

        const exitApp = (
          doc.defaultView?.navigator as unknown as { app?: { exitApp?: () => void } }
        )?.app?.exitApp;
        exitApp?.();
      };

      // Cordova only starts firing `backbutton` after `deviceready`, so subscribing this early is
      // safe — the event simply cannot arrive before then.
      doc.addEventListener('backbutton', onBackButton);

      // An app is normally torn down by the OS, not by us — but a test harness, or a micro-frontend
      // that destroys and recreates the Angular app, would otherwise leave this listener holding a
      // reference to a dead injector and stealing the back button from whatever replaced it.
      destroyRef.onDestroy(() => doc.removeEventListener('backbutton', onBackButton));
    }),
  ]);
}

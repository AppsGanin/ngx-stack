import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { androidTransition, iosTransition, provideNgxStack, webTransition } from 'ngx-stack';

import { routes } from './app.routes';

/**
 * No cap by default — go as deep as you like and every page keeps its state, which is what the
 * library does out of the box and what almost every app wants.
 *
 * `?maxDepth=5` turns the cap on, because it is a real feature and it deserves to stay demonstrable
 * and, more to the point, testable: the e2e opens the demo with it to prove that a page which falls
 * off the bottom is destroyed, and that walking back to it rebuilds it — still as a *back*
 * transition, just without its state.
 */
const maxDepth = Number(new URLSearchParams(location.search).get('maxDepth') ?? 0) || 0;

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),

    provideNgxStack({
      // Forced, so the iOS look and its swipe are demonstrable on a laptop. Remove this line and
      // each platform picks up its own transition on its own.
      platform: 'ios',

      // These three are the defaults. `android` and `web` are the same animation today — Material's
      // rise-and-fade, because a full-width slide is a phone idiom that looks silly in a browser
      // window — but they stay separate knobs, so retuning one leaves the other alone.
      transitions: {
        ios: iosTransition,
        android: androidTransition,
        web: webTransition,
      },

      // Each of these path prefixes gets its own independent stack. Drill three deep in Inbox,
      // switch to Search, come back — Inbox is exactly where you left it.
      tabs: ['inbox', 'search', 'settings'],

      // Open the app straight at /inbox/item/12/notes and the pages that should have been beneath
      // it are built too, so the swipe works from the first frame. Ancestors come from the route
      // config: `data: { parent }` where declared, otherwise the URL's own nesting.
      deepLinks: true,

      // 0 — no cap. Pages are cheap but not free; set one only for a stack you can descend
      // forever (a chat, a wiki, a file browser). Try it here with `?maxDepth=5`.
      maxDepth,

      // Lets the edge drag be performed with a mouse. For development; leave off in production.
      swipeWithMouse: true,
    }),
  ],
};

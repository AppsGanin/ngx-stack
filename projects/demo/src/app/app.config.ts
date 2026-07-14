import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { androidTransition, iosTransition, provideNgxStack, webTransition } from 'ngx-stack';

import { routes } from './app.routes';

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

      // Deliberately small so the cap is easy to hit. Go five deep in Inbox and the bottom page
      // is destroyed; go back to it and it's rebuilt from its URL — still a back transition, but
      // its state is gone. That is the trade, and this is what it looks like.
      maxDepth: 5,

      // Lets the edge drag be performed with a mouse. For development; leave off in production.
      swipeWithMouse: true,
    }),
  ],
};

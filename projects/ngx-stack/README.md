<h1 align="center">ngx-stack</h1>

<p align="center">
  Native-feeling page stacks for Angular — push/pop transitions and an interactive
  <br />iOS swipe-to-go-back, without pulling in a UI framework.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/ngx-stack"><img alt="npm" src="https://img.shields.io/npm/v/ngx-stack?color=%23007aff"></a>
  <a href="https://www.npmjs.com/package/ngx-stack"><img alt="downloads" src="https://img.shields.io/npm/dm/ngx-stack"></a>
  <a href="https://github.com/AppsGanin/ngx-stack/actions/workflows/ci.yml"><img alt="ci" src="https://github.com/AppsGanin/ngx-stack/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://bundlephobia.com/package/ngx-stack"><img alt="bundle size" src="https://img.shields.io/bundlephobia/minzip/ngx-stack"></a>
  <img alt="license" src="https://img.shields.io/npm/l/ngx-stack">
</p>

<p align="center">
  <a href="https://appsganin.github.io/ngx-stack/"><b>Live demo</b></a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#api">API</a> ·
  <a href="#configuration">Configuration</a>
</p>

<!-- Absolute, not relative: this README is also the npm package page, and npm does not resolve
     relative image paths the way GitHub does. -->
<p align="center">
  <img src="https://raw.githubusercontent.com/AppsGanin/ngx-stack/main/projects/ngx-stack/docs/swipe.png" alt="A swipe-back caught mid-gesture: the detail page follows the finger while the list behind it parallaxes at a third of the speed and dims" width="360">
</p>

<p align="center">
  <sub>Caught mid-swipe. The page follows the finger 1:1; the one behind parallaxes at a third of<br />the speed and dims — and it kept its scroll position, because it was never unmounted.</sub>
</p>

---

- 🎯 **The gesture follows your finger.** Not an approximation of it — the transition is scrubbed by
  the drag, and can be abandoned halfway.
- 🍎 **The UIKit push on iOS, Material everywhere else** — or a transition you write yourself, per
  platform.
- 📱 **Capacitor and Cordova**, including the Android hardware back button.
- 🗂 **Tabs with independent stacks.** Drill three deep in one, switch away, come back to exactly
  where you were.
- 🔗 **Deep links that behave.** Open the app three screens in and the pages that should be beneath
  are there, so the swipe works from the first frame.
- ♿️ **Focus and screen-reader announcements** on every page change; `prefers-reduced-motion` honoured.
- 🌍 **RTL** — transitions mirror, the gesture moves to the right edge.
- 🪶 **Unstyled and zoneless.** Signals throughout. No UI framework, no CSS to override.

## Compatibility

The library's major version **is** the Angular major version. There is no table to consult and no
guessing — `npm i ngx-stack` on Angular 22 installs 22.x.

| Angular | ngx-stack | npm tag  |
| ------- | --------- | -------- |
| 22.x    | 22.x      | `latest` |

`ng update ngx-stack` runs migrations, so a major bump doesn't leave you reading a changelog to find
out why the build broke.

## Why this exists

Angular's router destroys the outgoing component the moment you navigate. That is the right default,
and completely incompatible with a swipe-back: the page you are swiping back to has to already be
mounted and painted **before** the navigation that reveals it, or there is nothing to drag into view.

The other half of the problem is the animation. A CSS transition or a View Transition is
fire-and-forget — it runs on its own clock. A swipe-back is the opposite: the finger owns the clock,
the transition has to follow it, and the user may change their mind halfway and drag right back. So
every transition here is a set of paused Web Animations that the gesture seeks by writing
`currentTime` directly. That is the whole trick.

## Install

```bash
npm i ngx-stack
```

## Quick start

Four things. Three of them are one line.

**1.** Add the provider.

```ts
// app.config.ts
import { provideRouter } from '@angular/router';
import { provideNgxStack } from 'ngx-stack';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideNgxStack(), // iOS gets the UIKit push + swipe-back; Android and web get their own
  ],
};
```

**2.** Swap the outlet.

```ts
// app.ts
import { NgxStackOutlet } from 'ngx-stack';

@Component({
  selector: 'app-root',
  imports: [NgxStackOutlet],
  template: `<ngx-stack-outlet />`,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
})
export class App {}
```

**3.** Give it a height. This is the one thing that will silently waste your afternoon: the outlet is
`position: relative` with absolutely positioned pages inside it, so if nothing above it has a size,
it collapses to zero and you get a blank screen with **no error**.

```scss
// styles.scss
html,
body {
  height: 100%;
  margin: 0;
}

app-root {
  display: block;
  height: 100dvh;
}
```

**4.** Routes stay exactly as they were. Ordinary components, ordinary `router.navigate()`.

```ts
export const routes: Routes = [
  { path: 'list', component: ListPage },
  { path: 'item/:id', component: ItemPage }, // or loadComponent
];
```

Done. Tapping through to `/item/42` pushes; a drag from the left edge pops.

## API

| Export                                                                     | What                                                                        |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `provideNgxStack(config?)`                                                 | Sets it all up. See [Configuration](#configuration).                        |
| `<ngx-stack-outlet>`                                                       | Replaces `<router-outlet>`. Holds one stack per tab.                        |
| `<ngx-stack>`                                                              | A stack with no URLs — wizards, sheets. [Details](#imperative-stack).       |
| `NgxStackNav`                                                              | `forward()`, `back()`, `root()` — navigation with an explicit stack intent. |
| `NgxStackTabs`                                                             | Which tab is active, and where each one was last seen.                      |
| `NgxStackSwipe`                                                            | The app-wide swipe switch: `enable()`, `disable()`, `enabled()`.            |
| `NgxStackPage`                                                             | Page lifecycle hooks, and `ngxCanSwipeBack()`.                              |
| `provideCapacitorBack(App)`                                                | Android hardware back → the stack.                                          |
| `provideCordovaBack()`                                                     | The same, for Cordova.                                                      |
| `iosTransition` · `androidTransition` · `webTransition` · `noneTransition` | One per platform. [Transitions](#transitions).                              |
| `slideTransition(o)` · `riseTransition(o)`                                 | The two shapes the built-ins are made of. Retune either.                    |

## Router-driven stack

Pages get real URLs, deep links work, and the browser's back button is just another way to
pop the stack.

Navigate with the plain router — no special API:

```ts
router.navigate(['/item', 42]); // pushes — /item/42 isn't on the stack
location.back(); // pops — and so does a swipe from the left edge
```

The direction is inferred: if the incoming URL is already on the stack, it's a pop back to that
page; otherwise it's a push. When that inference is wrong, say so explicitly with `NgxStackNav`.

### The plain Angular way keeps working

You don't have to learn a navigation API. `routerLink`, `router.navigate()`, `router.navigateByUrl()`,
the browser's back button and `location.back()` all work, and so do resolvers, guards, lazy
`loadComponent`, and relative navigation.

| What you write                                     | What the stack does                                                                       |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `[routerLink]="['/item', 42]"`                     | Pushes. `/item/42` isn't on the stack.                                                    |
| `router.navigate(['/list'])` when `/list` is below | **Pops back to it**, destroying what was above. A stack unwinds to a page it already has. |
| `router.navigate([…], { replaceUrl: true })`       | **Swaps the top page.** History didn't grow, so neither does the stack.                   |
| `?query` change on the same route                  | Nothing. Same page, same component, `ActivatedRoute` emits — as it always did.            |
| Browser back / `location.back()`                   | Pops. Prefer `nav.back()` once you have tabs — see below.                                 |

Two of those are worth pausing on, because they're where a stack genuinely differs from a router:

**Navigating to a URL already on the stack unwinds to it.** Home → Details → `navigate(['/home'])`
takes you back to the _existing_ Home and throws Details away, rather than stacking a second Home
on top. That's what a stack is for, and it's what makes the browser back button work for free. If
you really want a second copy, say so: `nav.forward(['/home'])`.

**`nav.back()` is not the same as `location.back()`.** They agree in a plain app. They part company
once you have tabs, or a cold deep link — see those sections for why.

The outlet needs a height. It is `position: relative` with absolutely positioned pages
inside, so give its parent a real size (`height: 100dvh` on the host is usually it).

### `NgxStackNav`

Injectable. Navigation with an explicit stack intent — for the cases where the inference
above gets it wrong.

| Method                       | What it does                                                                                                                                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `forward(commands, extras?)` | **Always pushes**, even if the URL is already on the stack. Without this, navigating Home → Details → Home unwinds to the existing Home and throws Details away. Use it when you genuinely want a second copy on top. |
| `back(commands?, extras?)`   | With no arguments, a real `history.back()` — so the URL, the browser's back button and the stack stay in agreement. This is what the swipe gesture calls. Pass commands to pop to a specific URL instead.             |
| `root(commands, extras?)`    | **Replaces the entire stack** with one page, destroying everything else. After login, after logout, after a flow completes. Uses `replaceUrl`, so the discarded pages don't linger in browser history either.         |

All three return `Promise<boolean>` from the router, and take the usual `NavigationExtras`.

```ts
const nav = inject(NgxStackNav);

nav.forward(['/list']); // push a *second* /list rather than unwinding to the first
nav.back(); // pop one page
nav.root(['/home']); // wipe the stack, start again
```

## Imperative stack

For navigation that has no business being in the address bar — a wizard inside a modal, a
drill-down in one tab. Same transition, same swipe-back, no URLs.

```html
<ngx-stack [root]="Step1" #wizard />
```

```ts
const stack = inject(NgxStack); // from any page on the stack
```

### Methods

Every one returns a `Promise<void>` that resolves when the transition has finished.

| Method                        | What it does                                                                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `push(component, inputs?)`    | Mount `component` and slide it in on top. `inputs` is a plain object applied with `setInput`, so signal inputs and `@Input()` both work. The page below stays mounted and keeps its state. |
| `pop()`                       | Drop the top page and go back one. Destroys the popped component. A no-op at the root — safe to call blindly.                                                                              |
| `popTo(index)`                | Unwind to the page at `index` (0 is the root), destroying every page above it. Skips whole sections of a flow in a single transition instead of popping them one at a time.                |
| `popToRoot()`                 | `popTo(0)`. Back to the first page, everything above it destroyed. The "start over" button of a wizard.                                                                                    |
| `setRoot(component, inputs?)` | Throw the whole stack away and start again from `component`. The imperative twin of `NgxStackNav.root()`.                                                                                  |

### Inputs

| Input        | Type                      | What it does                                                                               |
| ------------ | ------------------------- | ------------------------------------------------------------------------------------------ |
| `root`       | `Type<unknown> \| null`   | The bottom page, mounted on init without a transition. Use `setRoot()` to change it later. |
| `rootInputs` | `Record<string, unknown>` | Inputs for that first page.                                                                |
| `swipeBack`  | `boolean \| null`         | Swipe-back for this stack only. `null` (default) defers to the app-wide `NgxStackSwipe`.   |

### Signals

`pages` (the mounted `StackEntry[]`, bottom first), `depth`, `canGoBack`, `animating`. The
routed outlet exposes the same four, so `<ngx-stack-outlet #outlet>` plus
`@if (outlet.canGoBack())` is how you show a back button.

Stacks nest. A swipe inside an inner stack pops the inner stack; when the inner stack is at
its own root it declines the gesture and the swipe falls through to the outer one.

## Tabs

Set `tabs` to your top-level path prefixes and each one gets its own independent stack:

```ts
provideNgxStack({ tabs: ['inbox', 'search', 'settings'] });
```

### Why you have to say this

Nothing in a route config distinguishes _"these are siblings you switch between, each keeping its
own history"_ from _"these are just different URLs"_. `/settings` is a tab and `/settings/sheet` is a
page inside it — that's a fact about your app's shape, and only you have it.

It isn't repeated anywhere, though. `NgxStackTabs` exposes the same list as `tabs()`, so the one
declaration also renders your tab bar:

```html
@for (tab of tabs.tabs(); track tab) { <button (click)="tabs.select(tab)">{{ tab }}</button> }
```

**Routes need nothing.** A page is filed by its URL: everything under `/inbox/…` belongs to the
Inbox stack. Write your routes exactly as you would have anyway.

The one exception is a page whose URL _doesn't_ say which tab it's in — a flat `/starred` that
belongs to Inbox. That one says so:

```ts
{ path: 'starred', component: StarredPage, data: { tab: 'inbox' } }
```

Without it, the page lands in the no-tab stack: mounted, outside the tab bar, and stranded the
moment you switch tabs. (A `tab` naming something that isn't in the list throws, rather than quietly
filing the page somewhere no button can reach.)

If you write **nested** routes, declare it once on the tab's root and every page under it inherits —
whether or not the root has a component:

```ts
{
  path: 'settings',
  data: { tab: 'settings' },     // once, for the whole subtree
  children: [
    { path: '', component: SettingsPage },
    { path: 'sheet', component: SheetPage },
  ],
}
```

A route that genuinely belongs to no tab — a login screen, a full-screen modal — gets `tab: ''` and
its own stack, which is normally exactly what you want.

```ts
export const routes: Routes = [
  { path: 'inbox', component: InboxPage },
  { path: 'inbox/item/:id', component: ItemPage }, // → the Inbox stack
  { path: 'search', component: SearchPage },
  { path: 'search/result/:id', component: ResultPage }, // → the Search stack
];
```

Drill three deep in Inbox, switch to Search, come back: Inbox is exactly as you left it, still
three deep, still scrolled where it was. Nothing was unmounted — a tab switch is a cut, not a
push, so it doesn't animate and it doesn't destroy anything.

The tab _bar_ is yours to draw; the library ships no visual design. `NgxStackTabs` is the only
part you need, and it exists to remember where each tab was:

| Member        | What it does                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `active()`    | Signal. The tab on screen.                                                                                                                             |
| `tabs()`      | Signal. The tabs you configured, in order.                                                                                                             |
| `select(tab)` | Go to `tab`, landing back on the page you last had open there. Selecting the tab you're already on pops it to its root — as every native tab bar does. |
| `urlOf(tab)`  | Where that tab was last seen.                                                                                                                          |

```html
@for (tab of tabs.tabs(); track tab) {
<button [class.active]="tabs.active() === tab" (click)="tabs.select(tab)">{{ tab }}</button>
}
```

**One thing to know.** Browser history is a single linear thread; tabs are several stacks. Once
you switch tabs, the history entry behind you belongs to a _different_ tab, so a plain
`history.back()` would jump sideways out of the stack you're in. `nav.back()` and the swipe both
notice this: they use real `history.back()` when it happens to land on the page below, and
navigate to the page they actually mean when it doesn't. A route outside every tab — a login
screen, a full-screen modal — gets `tab: ''` and its own stack, which is usually what you want.

## Deep links: opening the app partway in

A push notification, a shared URL, a hard refresh three screens deep. The router puts you straight
on the detail page and the stack has exactly **one** entry. Nothing is beneath it — so there's
nothing for a swipe to drag into view, and `history.back()` walks straight out of the app.

### The back button — usually nothing to do

Where a page sits is normally obvious from its URL, and the route config already knows it:
`/inbox/item/12/notes` → `/inbox/item/12` → `/inbox`, dropping segments until what's left is a real
page. So the back button just works. `canGoBack()` is true even with one page on the stack, and
`nav.back()` builds the parent and animates to it as a _back_ — exactly as though it had been there
all along. Chains unwind a level at a time.

Only when the URL doesn't tell the truth do you have to say so:

```ts
// Flat: nothing about /ticket/42 says it sits under the inbox.
{ path: 'ticket/:id', component: TicketPage, data: { parent: '/inbox' } }
```

What none of this gives you is the _gesture_: a swipe has to reveal a page that is already mounted
and painted before the finger lands, and the parent is only built on demand. For that, read on.

### The gesture too — `deepLinks: true`

A swipe has to reveal a page that is already mounted and painted before the finger lands, so for the
_gesture_ the ancestors have to genuinely be there. The only honest way to get them there is to have
navigated to them — so that's what this does, at startup, silently, before the app is shown:

```ts
provideNgxStack({
  deepLinks: true,
});
```

That's the whole setup — one flag in the config you already have. Nothing to keep in sync either:
the ancestors come from your route config. `data: { parent }` where you've declared one, otherwise
the URL's own nesting (`/inbox/item/12/notes` → `/inbox/item/12` → `/inbox`, dropping segments until
what's left is a real page). Open that URL cold and the stack comes up as `[inbox, item/12, notes]`,
with `notes` on screen and the swipe live from the first frame.

The deep page is still constructed **exactly once**. The first navigation is intercepted at
`NavigationStart` — before anything is recognised or activated — so asking for a different URL there
supersedes it and it never lands. (Correcting _after_ it lands would build the deep page, throw it
away, and build it again, running its resolvers twice for the privilege.)

Two things it can't work out on its own, both fixed by `data: { parent }`:

- **A flat URL.** `/ticket/42` doesn't say where it sits; `data: { parent: '/inbox' }` does.
- **Routes behind `loadChildren`.** The children live inside a dynamic import and don't exist yet, so
  rather than guess, it declines.

Or pass your own `deepLinks: (url) => string | null` to override the lot.

What it does cost: the ancestors are built and **their resolvers run**, for pages the user may never
look at. If your list page does something expensive on load, leave `deepLinks` off, keep
`data: { parent }`, and let the first back be a tap.

## Turning the swipe on and off

`provideNgxStack({ swipeBack })` only sets the starting value. Three layers can change or
override it at runtime, narrowest last, **and any of them can veto**:

**1. App-wide** — `NgxStackSwipe`. Reach for this when something global is eating the drag: a
modal is open, a map has the screen, a payment is in flight.

```ts
const swipe = inject(NgxStackSwipe);

swipe.enabled(); // Signal<boolean> — read it in a template
swipe.disable();
swipe.enable();
swipe.set(isEnabled);
swipe.reset(); // back to whatever the config resolved to on this device
```

**2. One stack** — `[swipeBack]` on the outlet or on `<ngx-stack>`. `true` or `false` overrides
the app-wide switch in either direction; `null` (the default) defers to it.

```html
<ngx-stack-outlet [swipeBack]="false" />
```

**3. One page** — a veto only; it can't switch the gesture on where the layers above turned it
off. Either declare it on the route, for a page that is simply never swipeable:

```ts
{ path: 'checkout', component: CheckoutPage, data: { swipeBack: false } }
```

…or decide in the moment. `ngxCanSwipeBack()` is asked on _every_ touch that lands in the edge
zone, so it can read live state:

```ts
export class EditorPage implements NgxStackPage {
  readonly dirty = signal(false);

  ngxCanSwipeBack(): boolean {
    return !this.dirty(); // no swiping away from unsaved work
  }
}
```

Note that a veto stops the _gesture_, not navigation. Your back button and `nav.back()` still
work — which is usually what you want, since the button is where you can put a confirm dialog.

## Transitions

Three built-ins, one per platform — built out of two shapes:

| Platform | Default             | Shape               | What it does                                                                                                                                           |
| -------- | ------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| iOS      | `iosTransition`     | `slideTransition()` | The UIKit push. The incoming page slides the full width over the outgoing one, which drifts the other way at a third of the speed and dims beneath it. |
| Android  | `androidTransition` | `riseTransition()`  | Material's rise-and-fade. The page below stays put and is simply covered.                                                                              |
| Web      | `webTransition`     | `riseTransition()`  | **Identical to Android's today** — same numbers, still its own transition.                                                                             |

The web gets Material's rather than a slide of its own, because a full-width slide is a phone idiom:
it says _"this screen came from over there"_, which is true of something you swiped into view and not
of something you clicked — and on a wide monitor it is a great many pixels moving for no reason.

`androidTransition` and `webTransition` stay **two transitions rather than one**, even though they
are the same animation right now. "What a phone does" and "what a browser does" are two decisions
that merely happen to agree today; if they were a single object, the first person to want a different
feel on the desktop would have to change both.

Override any of them:

```ts
provideNgxStack({
  transitions: {
    ios: iosTransition,
    android: androidTransition,
    web: noneTransition, // no animation in the browser at all
  },
});
```

Or pass a single function to use everywhere: `transitions: myTransition`.

Both shapes are exported, so re-tuning one is a few numbers rather than a new transition:

```ts
import { riseTransition } from 'ngx-stack';

const snappierWeb = riseTransition({ travel: 6, easing: 'ease-out', durationScale: 0.4 });
```

> **If you want the swipe gesture on Android or the web**, that platform needs a transition that
> moves **horizontally**. Material's doesn't, so a finger dragging sideways would scrub a page moving
> vertically — which is exactly why `swipeBack: 'auto'` only arms the gesture on iOS.
> `slideTransition()` is there for it.

### Writing one

A transition is a pure function from "which two pages, which direction" to keyframes:

```ts
import { scrimOf, type StackTransition } from 'ngx-stack';

export const myTransition: StackTransition = (ctx) => {
  const forward = ctx.direction === 'forward';
  // The page that ends up on top; on 'back' this is the one being uncovered.
  const { enteringEl, leavingEl, width, duration } = ctx;

  return {
    duration,
    easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
    animations: [
      {
        el: enteringEl,
        keyframes: forward
          ? [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }]
          : [{ transform: 'translateX(-33%)' }, { transform: 'translateX(0)' }],
      },
      // scrimOf(el) is the dim overlay we put on every page for you.
    ],
  };
};
```

One rule: **it must be scrubbable.** The swipe-back seeks your `back` keyframes to arbitrary
progress, so they have to be continuous and reversible — no discrete steps, nothing that
can't be interpolated. The engine handles the rest: during a drag it runs your keyframes on
a linear clock so the page tracks the finger exactly, then on release it snapshots what's on
screen and animates from there to the target with your easing. (Re-applying an easing curve
to a half-finished timeline would snap the page at the moment the user lets go — hence the
handoff.)

## Swipe-back

On by default on iOS, off elsewhere (`swipeBack: 'auto'`). Android's back gesture belongs to
the OS, and the default web transition is too subtle to scrub usefully.

```ts
provideNgxStack({
  swipeBack: true,
  swipeEdgeWidth: 50, // px from the left edge where a drag can start
  swipeThreshold: 0.5, // release past halfway completes the pop
  swipeVelocityThreshold: 0.35, // px/ms — a fast flick decides on its own
  swipeWithMouse: true, // drag with a mouse. Development only.
});
```

## Capacitor and Cordova

Both are the easy target: their webviews have no back gesture of their own, so nothing fights us for
the screen edge. Everything here is plain web — the swipe, the transitions, the stacks, the tabs all
work in either shell unchanged.

The one thing that isn't web is the **Android hardware back button**, and each shell delivers it its
own way:

```ts
// Capacitor — pass the plugin in, so @capacitor/app stays out of the dependency graph of
// anyone shipping only to the web.
import { App } from '@capacitor/app';
providers: [provideRouter(routes), provideNgxStack(), provideCapacitorBack(App)];
```

```ts
// Cordova / PhoneGap — nothing to pass in; its API is a global.
providers: [provideRouter(routes), provideNgxStack(), provideCordovaBack()];
```

Both pop the stack, and both exit the app at the root — back on the first screen closes it rather
than doing nothing, which is what Android users expect.

Neither asks the _shell_ whether it can go back. Capacitor's `backButton` event and Cordova's both
report the **webview's history**, and history is a single linear thread while tabs are several
stacks — so it says yes when the only thing behind you is a different tab. They ask the stack.

Platform detection knows both shells (`platform.isCapacitor`, `isCordova`, `isNative`), and that
matters for more than the back button: `hasSystemBackGesture` keys off `isNative`, so an iOS
**Cordova** app doesn't needlessly concede the first 16px of the screen edge to a gesture its
webview doesn't have.

## The iOS browser caveat, honestly

In **iOS Safari and iOS PWAs** — not Capacitor — WebKit reserves the screen edge for its own
interactive back navigation, and there is no API to turn that off. This is a real,
long-standing limitation, not something this library is failing to work around. Your options
are all imperfect, so pick one:

| `systemGesture` | What it does                                                                                                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'inset'`       | **Default.** Start our zone `systemEdgeInset` px (16) inland so the two don't fight. WebKit still owns the outermost pixels; when it navigates, we detect it via `hasUAVisualTransition` and skip our animation rather than double-animating. |
| `'suppress'`    | `preventDefault()` the touchstart in the edge zone, which does stop WebKit. But it also suppresses the synthetic `click` for touches starting there — don't use it if you have tappable UI near the left edge.                                |
| `'ignore'`      | Do nothing and let both gestures coexist.                                                                                                                                                                                                     |

None of this applies under Capacitor.

## Page lifecycle

Stacked pages are not destroyed when you navigate away, which is the point — it's what
preserves their state and lets a swipe reveal them instantly. It also means `ngOnDestroy` no
longer means "the user left this page". These hooks do:

```ts
export class ItemPage implements NgxStackPage {
  ngxViewWillEnter() {}
  ngxViewDidEnter() {}
  ngxViewWillLeave() {}
  ngxViewDidLeave() {} // still alive — unless it was popped
}
```

Scroll position needs no work on your part: buried pages get `content-visibility: hidden`,
which skips their rendering but preserves their internal state, scroll offsets included.

## Styling

The library ships no visual design. Four custom properties, no `!important` needed anywhere —
the page defaults are wrapped in `:where()`, so a plain `:host { display: flex }` in your page
component takes the layout over.

```css
--ngx-stack-page-background: #fff;
--ngx-stack-page-shadow: -6px 0 20px rgb(0 0 0 / 12%);
--ngx-stack-scrim-color: #000;
```

## RTL

Nothing to configure. `direction: 'auto'` reads the computed direction off the host, so
`<html dir="rtl">` is the entire integration — and because it's read per transition rather than
cached, a language switcher that flips `dir` at runtime works without a reload.

Everything horizontal mirrors: pages arrive from the left, the parallax runs the other way, and
the swipe moves to the **right** edge and pulls left. Custom transitions get `ctx.rtl` and should
respect it, or they'll feel backwards in Arabic and Hebrew — the new page appearing to come from
where the user just came from.

## Memory: `maxDepth`

Pages are cheap but not free, and a stack you can descend forever — a chat, a wiki, a file
browser — will happily hold fifty live components.

```ts
provideNgxStack({ maxDepth: 10 }); // 0, the default, means no cap
```

Pages that fall off the bottom are destroyed. Walking back past that horizon still works: the
page is rebuilt from its URL and **still animates as a back**, because that's what actually
happened, whatever the DOM currently remembers. What it loses is its state. That's the trade you
asked for by setting a cap, and it's why the default is off.

## Accessibility

A stack navigation is invisible to assistive tech — no document load, no focus change it can
infer anything from, just the DOM quietly rearranging. So by default (`manageFocus: true`) the
stack moves focus into the page that arrived and announces its route `title` through a polite
live region. Buried pages are `inert`, so nothing off-screen is reachable by keyboard.

Focus lands on the page container unless you point it somewhere better:

```html
<h1 ngxStackAutofocus tabindex="-1">Message 42</h1>
```

`prefers-reduced-motion: reduce` makes transitions instant. The swipe keeps its animation, on
purpose: motion the user is dragging with their own finger is direct manipulation, which the
guidance exempts — and a gesture with no visual response isn't reduced motion, it's broken.

## Events

```html
<ngx-stack-outlet (transitionStart)="…" (transitionEnd)="onDone($event)" />
```

Both carry a `StackTransitionEvent`: `direction`, `entering`, `leaving`, `tab`, `animated`, and
`interactive` — true when a finger drove it rather than a navigation.

## Known limits

- **`withComponentInputBinding()` is not supported.** Angular's router binds route params to
  component inputs through a private token that a third-party outlet cannot reach. Read params
  from `ActivatedRoute` instead.
- **`RouteReuseStrategy` is claimed.** `provideNgxStack()` installs `NgxStackRouteReuseStrategy`,
  which is required — Angular's default recycles a component when only params change, quietly
  merging `/item/1` and `/item/2` into one page. A strategy of your own that returns
  `shouldDetach: true` will fight the stack, and the outlet throws if it's asked to detach.
- **Component-less and redirect routes** can't be pages. `loadComponent` is fine.
- **No SSR.** The stack is DOM-driven throughout.
- **Android's predictive back is not wired up, and can't be.** Capacitor forwards the back
  _event_, which `provideCapacitorBack()` handles — but the OS never forwards the gesture's
  progress into the webview, so there is nothing to drive an interactive animation with. Anything
  claiming otherwise is faking it. On Android the back gesture stays the OS's, and it's
  instantaneous.
- **Async `canDeactivate` guards can't gate the gesture.** A touch handler cannot wait for a
  promise. The default `guardPolicy: 'block'` refuses the swipe on any guarded route for that
  reason; `ngxCanSwipeBack()` is the synchronous way back in.

## Configuration

Every option, with its default. All of them are optional — `provideNgxStack()` with no arguments is
a working setup.

```ts
provideNgxStack({/* … */});
```

**Look and feel**

| Option                 | Default  | What                                                                                                          |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `platform`             | `'auto'` | `'ios'` · `'android'` · `'web'`. Forced, for testing an iOS build on a laptop. `'auto'` reads the OS.         |
| `direction`            | `'auto'` | `'ltr'` · `'rtl'`. `'auto'` reads the computed direction off the host, so `<html dir="rtl">` just works.      |
| `transitions`          | built-in | One `StackTransition`, or `{ ios, android, web }`. See [Transitions](#transitions).                           |
| `duration`             | `420`    | Base ms. The built-ins scale it — Android and web run shorter than iOS.                                       |
| `animateRoot`          | `false`  | Animate the very first page onto an empty stack.                                                              |
| `respectReducedMotion` | `true`   | `prefers-reduced-motion` makes transitions instant. The swipe keeps its animation — it's direct manipulation. |

**Swipe-back**

| Option                   | Default   | What                                                                                                    |
| ------------------------ | --------- | ------------------------------------------------------------------------------------------------------- |
| `swipeBack`              | `'auto'`  | `'auto'` arms it on iOS only. Changed at runtime with `NgxStackSwipe`.                                  |
| `swipeEdgeWidth`         | `50`      | px of edge in which a drag can begin. Mirrored in RTL.                                                  |
| `swipeThreshold`         | `0.5`     | Release past this fraction and the pop completes.                                                       |
| `swipeVelocityThreshold` | `0.35`    | px/ms. A faster flick decides on its own, whatever the distance.                                        |
| `swipeWithMouse`         | `false`   | Drag with a mouse. For developing the gesture on a laptop — leave it off in production.                 |
| `guardPolicy`            | `'block'` | A route with a `canDeactivate` guard isn't swipeable unless it implements `ngxCanSwipeBack()`.          |
| `systemGesture`          | `'inset'` | What to do about WebKit's own edge gesture. [The iOS browser caveat](#the-ios-browser-caveat-honestly). |
| `systemEdgeInset`        | `16`      | With `'inset'`, px at the very edge conceded to the browser.                                            |

**Structure**

| Option        | Default | What                                                                                                       |
| ------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `tabs`        | —       | `['inbox', 'search']` — path prefixes, each with its own stack. [Tabs](#tabs).                             |
| `deepLinks`   | `false` | Rebuild the ancestors when the app opens partway in. [Deep links](#deep-links-opening-the-app-partway-in). |
| `maxDepth`    | `0`     | Cap on pages kept mounted per stack. `0` is no cap. [Memory](#memory-maxdepth).                            |
| `manageFocus` | `true`  | Move focus into the entering page and announce it. [Accessibility](#accessibility).                        |

## Contributing

Issues and pull requests are welcome. The development setup, the release process, and how a new
Angular major gets supported are all in the [workspace README](https://github.com/AppsGanin/ngx-stack).

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) — the convention Angular
itself invented — and a `pre-commit` hook runs ESLint and Prettier over what you staged.

## License

[MIT](https://github.com/AppsGanin/ngx-stack/blob/main/LICENSE) © Dmitry Ganin

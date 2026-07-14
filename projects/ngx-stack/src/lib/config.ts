import { InjectionToken } from '@angular/core';
import type { StackTransition } from './animation/transition';
import type { StackPlatformKind } from './platform/platform';

/** A transition per platform. Anything you leave out keeps the built-in for that platform. */
export interface StackTransitionMap {
  ios?: StackTransition;
  android?: StackTransition;
  web?: StackTransition;
}

/**
 * What to do about the browser's *own* edge-swipe back gesture.
 *
 * Only relevant on iOS Safari and iOS standalone PWAs — WebKit reserves the screen edge for
 * its own interactive back navigation and gives you no way to turn it off. Under Capacitor
 * the webview has no such gesture, so this setting does nothing there.
 */
export type SystemGesturePolicy =
  /**
   * Start our gesture zone a few px inland so the two don't fight over the same pixels. The
   * system still owns the outermost `systemEdgeInset` px; when it fires we notice and skip
   * our own animation rather than drawing a second one on top of WebKit's.
   */
  | 'inset'
  /**
   * `preventDefault()` the touchstart inside the edge zone, which stops WebKit starting its
   * gesture. Reliable, but it also suppresses the synthetic `click` for touches beginning
   * there — don't use it if you have tappable UI within `swipeEdgeWidth` px of the edge.
   */
  | 'suppress'
  /** Do nothing, and let both gestures coexist. */
  | 'ignore';

/**
 * What to do when the page on top has a `canDeactivate` guard.
 *
 * The gesture animates the page away *before* the navigation runs, so a guard that later says
 * no leaves us with nothing to do but snap the page back — a visible, ugly bounce. Guards can
 * also be async, and a touch handler cannot wait for a promise.
 */
export type GuardPolicy =
  /**
   * **Default.** A route with a `canDeactivate` guard is not swipeable, unless its component
   * implements `ngxCanSwipeBack()` — which is synchronous, so the gesture can simply not start.
   * Your back button still runs the guard normally, and that's where a confirm dialog belongs.
   */
  | 'block'
  /**
   * Let the gesture run and take the bounce if the guard refuses. Pick this only when you know
   * your guards effectively always pass.
   */
  | 'allow';

export interface NgxStackConfig {
  /** Force a platform instead of detecting it. Handy for testing an iOS build on a laptop. */
  platform?: StackPlatformKind | 'auto';

  /**
   * Writing direction. `'auto'` reads the computed `direction` off the host element, so an
   * app that sets `<html dir="rtl">` mirrors everything with no configuration: the transitions
   * come from the other side and the swipe lives on the right edge.
   */
  direction?: 'auto' | 'ltr' | 'rtl';

  /**
   * The page transition. Pass one function to use it everywhere, or a
   * {@link StackTransitionMap} to vary it by platform.
   */
  transitions?: StackTransition | StackTransitionMap;

  /**
   * Base duration in ms. Built-in transitions scale this to taste (Android and web run shorter
   * than iOS). A custom transition returns its own duration and can ignore it.
   */
  duration?: number;

  /**
   * The tabs, as URL path prefixes: `['home', 'search', 'profile']`.
   *
   * Set this and each one gets its own independent stack. Switching tabs unwinds nothing and
   * destroys nothing — the tab you left keeps its pages mounted, exactly where you were, and comes
   * back that way. Leave it unset and there's a single stack, which is the common case.
   *
   * It has to be declared, because nothing in a route config distinguishes "these are siblings you
   * switch between, each keeping its own history" from "these are just different URLs". `/settings`
   * is a tab and `/settings/sheet` is a page inside it; only you know that.
   *
   * It isn't repeated anywhere, though — {@link NgxStackTabs} exposes it as `tabs()`, so the same
   * declaration also renders your tab bar. And a route whose URL doesn't happen to start with its
   * tab's name can say where it belongs with `data: { tab: 'search' }`.
   */
  tabs?: string[];

  /**
   * Rebuild the pages that *should* have been underneath, when the app opens partway in — a push
   * notification, a shared link, a refresh three screens deep.
   *
   * Without this the router lands you on the detail page with a stack of exactly one: nothing for a
   * swipe to drag into view. (The back *button* is a separate matter and always works — declare
   * `data: { parent: '/inbox' }` on the route.)
   *
   * - `true` — work the ancestors out from the route config: `data: { parent }` where you've
   *   declared one, otherwise the URL's own nesting (`/inbox/item/12/notes` → `/inbox/item/12` →
   *   `/inbox`).
   * - a function — your own `(url) => parentUrl | null`, applied repeatedly to build a chain. For a
   *   URL scheme whose nesting doesn't reflect the screens, or routes behind `loadChildren`, whose
   *   children can't be inspected without loading them.
   *
   * Nothing else to set up: the first navigation is intercepted before anything is built, so the
   * deep page is still constructed exactly once — at the end, on top of its ancestors.
   *
   * The cost is real, though: the ancestors are built and **their resolvers run**, for pages the
   * user may never look at. If your list page does something expensive on load, leave this off and
   * let the first back be a tap.
   */
  deepLinks?: boolean | ((url: string) => string | null);

  /**
   * Cap on how many pages one stack keeps mounted. `0` (the default) means no cap.
   *
   * Pages are cheap but not free, and a stack you can descend forever — a chat, a wiki, a file
   * browser — will happily hold fifty live components. With a cap, pages that fall off the
   * bottom are destroyed. Going back past that horizon still works: the page is rebuilt from
   * its URL and still animates as a *back*, so nothing looks wrong. It just lost its state,
   * which is the trade you asked for.
   */
  maxDepth?: number;

  /**
   * Move focus into the page that just entered, and announce it to screen readers. Default
   * `true`. Without this, a screen-reader user gets no signal that the page changed and their
   * focus stays on a control that has now slid off the screen.
   */
  manageFocus?: boolean;

  /** See {@link GuardPolicy}. */
  guardPolicy?: GuardPolicy;

  /**
   * Interactive swipe-to-go-back. `'auto'` arms it on iOS only — Android's back gesture belongs
   * to the OS, and the default web transition is too subtle to scrub usefully.
   *
   * Only the starting value; {@link NgxStackSwipe} changes it at runtime.
   */
  swipeBack?: boolean | 'auto';

  /** Width of the edge zone, in px, in which a swipe can begin. Mirrored in RTL. */
  swipeEdgeWidth?: number;

  /** Progress in `[0, 1]` past which releasing the finger completes the pop. */
  swipeThreshold?: number;

  /** px/ms. A flick faster than this decides on its own, whatever the progress. */
  swipeVelocityThreshold?: number;

  /** See {@link SystemGesturePolicy}. */
  systemGesture?: SystemGesturePolicy;

  /** With `systemGesture: 'inset'`, how many px at the very edge to concede to the browser. */
  systemEdgeInset?: number;

  /** Also allow dragging with a mouse. For developing the gesture in a desktop browser. */
  swipeWithMouse?: boolean;

  /** Animate the very first page pushed onto an empty stack. */
  animateRoot?: boolean;

  /**
   * Honour `prefers-reduced-motion: reduce` by making transitions instant. Default `true`.
   *
   * The swipe-back keeps its animation regardless, on purpose: motion the user is dragging with
   * their own finger is direct manipulation, which the guidance exempts — and a swipe with no
   * visual response isn't reduced motion, it's a broken gesture.
   */
  respectReducedMotion?: boolean;
}

export type ResolvedStackConfig = Required<Omit<NgxStackConfig, 'transitions' | 'tabs'>> &
  Pick<NgxStackConfig, 'transitions' | 'tabs'>;

export const NGX_STACK_DEFAULTS: ResolvedStackConfig = {
  platform: 'auto',
  direction: 'auto',
  duration: 420,
  deepLinks: false,
  maxDepth: 0,
  manageFocus: true,
  guardPolicy: 'block',
  swipeBack: 'auto',
  swipeEdgeWidth: 50,
  swipeThreshold: 0.5,
  swipeVelocityThreshold: 0.35,
  systemGesture: 'inset',
  systemEdgeInset: 16,
  swipeWithMouse: false,
  animateRoot: false,
  respectReducedMotion: true,
};

export const NGX_STACK_CONFIG = new InjectionToken<ResolvedStackConfig>('ngx-stack.config', {
  providedIn: 'root',
  factory: () => NGX_STACK_DEFAULTS,
});

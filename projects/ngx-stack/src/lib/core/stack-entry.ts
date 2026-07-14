import type { ComponentRef } from '@angular/core';
import type { ActivatedRoute, OutletContext } from '@angular/router';

/** One page living on the stack. */
export interface StackEntry {
  readonly id: number;

  /**
   * Serialized URL that owns this page, used to recognise it again on a later navigation.
   * Empty for imperative stacks, which have no URL of their own.
   */
  url: string;

  /**
   * Which tab's stack this page belongs to, or `''` when the app has no tabs. Pages of
   * inactive tabs stay mounted — that is the entire point of tabs having their own stacks.
   */
  readonly tab: string;

  /** The wrapper we transform. Not the component's own host element — that lives inside. */
  readonly element: HTMLElement;

  /** The dim overlay shown while this page is covered. */
  readonly scrim: HTMLElement;

  readonly ref: ComponentRef<unknown>;

  route: ActivatedRoute | null;

  /**
   * Child outlet contexts captured when this page was navigated away from, so that any nested
   * `<router-outlet>` inside it comes back alive rather than empty when we return.
   */
  savedContexts?: Map<string, OutletContext>;
}

/**
 * Lifecycle callbacks for a page on the stack.
 *
 * Stacked pages are *not* destroyed when you navigate away from them — that's the point, it's
 * what preserves their state and lets the swipe reveal them instantly. Which also means
 * `ngOnDestroy` no longer means "the user left this page". These hooks do.
 */
export interface NgxStackPage {
  /** The page is about to become the top of the stack. Fires before the transition. */
  ngxViewWillEnter?(): void;
  /** The page is now the top of the stack and the transition has finished. */
  ngxViewDidEnter?(): void;
  /** The page is about to stop being the top of the stack. */
  ngxViewWillLeave?(): void;
  /** The page is no longer the top of the stack. It stays alive unless it was popped. */
  ngxViewDidLeave?(): void;

  /**
   * Veto the swipe-back gesture while this page is on top. Consulted on every touch, so it can
   * depend on live state — an open modal, a dirty form, an in-flight payment.
   *
   * A veto only. It cannot turn the gesture *on* where `NgxStackSwipe` or the outlet have
   * turned it off. For a page that is simply never swipeable, `data: { swipeBack: false }` on
   * the route says the same thing without any code.
   *
   * This is also how a route with a `canDeactivate` guard opts back into the gesture — see
   * `guardPolicy`.
   */
  ngxCanSwipeBack?(): boolean;
}

type LifecycleHook = Exclude<keyof NgxStackPage, 'ngxCanSwipeBack'>;

export function callLifecycle(entry: StackEntry | null, hook: LifecycleHook): void {
  const instance = entry?.ref.instance as NgxStackPage | undefined;
  instance?.[hook]?.();
}

/**
 * Does the page on top object to being swiped away? Two ways to say so, both vetoes:
 * `data: { swipeBack: false }` on the route for a page that never allows it, and
 * `ngxCanSwipeBack()` on the component for one that decides in the moment.
 *
 * @param guardPolicy When `'block'`, a route carrying a `canDeactivate` guard refuses the
 *   gesture unless its component implements `ngxCanSwipeBack()`. The guard would otherwise run
 *   only *after* the page had already animated away, and refusing at that point can do nothing
 *   but bounce it back.
 */
export function pageAllowsSwipeBack(
  entry: StackEntry | null,
  guardPolicy: 'block' | 'allow' = 'allow',
): boolean {
  if (!entry) return false;

  const snapshot = entry.route?.snapshot;
  if (snapshot?.data['swipeBack'] === false) return false;

  const page = entry.ref.instance as NgxStackPage | undefined;
  const answer = page?.ngxCanSwipeBack?.();

  if (answer !== undefined) return answer;

  if (guardPolicy === 'block' && (snapshot?.routeConfig?.canDeactivate?.length ?? 0) > 0) {
    return false;
  }

  return true;
}

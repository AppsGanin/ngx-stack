import { Location } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Router, type NavigationExtras } from '@angular/router';

import { NgxStackHistory } from './stack-history';

/** Key we tuck the intent under in `NavigationExtras.state`. */
export const NGX_STACK_DIRECTION = '__ngxStackDirection';

/** Lets a caller force a transition to be instant, e.g. while rebuilding a stack at startup. */
export const NGX_STACK_ANIMATED = '__ngxStackAnimated';

export type StackNavHint = 'forward' | 'back' | 'root';

/** Where a "back" would actually go. */
export interface BackTarget {
  url: string;
  /**
   * Whether that URL is a page we already have mounted beneath the current one. When it isn't —
   * a cold deep link, where there is nothing underneath — going back has to build it.
   */
  mounted: boolean;
}

/** Implemented by the outlet, so `back()` knows what is actually beneath the current page. */
export interface StackBackTarget {
  backTarget(): BackTarget | null;
}

/**
 * Navigation with an explicit stack intent.
 *
 * You don't have to use this for pushing — plain `router.navigate()` works, and the outlet infers
 * the direction by checking whether the target URL is already on the stack. It's for the cases
 * where that inference is wrong, and for going back, which is subtler than it looks.
 */
@Injectable({ providedIn: 'root' })
export class NgxStackNav {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly history = inject(NgxStackHistory);

  private target: StackBackTarget | null = null;

  /** @internal Called by `NgxStackOutlet`. */
  registerStack(target: StackBackTarget): void {
    this.target = target;
  }

  /** @internal */
  unregisterStack(target: StackBackTarget): void {
    if (this.target === target) this.target = null;
  }

  /**
   * Is there anywhere to go back to *within the app*?
   *
   * Ask this, not the shell. Capacitor and Cordova both report whether the *webview* can go back,
   * which is a statement about history — and history is a single linear thread while tabs are
   * several stacks, so it says yes when the only thing behind you is a different tab.
   */
  canGoBack(): boolean {
    return (this.target?.backTarget() ?? null) !== null;
  }

  /** Push a page on top, even if its URL is already somewhere on the stack. */
  forward(commands: unknown[] | string, extras?: NavigationExtras): Promise<boolean> {
    return this.navigate(commands, extras, 'forward');
  }

  /**
   * Go back one page. This is what the swipe gesture commits to, and what a back button should
   * call. There are three quite different situations behind that one word, and this picks between
   * them:
   *
   * 1. **There's a page below, and it's also the previous history entry.** The easy case. Use a
   *    real `history.back()`, so the URL, the browser's back button and the stack all keep telling
   *    the same story.
   *
   * 2. **There's a page below, but history disagrees.** This is what tabs do to you: history is a
   *    single linear thread, tabs are several stacks, and switching tabs leaves an unrelated page
   *    sitting behind you. `history.back()` would jump sideways out of the stack you're in, so
   *    navigate to the page we actually mean instead, replacing the current entry so that popping
   *    doesn't inflate history.
   *
   * 3. **There's nothing below at all.** A cold deep link — a push notification, a shared URL, a
   *    refresh three screens in. `history.back()` here walks out of the app entirely, which is
   *    almost never what the user meant by tapping a back arrow inside it. If the route declares
   *    where it sits (`data: { parent: '/inbox' }`) we build that page and animate to it as a back,
   *    exactly as though it had been there all along.
   */
  back(commands?: unknown[] | string, extras?: NavigationExtras): Promise<boolean> {
    if (commands !== undefined) {
      return this.navigate(commands, extras, 'back');
    }

    const target = this.target?.backTarget() ?? null;

    if (!target) {
      // Genuinely nowhere to go: no page below, no declared parent. Defer to the browser, which
      // may well leave the app — the honest outcome of there being nothing to go back to.
      this.location.back();
      return Promise.resolve(true);
    }

    if (target.mounted && this.history.previousUrl() === target.url) {
      this.location.back();
      return Promise.resolve(true);
    }

    return this.navigate(target.url, { ...extras, replaceUrl: true }, 'back');
  }

  /** Throw every stack away and start again from this page. */
  root(commands: unknown[] | string, extras?: NavigationExtras): Promise<boolean> {
    return this.navigate(commands, { ...extras, replaceUrl: true }, 'root');
  }

  private navigate(
    commands: unknown[] | string,
    extras: NavigationExtras | undefined,
    hint: StackNavHint,
  ): Promise<boolean> {
    const merged: NavigationExtras = {
      ...extras,
      state: { ...(extras?.state ?? {}), [NGX_STACK_DIRECTION]: hint },
    };
    return Array.isArray(commands)
      ? this.router.navigate(commands, merged)
      : this.router.navigateByUrl(commands, merged);
  }
}

/**
 * Read the intent off the navigation currently in flight.
 *
 * Only honoured for imperative navigations. A `popstate` carries the history entry's *stored*
 * state, which still holds whatever hint was set when that entry was first pushed — so trusting
 * it would make pressing Back re-read an old `'forward'` and push a duplicate page. For history
 * traversal the outlet works the direction out from the stack instead, which is unambiguous.
 */
export function readDirectionHint(router: Router): StackNavHint | null {
  const navigation = router.getCurrentNavigation();
  if (!navigation || navigation.trigger !== 'imperative') return null;

  const state = navigation.extras.state as Record<string, unknown> | undefined;
  const hint = state?.[NGX_STACK_DIRECTION];
  return hint === 'forward' || hint === 'back' || hint === 'root' ? hint : null;
}

/** `false` when the caller wants this navigation to land with no transition at all. */
export function readAnimatedHint(router: Router): boolean | null {
  const navigation = router.getCurrentNavigation();
  if (!navigation || navigation.trigger !== 'imperative') return null;

  const state = navigation.extras.state as Record<string, unknown> | undefined;
  const animated = state?.[NGX_STACK_ANIMATED];
  return typeof animated === 'boolean' ? animated : null;
}

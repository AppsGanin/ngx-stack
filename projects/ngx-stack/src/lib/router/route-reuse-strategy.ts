import { Injectable } from '@angular/core';
import type {
  ActivatedRouteSnapshot,
  DetachedRouteHandle,
  RouteReuseStrategy,
} from '@angular/router';

/**
 * Turns off Angular's own route store/detach machinery, because the stack does that job
 * instead — and better, for this purpose: Angular's version stores a detached view and
 * gives it back on request, while the stack keeps every page mounted and on screen, which
 * is what lets a swipe reveal the page underneath before any navigation has happened.
 *
 * The one thing we do care about is `shouldReuseRoute`. Angular's default reuses a route
 * whose config matches, so `/item/1 → /item/2` would recycle the same component instance.
 * On a stack those are two different pages, and going back from one to the other has to
 * work, so a change of params means a new page.
 */
@Injectable()
export class NgxStackRouteReuseStrategy implements RouteReuseStrategy {
  shouldDetach(): boolean {
    return false;
  }

  shouldAttach(): boolean {
    return false;
  }

  store(): void {
    // no-op
  }

  retrieve(): DetachedRouteHandle | null {
    return null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    if (future.routeConfig !== curr.routeConfig) return false;

    const futureParams = future.params;
    const currParams = curr.params;
    const futureKeys = Object.keys(futureParams);
    if (futureKeys.length !== Object.keys(currParams).length) return false;

    return futureKeys.every((key) => futureParams[key] === currParams[key]);
  }
}

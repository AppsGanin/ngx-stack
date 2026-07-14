import { Injectable, computed, inject, signal, type Signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, type ActivatedRouteSnapshot } from '@angular/router';

import { NGX_STACK_CONFIG } from '../config';
import { tabOfRoute } from './tab-url';

/**
 * Remembers where you were in each tab.
 *
 * The stacks themselves are `NgxStackOutlet`'s job — configure `tabs` and it keeps one per tab,
 * mounted and untouched while you're elsewhere. This is the other half: tapping "Search" should
 * take you back to the search result you were reading three screens deep, not dump you at the
 * search tab's front page. So we watch navigations, note the current URL of each tab, and
 * `select()` returns you to it.
 *
 * The tab *bar* is yours to draw — the library ships no visual design. All you need from us:
 *
 * ```ts
 * const tabs = inject(NgxStackTabs);
 * ```
 * ```html
 * @for (tab of ['home', 'search', 'profile']; track tab) {
 *   <button [class.active]="tabs.active() === tab" (click)="tabs.select(tab)">{{ tab }}</button>
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class NgxStackTabs {
  private readonly router = inject(Router);
  private readonly config = inject(NGX_STACK_CONFIG);

  private readonly urls = signal<Record<string, string>>({});
  private readonly _active = signal('');

  /** The tab currently on screen, or `''` before the first navigation into one. */
  readonly active: Signal<string> = this._active.asReadonly();

  /** The tabs you configured, in order. */
  readonly tabs: Signal<readonly string[]> = computed(() => this.config.tabs ?? []);

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (!(event instanceof NavigationEnd)) return;

      const url = event.urlAfterRedirects;

      // Exactly the rule the outlet uses to file the page, so the bar and the stacks can't disagree.
      const tab = tabOfRoute(this.leaf(), url, this.config.tabs);
      if (!tab) return;

      this._active.set(tab);
      this.urls.update((urls) => ({ ...urls, [tab]: url }));
    });
  }

  /** The page that actually landed. */
  private leaf(): ActivatedRouteSnapshot {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    return route;
  }

  /** Where `tab` was last seen, or its front page if it hasn't been visited yet. */
  urlOf(tab: string): string {
    return this.urls()[tab] ?? `/${tab}`;
  }

  /**
   * Switch to `tab`, landing back on whatever page you last had open there.
   *
   * Tapping the tab you're already on takes you to its root, which is what every native tab bar
   * does — it's the standard way back out of a deep drill-down.
   */
  select(tab: string): Promise<boolean> {
    if (tab === this._active()) {
      return this.router.navigateByUrl(`/${tab}`);
    }
    return this.router.navigateByUrl(this.urlOf(tab));
  }
}

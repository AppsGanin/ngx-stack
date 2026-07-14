import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

/**
 * A shadow copy of where we are in the browser's history.
 *
 * The browser will not tell you what `history.back()` would land on, and with tabs we have to
 * know. History is one linear thread; tabs are several independent stacks. Drill into Inbox,
 * switch to Search, drill in there — now the entry behind you is an *Inbox* page, and going
 * "back" in Search must not take you to it. So we keep our own list and cursor, and whoever is
 * popping can ask whether plain `history.back()` happens to do the right thing.
 */
@Injectable({ providedIn: 'root' })
export class NgxStackHistory {
  private readonly router = inject(Router);

  private entries: string[] = [];
  private cursor = -1;

  private trigger: 'imperative' | 'popstate' | 'hashchange' = 'imperative';
  private replacing = false;

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.trigger = event.navigationTrigger ?? 'imperative';
        this.replacing = this.router.getCurrentNavigation()?.extras.replaceUrl === true;
        return;
      }
      if (event instanceof NavigationEnd) {
        this.record(event.urlAfterRedirects);
      }
    });
  }

  /** Where `history.back()` would actually land, or `null` if there's nothing behind us. */
  previousUrl(): string | null {
    return this.cursor > 0 ? this.entries[this.cursor - 1] : null;
  }

  private record(url: string): void {
    if (this.trigger === 'popstate') {
      // The browser moved the cursor. Work out which way by looking either side of it.
      if (this.cursor > 0 && this.entries[this.cursor - 1] === url) {
        this.cursor--;
        return;
      }
      if (this.cursor + 1 < this.entries.length && this.entries[this.cursor + 1] === url) {
        this.cursor++;
        return;
      }
      // A jump of more than one step, or into history from before the app loaded. We can't map
      // it, so drop what we think we know rather than answer confidently and wrongly.
      this.entries = [url];
      this.cursor = 0;
      return;
    }

    if (this.replacing && this.cursor >= 0) {
      this.entries[this.cursor] = url;
      return;
    }

    // A fresh navigation discards anything ahead of the cursor, exactly as the browser does.
    this.entries = this.entries.slice(0, this.cursor + 1);
    this.entries.push(url);
    this.cursor = this.entries.length - 1;
  }
}

import { ChangeDetectionStrategy, Component, DOCUMENT, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgxStackSwipe } from 'ngx-stack';

@Component({
  selector: 'demo-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './shell.scss',
  template: `
    <header class="bar">
      <span class="spacer"></span>
      <h1>Settings</h1>
      <span class="spacer"></span>
    </header>

    <div class="body">
      <!-- The app-wide switch. Try swiping after turning it off. -->
      <button
        class="big"
        type="button"
        data-test="toggle-swipe"
        (click)="swipe.set(!swipe.enabled())"
        [style.background]="swipe.enabled() ? '#34c759' : '#ff3b30'"
      >
        Swipe-back: {{ swipe.enabled() ? 'ON — tap to disable' : 'OFF — tap to enable' }}
      </button>

      <!-- Nothing in the library is configured for this. It reads the computed direction off the
           host element, so flipping dir on <html> is the entire integration. -->
      <button
        class="big"
        type="button"
        data-test="toggle-rtl"
        (click)="toggleRtl()"
        style="background: #5856d6"
      >
        Direction: {{ rtl() ? 'RTL — swipe lives on the right' : 'LTR — swipe lives on the left' }}
      </button>

      <p class="note">
        In RTL everything mirrors: pages arrive from the left, and the edge gesture moves to the
        right edge and pulls the other way. Turn it on, go into a page, and swipe from the right.
      </p>

      <button class="big" type="button" data-test="go-sheet" (click)="go('/settings/sheet')">
        Imperative stack (no URLs)
      </button>

      <button
        class="big"
        type="button"
        data-test="go-guarded"
        (click)="go('/settings/guarded')"
        style="background: #ff9500"
      >
        A page with a canDeactivate guard
      </button>
    </div>
  `,
})
export class SettingsPage {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  protected readonly swipe = inject(NgxStackSwipe);
  protected readonly rtl = signal(false);

  toggleRtl(): void {
    const next = !this.rtl();
    this.rtl.set(next);
    this.document.documentElement.dir = next ? 'rtl' : 'ltr';
  }

  go(url: string): void {
    void this.router.navigateByUrl(url);
  }
}

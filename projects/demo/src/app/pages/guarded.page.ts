import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { NgxStackNav } from 'ngx-stack';

/**
 * An ordinary Angular guard. It runs on the back *button* — but never on the swipe, because with
 * the default `guardPolicy: 'block'` the presence of a `canDeactivate` guard is enough for the
 * gesture to refuse to start.
 *
 * That policy exists because the gesture animates the page away *before* the navigation runs. A
 * guard that then says no can do nothing but bounce the page back, which looks broken. Better to
 * never start.
 */
export const unsavedChangesGuard: CanDeactivateFn<GuardedPage> = () =>
  confirm('Discard your changes and leave?');

@Component({
  selector: 'demo-guarded',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './shell.scss',
  template: `
    <header class="bar">
      <button type="button" data-test="guarded-back" (click)="back()">‹ Settings</button>
      <h1>Guarded</h1>
      <span class="spacer"></span>
    </header>

    <div class="body">
      <p class="note">
        This route has a <code>canDeactivate</code> guard, so the swipe gesture won't start at all —
        try it. The back button above still works, and pops a confirm dialog, which is exactly where
        a confirmation belongs.
      </p>
      <p class="note">
        A page that wants the gesture <em>and</em> a guard can implement
        <code>ngxCanSwipeBack()</code>, which is synchronous and so can refuse before anything
        moves. Or set <code>guardPolicy: 'allow'</code> and accept the bounce.
      </p>
    </div>
  `,
})
export class GuardedPage {
  private readonly nav = inject(NgxStackNav);

  back(): void {
    void this.nav.back();
  }
}

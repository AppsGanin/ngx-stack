import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { NgxStackPage } from 'ngx-stack';

@Component({
  selector: 'demo-inbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styleUrl: './shell.scss',
  template: `
    <header class="bar">
      <span class="spacer"></span>
      <h1>Inbox</h1>
      <span class="spacer"></span>
    </header>

    <div class="body">
      <p class="note">
        Tap a row, then drag from the left edge to come back. The list keeps its scroll position
        because the page was never unmounted — entered <code>{{ enters() }}</code> time(s).
      </p>
      <p class="note">
        Now drill in, switch to <b>Search</b>, and come back. Still here, still scrolled, still as
        deep as you left it: this tab has its own stack.
      </p>

      <button class="big" type="button" data-test="go-starred" (click)="starred()">
        Open /starred — a page whose URL doesn't name its tab
      </button>
    </div>

    <!-- Real links, not divs with a click handler: they focus, they respond to Enter, and a screen
         reader announces them as navigation. routerLink pushes the stack exactly like navigate(). -->
    @for (item of items; track item.id) {
      <a class="row" [routerLink]="['/inbox/item', item.id]">
        <span>Message {{ item.id }}</span>
        <span class="chev">›</span>
      </a>
    }
  `,
})
export class InboxPage implements NgxStackPage {
  private readonly router = inject(Router);

  readonly enters = signal(0);
  readonly items = Array.from({ length: 40 }, (_, i) => ({ id: i + 1 }));

  ngxViewDidEnter(): void {
    this.enters.update((n) => n + 1);
  }

  starred(): void {
    void this.router.navigateByUrl('/starred');
  }
}

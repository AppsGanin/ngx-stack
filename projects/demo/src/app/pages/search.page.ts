import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { NgxStackPage } from 'ngx-stack';

/** Uses `routerLink` rather than `router.navigate()`, to prove the plain Angular way works. */
@Component({
  selector: 'demo-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styleUrl: './shell.scss',
  template: `
    <header class="bar">
      <span class="spacer"></span>
      <h1>Search</h1>
      <span class="spacer"></span>
    </header>

    <div class="body">
      <p class="note">
        A second, completely independent stack. Whatever you type here and however deep you go, the
        Inbox tab is untouched — its pages are still mounted, just hidden.
      </p>
      <input
        data-test="query"
        [value]="query()"
        (input)="query.set($any($event.target).value)"
        placeholder="Type here, then switch tabs and come back"
        class="field"
      />
    </div>

    @for (n of [1, 2, 3, 4, 5]; track n) {
      <a class="row" [routerLink]="['/search/result', n]">
        <span>Result {{ n }}</span>
        <span class="chev">›</span>
      </a>
    }
  `,
})
export class SearchPage implements NgxStackPage {
  readonly query = signal('');
  readonly enters = signal(0);

  ngxViewDidEnter(): void {
    this.enters.update((n) => n + 1);
  }
}

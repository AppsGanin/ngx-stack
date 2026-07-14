import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgxStackNav } from 'ngx-stack';

@Component({
  selector: 'demo-result',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styleUrl: './shell.scss',
  template: `
    <header class="bar">
      <button type="button" (click)="back()">‹ Search</button>
      <h1>Result {{ id }}</h1>
      <span class="spacer"></span>
    </header>

    <div class="body">
      <p class="note">
        Reached with a plain <code>routerLink</code>. Now switch to Inbox and back — you land here,
        not on the Search front page, because <code>NgxStackTabs</code> remembers where each tab
        was.
      </p>

      <a class="big" style="text-align: center" [routerLink]="['/search/result', next]">
        routerLink to Result {{ next }} — pushes
      </a>

      <button
        class="big"
        type="button"
        data-test="replace"
        (click)="replace()"
        style="background: #ff9500"
      >
        Same navigation with replaceUrl — swaps the top page instead
      </button>
    </div>
  `,
})
export class ResultPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly nav = inject(NgxStackNav);

  readonly id = Number(this.route.snapshot.paramMap.get('id') ?? 0);
  readonly next = this.id + 1;

  /** History doesn't grow, so neither does the stack — the top page is swapped, not stacked on. */
  replace(): void {
    void this.router.navigate(['/search/result', this.next], { replaceUrl: true });
  }

  back(): void {
    void this.nav.back();
  }
}

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgxStackNav } from 'ngx-stack';

@Component({
  selector: 'demo-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './shell.scss',
  template: `
    <header class="bar">
      <button type="button" (click)="back()">‹ Back</button>
      <h1>Message {{ id }}</h1>
      <span class="spacer"></span>
    </header>

    <div class="body">
      <p class="note">
        Pushed by a plain <code>router.navigate()</code>. The outlet worked out it was a push
        because <code>/inbox/item/{{ id }}</code> wasn't on the stack yet.
      </p>

      <input
        [value]="draft()"
        (input)="draft.set($any($event.target).value)"
        placeholder="Type, swipe back, then return — it's still here"
        class="field"
      />

      <button class="big" type="button" (click)="notes()">Push a third page</button>
      <button class="big" type="button" data-test="deeper" (click)="deeper()">
        Push /inbox/item/{{ id + 1 }} — go as deep as you like, every page keeps its state
      </button>
      <button class="big" type="button" (click)="home()" style="background: #8e8e93">
        Reset the whole app to Inbox (root)
      </button>
    </div>
  `,
})
export class ItemPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly nav = inject(NgxStackNav);

  readonly id = Number(this.route.snapshot.paramMap.get('id') ?? 0);

  /** Local state that survives a swipe-back-and-return, proving the page stays mounted. */
  readonly draft = signal('');

  back(): void {
    void this.nav.back();
  }

  notes(): void {
    void this.router.navigate(['/inbox/item', this.id, 'notes']);
  }

  deeper(): void {
    void this.router.navigate(['/inbox/item', this.id + 1]);
  }

  /** `root` throws every stack away — otherwise navigating to /inbox would just unwind to it. */
  home(): void {
    void this.nav.root(['/inbox']);
  }
}

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgxStackNav, type NgxStackPage } from 'ngx-stack';

@Component({
  selector: 'demo-notes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './shell.scss',
  template: `
    <header class="bar">
      <button type="button" (click)="back()">‹ Message {{ id }}</button>
      <h1>Notes</h1>
      <span class="spacer"></span>
    </header>

    <div class="body">
      <label class="note" style="display: flex; gap: 10px; align-items: center; cursor: pointer">
        <input
          type="checkbox"
          data-test="dirty"
          [checked]="dirty()"
          (change)="dirty.set($any($event.target).checked)"
        />
        <span>
          Unsaved changes — while ticked, <code>ngxCanSwipeBack()</code> returns false and the
          gesture won't even start. The back button still works, which is where a confirm dialog
          belongs.
        </span>
      </label>

      @for (n of [1, 2, 3, 4, 5, 6]; track n) {
        <p>Note {{ n }} — lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
      }
    </div>
  `,
})
export class NotesPage implements NgxStackPage {
  private readonly route = inject(ActivatedRoute);
  private readonly nav = inject(NgxStackNav);

  readonly id = Number(this.route.snapshot.paramMap.get('id') ?? 0);
  readonly dirty = signal(false);

  constructor() {
    // Counted so the e2e can prove that rebuilding the ancestors of a deep link doesn't construct
    // the deep page twice — which is exactly what a naive "navigate again afterwards" would do.
    const win = window as unknown as { __notesBuilds?: number };
    win.__notesBuilds = (win.__notesBuilds ?? 0) + 1;
  }

  /** Asked on every touch that lands in the edge zone, so it can depend on live state. */
  ngxCanSwipeBack(): boolean {
    return !this.dirty();
  }

  back(): void {
    void this.nav.back();
  }
}

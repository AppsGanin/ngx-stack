import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgxStack, NgxStackNav } from 'ngx-stack';

import { FilterStep1 } from './filter-steps';

/**
 * The imperative stack. Same transition, same swipe-back, but the steps inside never touch
 * the URL — so the browser's back button leaves the sheet as a whole rather than unwinding
 * it one step at a time.
 */
@Component({
  selector: 'demo-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxStack],
  styleUrl: './shell.scss',
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    ngx-stack {
      flex: 1 1 auto;
      min-height: 0;
      --ngx-stack-page-background: #fff;
    }
  `,
  template: `
    <header class="bar">
      <button type="button" (click)="close()">‹ Settings</button>
      <h1>Filters</h1>
      <span class="spacer"></span>
    </header>

    <ngx-stack [root]="rootPage" />
  `,
})
export class SheetPage {
  private readonly nav = inject(NgxStackNav);

  readonly rootPage = FilterStep1;

  close(): void {
    void this.nav.back();
  }
}

import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { NgxStack } from 'ngx-stack';

@Component({
  selector: 'demo-filter-3',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './shell.scss',
  template: `
    <header class="bar">
      <button type="button" (click)="stack.pop()">‹ Back</button>
      <h1>Price</h1>
      <span class="spacer"></span>
    </header>
    <div class="body">
      <p class="note">
        Step 3 of an imperative stack. Category: <code>{{ category() }}</code> — passed in as a
        component input by <code>push()</code>.
      </p>
      <button class="big" type="button" (click)="stack.popToRoot()">Back to step 1</button>
    </div>
  `,
})
export class FilterStep3 {
  protected readonly stack = inject(NgxStack);
  readonly category = input('');
}

@Component({
  selector: 'demo-filter-2',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './shell.scss',
  template: `
    <header class="bar">
      <button type="button" (click)="stack.pop()">‹ Back</button>
      <h1>Brand</h1>
      <span class="spacer"></span>
    </header>
    <div class="body">
      <p class="note">Step 2. The URL has not changed — check the address bar.</p>
      <button class="big" type="button" (click)="next()">Continue to price</button>
    </div>
  `,
})
export class FilterStep2 {
  protected readonly stack = inject(NgxStack);

  next(): void {
    void this.stack.push(FilterStep3, { category: 'shoes' });
  }
}

@Component({
  selector: 'demo-filter-1',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './shell.scss',
  template: `
    <header class="bar">
      <span class="spacer"></span>
      <h1>Category</h1>
      <span class="spacer"></span>
    </header>
    <div class="body">
      <p class="note">
        Step 1. <code>inject(NgxStack)</code> gets you the stack you are standing on; swipe-back
        works in here too.
      </p>
      <button class="big" type="button" (click)="next()">Continue to brand</button>
    </div>
  `,
})
export class FilterStep1 {
  protected readonly stack = inject(NgxStack);

  next(): void {
    void this.stack.push(FilterStep2);
  }
}

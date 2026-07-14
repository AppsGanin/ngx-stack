import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  ViewEncapsulation,
  inject,
  input,
  type OnInit,
  type Signal,
  type Type,
} from '@angular/core';

import type { GuardPolicy } from '../config';
import type { InteractiveBack } from '../core/stack-controller';
import type { StackEntry } from '../core/stack-entry';
import { StackHostBase } from '../core/stack-host';

/** Imperative stacks have no URLs, so all their pages live in the one unnamed stack. */
const NO_TAB = '';

/**
 * A self-contained page stack with no URLs — the escape hatch for navigation that has no business
 * being in the address bar.
 *
 * A multi-step filter sheet, a wizard inside a modal, a drill-down in one tab of a tab bar: these
 * are all stacks, they all want the same push/pop transition and the same swipe-back, and none of
 * them should push history entries that the browser's back button then has to unwind one at a time.
 *
 * ```html
 * <ngx-stack [root]="FilterStep1" #filters />
 * ```
 * ```ts
 * filters.push(FilterStep2, { category: 'shoes' });
 * ```
 *
 * Pages reach the stack they are standing on with `inject(NgxStack)`. For anything the user should
 * be able to link to, bookmark or reload, use `<ngx-stack-outlet>` instead.
 */
@Component({
  selector: 'ngx-stack',
  template: '',
  host: { class: 'ngx-stack-host' },
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  exportAs: 'ngxStack',
})
export class NgxStack extends StackHostBase implements OnInit {
  /** The bottom page. Mounted on init; use `setRoot()` to change it afterwards. */
  readonly root = input<Type<unknown> | null>(null);

  /** Inputs for the root page, applied with `setInput`. */
  readonly rootInputs = input<Record<string, unknown>>();

  /**
   * Swipe-back for this stack specifically. `null` (the default) defers to `NgxStackSwipe`, the
   * app-wide switch; `true` or `false` overrides it here.
   */
  readonly swipeBack = input<boolean | null>(null);

  /** The stack's own node injector, so pages can `inject(NgxStack)` and push further. */
  private readonly pageInjector = inject(Injector);

  readonly canGoBack: Signal<boolean> = this.controller.canGoBack;

  ngOnInit(): void {
    const root = this.root();
    if (root) {
      const entry = this.mount(root, this.rootInputs());
      void this.controller.run({ kind: 'push', tab: NO_TAB, entering: entry, animated: false });
    }
    this.startGesture();
  }

  /** Push a page on top. Resolves when the transition has finished. */
  push<T>(component: Type<T>, inputs?: Record<string, unknown>): Promise<void> {
    const entry = this.mount(component, inputs);
    return this.controller.run({ kind: 'push', tab: NO_TAB, entering: entry, animated: true });
  }

  /** Pop the top page. A no-op at the root, so it is safe to call blindly. */
  pop(): Promise<void> {
    return this.popTo(this.controller.depth() - 2);
  }

  /** Unwind to the page at `index` (0 is the root), destroying everything above it. */
  popTo(index: number): Promise<void> {
    if (index < 0 || index >= this.controller.depth() - 1) return Promise.resolve();
    return this.controller.run({ kind: 'pop', tab: NO_TAB, toIndex: index, animated: true });
  }

  popToRoot(): Promise<void> {
    return this.popTo(0);
  }

  /** Throw the stack away and start again from `component`. */
  setRoot<T>(component: Type<T>, inputs?: Record<string, unknown>): Promise<void> {
    const entry = this.mount(component, inputs);
    return this.controller.run({ kind: 'root', tab: NO_TAB, entering: entry, animated: true });
  }

  // ---------------------------------------------------------------------------
  // StackHostBase
  // ---------------------------------------------------------------------------

  protected swipeBackOverride(): boolean | null {
    return this.swipeBack();
  }

  /** No routes here, so no `canDeactivate` guards to be careful about. */
  protected guardPolicy(): GuardPolicy {
    return 'allow';
  }

  commitSwipeBack(back: InteractiveBack, ms: number): void {
    void back.player.settle(1, ms).then(() => {
      const index = this.controller.pages().indexOf(back.entering);
      if (index < 0) return;

      // Hand the finished player over so the pop finalises rather than animating a second time.
      void this.controller.run({
        kind: 'pop',
        tab: NO_TAB,
        toIndex: index,
        animated: true,
        player: back.player,
      });
    });
  }

  // ---------------------------------------------------------------------------

  private mount<T>(component: Type<T>, inputs?: Record<string, unknown>): StackEntry {
    const ref = this.createPage(component, { injector: this.pageInjector });

    for (const [name, value] of Object.entries(inputs ?? {})) {
      ref.setInput(name, value);
    }

    return this.controller.adopt(ref, '', null, NO_TAB);
  }
}

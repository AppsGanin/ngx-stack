import {
  ChangeDetectorRef,
  DOCUMENT,
  Directive,
  ElementRef,
  EnvironmentInjector,
  type Injector,
  ViewContainerRef,
  inject,
  output,
  type ComponentRef,
  type OnDestroy,
  type Signal,
  type Type,
} from '@angular/core';

import { NGX_STACK_CONFIG, type GuardPolicy } from '../config';
import { SwipeBackGesture, type SwipeBackHost } from '../gesture/swipe-back-gesture';
import { NgxStackSwipe } from '../gesture/swipe-service';
import { NGX_STACK_PLATFORM } from '../platform/platform';
import {
  StackController,
  type InteractiveBack,
  type StackTransitionEvent,
} from './stack-controller';
import { pageAllowsSwipeBack, type StackEntry } from './stack-entry';
import { ensureStackStyles } from './styles';

/**
 * Everything the two kinds of stack have in common — which is almost everything.
 *
 * `NgxStackOutlet` is fed by the Router and `NgxStack` by `push()`, and that difference is real but
 * shallow: it only decides *where the next page comes from*. Once a page exists, holding it,
 * transitioning to it, dragging it around with a finger and tearing it down are identical jobs, and
 * a swipe-back must behave the same in both. Keeping that in one place is the only way it stays that
 * way.
 *
 * So a subclass supplies three things — how strict to be about guards, whether it overrides the
 * app-wide swipe switch, and what a committed swipe should actually *do* — and inherits the rest.
 */
@Directive()
export abstract class StackHostBase implements SwipeBackHost, OnDestroy {
  /** Fires as a transition begins — including one a finger is about to scrub. */
  readonly transitionStart = output<StackTransitionEvent>();
  /** Fires once the pages have settled and any popped page has been destroyed. */
  readonly transitionEnd = output<StackTransitionEvent>();

  protected readonly config = inject(NGX_STACK_CONFIG);
  protected readonly platform = inject(NGX_STACK_PLATFORM);
  protected readonly swipe = inject(NgxStackSwipe);
  protected readonly viewContainer = inject(ViewContainerRef);
  protected readonly environmentInjector = inject(EnvironmentInjector);
  protected readonly changeDetector = inject(ChangeDetectorRef);

  readonly hostEl: HTMLElement = inject(ElementRef<HTMLElement>).nativeElement;

  protected readonly controller = new StackController(this.hostEl, this.config, this.platform);

  private gesture: SwipeBackGesture | null = null;

  /** The active stack's pages, bottom first. */
  readonly pages: Signal<readonly StackEntry[]> = this.controller.pages;
  readonly depth: Signal<number> = this.controller.depth;
  readonly animating: Signal<boolean> = this.controller.animating;

  constructor() {
    ensureStackStyles(inject(DOCUMENT));
    this.controller.onTransitionStart = (event) => this.transitionStart.emit(event);
    this.controller.onTransitionEnd = (event) => this.transitionEnd.emit(event);
  }

  /** Arm the gesture. Subclasses call this once they are ready to be swiped. */
  protected startGesture(): void {
    this.gesture = new SwipeBackGesture(this, this.config, this.platform);
  }

  // ---------------------------------------------------------------------------
  // Creating pages
  // ---------------------------------------------------------------------------

  /**
   * Instantiate a page component and hand it to the controller to be wrapped and mounted.
   *
   * The `markForCheck` matters and is easy to lose: both hosts are OnPush with an empty template of
   * their own, so nothing would ever dirty the view and the freshly inserted page would sit there
   * un-checked until something unrelated happened to trigger a pass.
   */
  protected createPage<T>(
    component: Type<T>,
    options: { injector: Injector; environmentInjector?: EnvironmentInjector },
  ): ComponentRef<T> {
    const ref = this.viewContainer.createComponent(component, {
      index: this.viewContainer.length,
      injector: options.injector,
      environmentInjector: options.environmentInjector ?? this.environmentInjector,
    });

    this.changeDetector.markForCheck();
    return ref;
  }

  // ---------------------------------------------------------------------------
  // SwipeBackHost
  // ---------------------------------------------------------------------------

  /**
   * Three layers, narrowest last, each able to veto: the app-wide switch, this stack, and the page
   * currently on top. Re-evaluated on every touch, so all three can change at runtime.
   */
  canSwipeBack(): boolean {
    // An explicit value on the stack overrides the app-wide one, in both directions.
    if (!(this.swipeBackOverride() ?? this.swipe.enabled())) return false;

    // Deliberately `depth()`, not `canGoBack()`: the latter counts pages evicted by `maxDepth` and
    // parents that were never built, which no longer exist and so cannot be dragged into view. A
    // button can still take you there; a finger can't drag what isn't on screen.
    if (this.controller.depth() < 2 || this.controller.animating()) return false;

    return pageAllowsSwipeBack(this.controller.top(), this.guardPolicy());
  }

  isRtl(): boolean {
    return this.controller.isRtl();
  }

  beginSwipeBack(): InteractiveBack | null {
    return this.controller.beginInteractiveBack();
  }

  abortSwipeBack(back: InteractiveBack, ms: number): void {
    void this.controller.abortInteractiveBack(back, ms);
  }

  /** The user let go past the threshold. The animation is done; make the pop real. */
  abstract commitSwipeBack(back: InteractiveBack, ms: number): void;

  /** `null` to defer to the app-wide {@link NgxStackSwipe}. */
  protected abstract swipeBackOverride(): boolean | null;

  /** Only routed pages can carry a `canDeactivate` guard, so only they need a policy for one. */
  protected abstract guardPolicy(): GuardPolicy;

  // ---------------------------------------------------------------------------

  ngOnDestroy(): void {
    this.gesture?.destroy();
    this.controller.destroy();
  }
}

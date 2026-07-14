import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  type EnvironmentInjector,
  EventEmitter,
  type Injector,
  ViewEncapsulation,
  computed,
  inject,
  input,
  type ComponentRef,
  type OnDestroy,
  type OnInit,
  type Signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  ChildrenOutletContexts,
  NavigationCancel,
  NavigationError,
  PRIMARY_OUTLET,
  Router,
  type Data,
  type RouterOutletContract,
} from '@angular/router';

import type { GuardPolicy } from '../config';
import type { InteractiveBack } from '../core/stack-controller';
import type { StackEntry } from '../core/stack-entry';
import { StackHostBase } from '../core/stack-host';
import { SystemTransitionWatcher } from '../platform/system-transition';
import { deriveParentUrl } from './parent-url';
import {
  NgxStackNav,
  readAnimatedHint,
  readDirectionHint,
  type BackTarget,
  type StackBackTarget,
} from './stack-nav';
import { tabOfRoute } from './tab-url';

/** What Angular's own `OutletInjector` does: hand routed components their route and contexts. */
class StackOutletInjector implements Injector {
  constructor(
    private readonly route: ActivatedRoute,
    private readonly childContexts: ChildrenOutletContexts,
    private readonly parent: Injector,
  ) {}

  get(token: unknown, notFoundValue?: unknown, options?: unknown): unknown {
    if (token === ActivatedRoute) return this.route;
    if (token === ChildrenOutletContexts) return this.childContexts;
    return (this.parent as { get: (...args: unknown[]) => unknown }).get(
      token,
      notFoundValue,
      options,
    );
  }
}

/**
 * A `<router-outlet>` that keeps a stack instead of a single page.
 *
 * The stock outlet destroys the outgoing component the moment you navigate. That is the right
 * default and completely incompatible with a swipe-back: the page you are swiping back to has to
 * already be on screen, mounted and painted, *before* the navigation that reveals it happens —
 * otherwise there is nothing to drag into view.
 *
 * So pages here are mounted once and stay. Which one you are looking at is decided by where you are
 * in the history, and the direction of each transition is inferred by asking whether the incoming
 * URL is already on the stack (going back) or not (going forward).
 *
 * With `tabs` configured, one outlet holds one stack per tab and shows the active one.
 */
@Component({
  selector: 'ngx-stack-outlet',
  template: '',
  host: { class: 'ngx-stack-host' },
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  exportAs: 'ngxStackOutlet',
})
export class NgxStackOutlet
  extends StackHostBase
  implements OnInit, OnDestroy, RouterOutletContract, StackBackTarget
{
  /** Matches `<router-outlet name>`, for named outlets. */
  readonly name = input(PRIMARY_OUTLET);

  /**
   * Swipe-back for this stack specifically. `null` (the default) defers to `NgxStackSwipe`, the
   * app-wide switch; `true` or `false` overrides it here.
   */
  readonly swipeBack = input<boolean | null>(null);

  private readonly parentContexts = inject(ChildrenOutletContexts);
  private readonly router = inject(Router);
  private readonly nav = inject(NgxStackNav);
  private readonly document = inject(DOCUMENT);

  private systemTransition: SystemTransitionWatcher | null = null;

  private activatedRouteRef: ActivatedRoute | null = null;
  private current: StackEntry | null = null;
  private initialized = false;

  /** A committed swipe, animated to the end, waiting for the router to catch up. */
  private pendingSwipe: InteractiveBack | null = null;

  // Required by RouterOutletContract, which predates `output()` and types these as EventEmitters.
  readonly activateEvents = new EventEmitter<unknown>();
  readonly deactivateEvents = new EventEmitter<unknown>();
  readonly attachEvents = new EventEmitter<unknown>();
  readonly detachEvents = new EventEmitter<unknown>();

  readonly activeTab: Signal<string> = this.controller.activeTab;

  /**
   * Is there anywhere to go back to? Show your back button on this.
   *
   * True even with a single page on the stack, if that page has a parent it could go up to — which
   * is exactly the cold-deep-link case, where nothing is beneath but obviously something should be.
   */
  readonly canGoBack: Signal<boolean> = computed(
    () => this.controller.canGoBack() || this.parentOfTop() !== null,
  );

  constructor() {
    super();

    // If a navigation dies after a swipe has already animated the page away, put it back.
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationCancel || event instanceof NavigationError) {
        this.rollBackPendingSwipe();
      }
    });
  }

  ngOnInit(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.parentContexts.onChildOutletCreated(this.name(), this);

    // The route can be activated before the outlet exists — e.g. it sits inside an `@if` that only
    // just became true. Pick up whatever is already waiting for us.
    const context = this.parentContexts.getContext(this.name());
    if (context?.route) {
      this.activateWith(context.route, context.injector);
    }

    this.startGesture();
    this.nav.registerStack(this);

    const win = this.document.defaultView;
    if (win) this.systemTransition = new SystemTransitionWatcher(win);
  }

  // ---------------------------------------------------------------------------
  // RouterOutletContract
  // ---------------------------------------------------------------------------

  get isActivated(): boolean {
    return this.current !== null;
  }

  get component(): object | null {
    return (this.current?.ref.instance as object) ?? null;
  }

  get activatedRoute(): ActivatedRoute | null {
    return this.activatedRouteRef;
  }

  get activatedRouteData(): Data {
    return this.activatedRouteRef?.snapshot.data ?? {};
  }

  activateWith(route: ActivatedRoute, environmentInjector: EnvironmentInjector): void {
    const url = this.urlOf(route);
    const tab = tabOfRoute(route.snapshot, url, this.config.tabs);
    const hint = readDirectionHint(this.router);

    // If the browser already drew its own back animation, drawing ours would double it up.
    let animated = !(this.systemTransition?.consume() ?? false);

    // A caller rebuilding a stack at startup wants the pages to just *be* there, not to watch them
    // fly in one after another.
    if (readAnimatedHint(this.router) === false) animated = false;

    // Changing tabs is not a push and not a pop — it's a cut. Nothing is created, nothing destroyed,
    // the other tab's stack simply comes back on screen exactly as it was. Sliding it in would imply
    // a relationship between the two tabs that doesn't exist.
    if (tab !== this.controller.activeTab() && hint !== 'root') animated = false;

    const existingIndex = this.controller.findByUrl(url, tab);

    const swipe = this.pendingSwipe;
    this.pendingSwipe = null;

    if (swipe) {
      // The swipe already ran the whole animation. Hand its player to the controller so it finalises
      // instead of transitioning a second time — but only if history actually took us where the
      // swipe aimed. If something else intervened, throw the gesture's work away.
      const aimedAt =
        existingIndex >= 0 && this.controller.at(existingIndex, tab) === swipe.entering;

      if (aimedAt) {
        this.adopt(swipe.entering, route);
        void this.controller.run({
          kind: 'pop',
          tab,
          toIndex: existingIndex,
          animated: true,
          player: swipe.player,
        });
        return;
      }
      swipe.player.destroy();
    }

    const goingBack = hint !== 'forward' && hint !== 'root';

    // Already on the stack: unwind to it.
    if (goingBack && existingIndex >= 0) {
      this.adopt(this.controller.at(existingIndex, tab)!, route);
      void this.controller.run({ kind: 'pop', tab, toIndex: existingIndex, animated });
      return;
    }

    // Going back to a page that isn't mounted. Two ways that happens, wanting the same handling:
    // `maxDepth` evicted it, or we deep-linked into the middle of the app and are walking up to a
    // parent that was never built. Either way, rebuild it and animate as a *back*, because that is
    // what actually happened — whatever the DOM currently remembers about it.
    if (hint === 'back' || (goingBack && this.controller.wasPruned(url, tab))) {
      const entry = this.createEntry(route, environmentInjector, url, tab);
      this.adopt(entry, route);
      void this.controller.run({ kind: 'restore', tab, entering: entry, animated });
      this.activateEvents.emit(entry.ref.instance);
      return;
    }

    const entry = this.createEntry(route, environmentInjector, url, tab);
    this.adopt(entry, route);

    // `replaceUrl: true` says the history entry was overwritten rather than added. The stack has to
    // agree: swap the top page rather than stack a second one on it, or the stack grows while
    // history doesn't and a back button starts skipping pages.
    const replacing =
      this.router.getCurrentNavigation()?.extras.replaceUrl === true && this.controller.depth() > 0;

    void this.controller.run(
      hint === 'root'
        ? { kind: 'root', tab, entering: entry, animated }
        : replacing
          ? { kind: 'replace', tab, entering: entry, animated }
          : { kind: 'push', tab, entering: entry, animated },
    );
    this.activateEvents.emit(entry.ref.instance);
  }

  deactivate(): void {
    const entry = this.current;
    if (entry) {
      const context = this.parentContexts.getContext(this.name());
      if (context) {
        // Hold on to this page's nested outlets, so coming back to it doesn't find them empty.
        entry.savedContexts = context.children.onOutletDeactivated();
      }
      this.deactivateEvents.emit(entry.ref.instance);
    }

    // Note what we do *not* do here: destroy the component. It stays on the stack. If it is being
    // popped, the controller destroys it once the transition has played out.
    this.current = null;
    this.activatedRouteRef = null;
  }

  detach(): ComponentRef<unknown> {
    throw new Error(
      '[ngx-stack] detach() is not supported. <ngx-stack-outlet> manages page lifetime itself; a ' +
        'RouteReuseStrategy that returns shouldDetach: true will fight it. provideNgxStack() ' +
        'installs NgxStackRouteReuseStrategy for exactly this reason.',
    );
  }

  attach(): void {
    throw new Error('[ngx-stack] attach() is not supported. See detach().');
  }

  // ---------------------------------------------------------------------------
  // StackHostBase / BackTarget
  // ---------------------------------------------------------------------------

  protected swipeBackOverride(): boolean | null {
    return this.swipeBack();
  }

  protected guardPolicy(): GuardPolicy {
    return this.config.guardPolicy;
  }

  commitSwipeBack(back: InteractiveBack, ms: number): void {
    void back.player.settle(1, ms).then(() => {
      this.pendingSwipe = back;
      // Go back for real, so the URL and the browser's back button stay honest. The animation is
      // already finished; `activateWith` will adopt the player and just tidy up.
      void this.nav.back();
    });
  }

  /**
   * Where a "back" should actually go.
   *
   * Usually the page beneath the top of the *active* stack — which, with tabs, is emphatically not
   * whatever the browser happens to have behind us in history. When nothing is beneath, we fall back
   * to the page this one sits under. That page isn't mounted, so it has to be built; `mounted` is
   * how {@link NgxStackNav.back} tells the two apart, because only one of them can be served by a
   * plain `history.back()`.
   */
  backTarget(): BackTarget | null {
    const stack = this.controller.pages();
    if (stack.length >= 2) {
      return { url: stack[stack.length - 2].url, mounted: true };
    }

    const parent = this.parentOfTop();
    return parent ? { url: parent, mounted: false } : null;
  }

  private rollBackPendingSwipe(): void {
    const swipe = this.pendingSwipe;
    if (!swipe) return;
    this.pendingSwipe = null;
    void this.controller.abortInteractiveBack(swipe, this.config.duration);
  }

  // ---------------------------------------------------------------------------

  /**
   * Where the top page sits, when nothing is mounted underneath it.
   *
   * Nobody normally has to say: `/inbox/item/12` obviously sits under `/inbox`, and the route config
   * already knows it. `data: { parent }` is only for URLs that don't tell the truth.
   */
  private parentOfTop(): string | null {
    const url = this.controller.top()?.url;
    return url ? deriveParentUrl(this.router.config, url) : null;
  }

  private createEntry(
    route: ActivatedRoute,
    environmentInjector: EnvironmentInjector,
    url: string,
    tab: string,
  ): StackEntry {
    const component = route.snapshot.routeConfig?.component;
    if (!component) {
      throw new Error(
        `[ngx-stack] Route "${url}" has no component. <ngx-stack-outlet> can only host component ` +
          'routes — loadComponent is fine, but redirects and componentless routes are not.',
      );
    }

    const childContexts = this.parentContexts.getOrCreateContext(this.name()).children;
    const injector = new StackOutletInjector(route, childContexts, this.viewContainer.injector);

    const ref = this.createPage(component, { injector, environmentInjector });
    return this.controller.adopt(ref, url, route, tab);
  }

  /** Make `entry` the outlet's current page and give it back its nested outlets. */
  private adopt(entry: StackEntry, route: ActivatedRoute): void {
    entry.route = route;
    this.current = entry;
    this.activatedRouteRef = route;

    const context = this.parentContexts.getContext(this.name());
    if (context && entry.savedContexts) {
      context.children.onOutletReAttached(entry.savedContexts);
      entry.savedContexts = undefined;
    }
  }

  private urlOf(route: ActivatedRoute): string {
    return this.router.serializeUrl(this.router.createUrlTree(['.'], { relativeTo: route }));
  }

  override ngOnDestroy(): void {
    this.systemTransition?.destroy();
    this.nav.unregisterStack(this);
    this.parentContexts.onChildOutletDestroyed(this.name());
    super.ngOnDestroy();
  }
}

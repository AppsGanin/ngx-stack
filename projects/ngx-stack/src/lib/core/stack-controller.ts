import { computed, signal, type ComponentRef, type Signal } from '@angular/core';
import type { ActivatedRoute } from '@angular/router';

import { androidTransition } from '../animation/android-transition';
import { iosTransition } from '../animation/ios-transition';
import { webTransition } from '../animation/web-transition';
import type { StackDirection, StackTransition } from '../animation/transition';
import { TransitionPlayer } from '../animation/transition-player';
import type { ResolvedStackConfig } from '../config';
import type { StackPlatform, StackPlatformKind } from '../platform/platform';
import { announce } from './announcer';
import { callLifecycle, type StackEntry } from './stack-entry';

const BUILT_IN: Record<StackPlatformKind, StackTransition> = {
  ios: iosTransition,
  android: androidTransition,
  // Its own transition, which today happens to be identical to Android's — see web-transition.ts for
  // why they stay two things.
  web: webTransition,
};

/** A swipe-back in progress: the pages involved, and the transition the finger is scrubbing. */
export interface InteractiveBack {
  readonly player: TransitionPlayer;
  /** The page being uncovered — the one that will be on top if the swipe completes. */
  readonly entering: StackEntry;
  /** The page being dragged off — the current top. */
  readonly leaving: StackEntry;
}

/** Emitted around every transition, including the ones a finger is driving. */
export interface StackTransitionEvent {
  direction: StackDirection;
  entering: StackEntry;
  leaving: StackEntry | null;
  /** The tab this happened in, or `''` in a single-stack app. */
  tab: string;
  /** False when the pages simply swapped, e.g. a tab switch or reduced motion. */
  animated: boolean;
  /** True when a swipe-back drove it rather than a navigation. */
  interactive: boolean;
}

export type StackOp =
  /** Mount `entering` on top of `tab`'s stack. */
  | { kind: 'push'; tab: string; entering: StackEntry; animated: boolean }
  /**
   * Swap the top page for `entering`. What `router.navigate(…, { replaceUrl: true })` means for a
   * stack: history didn't grow, so neither should the stack.
   */
  | { kind: 'replace'; tab: string; entering: StackEntry; animated: boolean }
  /** Unwind `tab`'s stack to `toIndex`, destroying everything above it. */
  | { kind: 'pop'; tab: string; toIndex: number; animated: boolean; player?: TransitionPlayer }
  /** Replace *every* stack with this one page. */
  | { kind: 'root'; tab: string; entering: StackEntry; animated: boolean }
  /**
   * Rebuild a page that fell off the bottom of a capped stack, and make it the new bottom.
   * Everything currently in that stack sat above it, so all of it goes.
   */
  | { kind: 'restore'; tab: string; entering: StackEntry; animated: boolean };

interface RunningTransition {
  player: TransitionPlayer | null;
  entering: StackEntry;
  leaving: StackEntry | null;
  /** Pages removed from the stack whose DOM must survive until the animation ends. */
  removed: StackEntry[];
  event: StackTransitionEvent;
}

type Stacks = Record<string, readonly StackEntry[]>;

/**
 * Owns the pages of a stack — their DOM, their order, and the transitions between them.
 *
 * Deliberately free of framework plumbing: it knows nothing about the Router or about
 * imperative pushes. Both `NgxStackOutlet` and `NgxStack` drive this same class, which is why
 * a swipe-back behaves identically whether the stack is fed by URLs or by `push()`.
 *
 * With `tabs` configured it holds one stack *per tab* and shows the active one. Tabs are not a
 * feature bolted on top — they're the reason the pages live in a map keyed by tab rather than a
 * flat array. Switching tabs mounts nothing and destroys nothing; it just changes which stack's
 * top page is on screen, so the tab you left is still exactly where you left it.
 */
export class StackController {
  private readonly stacks = signal<Stacks>({});
  private readonly active = signal('');

  /** URLs evicted by `maxDepth`, per tab. Remembered so we still know they're *behind* us. */
  private readonly pruned = new Map<string, Set<string>>();

  /** The active tab's pages, bottom first. */
  readonly pages: Signal<readonly StackEntry[]> = computed(
    () => this.stacks()[this.active()] ?? [],
  );
  readonly depth = computed(() => this.pages().length);
  readonly canGoBack = computed(() => this.pages().length > 1 || this.hasPrunedPages());
  readonly activeTab: Signal<string> = this.active.asReadonly();

  private readonly _animating = signal(false);
  readonly animating: Signal<boolean> = this._animating.asReadonly();

  /** Set by the host so it can re-emit these as component outputs. */
  onTransitionStart?: (event: StackTransitionEvent) => void;
  onTransitionEnd?: (event: StackTransitionEvent) => void;

  private nextId = 0;
  private running: RunningTransition | null = null;
  private readonly doc: Document;

  constructor(
    private readonly hostEl: HTMLElement,
    private readonly config: ResolvedStackConfig,
    private readonly platform: StackPlatform,
  ) {
    this.doc = hostEl.ownerDocument;
  }

  // ---------------------------------------------------------------------------
  // Reading the stack
  // ---------------------------------------------------------------------------

  stackOf(tab: string): readonly StackEntry[] {
    return this.stacks()[tab] ?? [];
  }

  top(tab = this.active()): StackEntry | null {
    const stack = this.stackOf(tab);
    return stack.length ? stack[stack.length - 1] : null;
  }

  at(index: number, tab = this.active()): StackEntry | null {
    return this.stackOf(tab)[index] ?? null;
  }

  findByUrl(url: string, tab = this.active()): number {
    return this.stackOf(tab).findIndex((entry) => entry.url === url);
  }

  /** Was this URL evicted by `maxDepth`? If so it's behind us, not ahead of us. */
  wasPruned(url: string, tab = this.active()): boolean {
    return this.pruned.get(tab)?.has(url) ?? false;
  }

  private hasPrunedPages(): boolean {
    return (this.pruned.get(this.active())?.size ?? 0) > 0;
  }

  // ---------------------------------------------------------------------------
  // Building pages
  // ---------------------------------------------------------------------------

  /** Wrap a freshly created component in a page element and put it in the host. */
  adopt(
    ref: ComponentRef<unknown>,
    url: string,
    route: ActivatedRoute | null,
    tab = '',
  ): StackEntry {
    const element = this.doc.createElement('div');
    // Starts invisible so it can't paint at its resting position for a frame before the
    // transition's first keyframe applies.
    element.className = 'ngx-stack-page ngx-stack-page--invisible';

    const scrim = this.doc.createElement('div');
    scrim.className = 'ngx-stack-scrim';

    // `createComponent` already put the host element in the DOM at the view container's anchor.
    // Relocating the node is fine — Angular tracks the view, not its position.
    element.appendChild(ref.location.nativeElement as HTMLElement);
    element.appendChild(scrim);
    this.hostEl.appendChild(element);

    return { id: this.nextId++, url, tab, element, scrim, ref, route };
  }

  // ---------------------------------------------------------------------------
  // Transitions
  // ---------------------------------------------------------------------------

  /**
   * Apply a stack operation. The stacks are updated *synchronously* so a navigation arriving
   * mid-animation still sees the correct top; only the visuals and the destruction of popped
   * pages wait for the transition.
   */
  run(op: StackOp): Promise<void> {
    // A new transition while one is still running: snap the old one to its end state rather
    // than letting two animations fight over the same transforms.
    if (this.running) this.settle(this.running);

    // The page currently on screen — which, on a tab switch, belongs to the tab we're leaving.
    const leaving = this.top(this.active());

    const stacks: Stacks = { ...this.stacks() };
    const before = stacks[op.tab] ?? [];

    let entering: StackEntry;
    let removed: StackEntry[] = [];
    let direction: StackDirection;

    switch (op.kind) {
      case 'push':
        entering = op.entering;
        direction = 'forward';
        stacks[op.tab] = this.prune(op.tab, [...before, entering], (dropped) =>
          removed.push(...dropped),
        );
        break;

      case 'replace':
        entering = op.entering;
        direction = 'forward';
        // Only the top goes; everything below it stays, so back still works the same way.
        removed = before.length ? [before[before.length - 1]] : [];
        stacks[op.tab] = [...before.slice(0, -1), entering];
        break;

      case 'pop': {
        const target = before[op.toIndex];
        if (!target) return Promise.resolve();
        entering = target;
        direction = 'back';
        removed = before.slice(op.toIndex + 1);
        stacks[op.tab] = before.slice(0, op.toIndex + 1);
        break;
      }

      case 'restore':
        entering = op.entering;
        direction = 'back';
        // Everything in this stack sat above the page we're restoring, so all of it goes.
        removed = [...before];
        stacks[op.tab] = [entering];
        this.pruned.get(op.tab)?.delete(entering.url);
        break;

      case 'root':
        entering = op.entering;
        direction = 'forward';
        // Root wipes every tab, not just this one — it's "start the app again".
        removed = Object.values(stacks).flat();
        for (const key of Object.keys(stacks)) delete stacks[key];
        stacks[op.tab] = [entering];
        this.pruned.clear();
        break;
    }

    this.stacks.set(stacks);
    this.active.set(op.tab);

    if (entering === leaving) {
      this.applyStates();
      return Promise.resolve();
    }

    return this.transition(entering, leaving, direction, removed, op, this.playerOf(op));
  }

  /** Enforce `maxDepth` by dropping pages off the bottom, remembering that they existed. */
  private prune(
    tab: string,
    stack: readonly StackEntry[],
    onDropped: (dropped: StackEntry[]) => void,
  ): readonly StackEntry[] {
    const max = this.config.maxDepth;
    if (max <= 0 || stack.length <= max) return stack;

    const dropped = stack.slice(0, stack.length - max);
    let urls = this.pruned.get(tab);
    if (!urls) {
      urls = new Set();
      this.pruned.set(tab, urls);
    }
    for (const entry of dropped) {
      if (entry.url) urls.add(entry.url);
    }
    onDropped(dropped);

    return stack.slice(dropped.length);
  }

  private playerOf(op: StackOp): TransitionPlayer | undefined {
    return op.kind === 'pop' ? op.player : undefined;
  }

  private async transition(
    entering: StackEntry,
    leaving: StackEntry | null,
    direction: StackDirection,
    removed: StackEntry[],
    op: StackOp,
    existingPlayer?: TransitionPlayer,
  ): Promise<void> {
    const isRoot = leaving === null;
    const shouldAnimate =
      op.animated && (!isRoot || this.config.animateRoot) && !this.prefersReducedMotion();

    this.reveal(entering);
    if (leaving) this.reveal(leaving);

    callLifecycle(leaving, 'ngxViewWillLeave');
    callLifecycle(entering, 'ngxViewWillEnter');

    // A gesture hands us a player it has already scrubbed to the end; otherwise build one.
    const player =
      existingPlayer ?? (shouldAnimate ? this.buildPlayer(entering, leaving, direction) : null);

    // Safe now: with `fill: 'both'` the player is already holding its first keyframe, so
    // un-hiding cannot show the page at the wrong position.
    entering.element.classList.remove('ngx-stack-page--invisible');

    const event: StackTransitionEvent = {
      direction,
      entering,
      leaving,
      tab: op.tab,
      animated: player !== null,
      interactive: existingPlayer !== undefined,
    };

    const run: RunningTransition = { player, entering, leaving, removed, event };
    this.running = run;
    this._animating.set(true);
    this.onTransitionStart?.(event);

    if (player) {
      entering.element.classList.add('ngx-stack-page--animating');
      leaving?.element.classList.add('ngx-stack-page--animating');
      await player.play();
    }

    // A newer navigation may have settled this transition while we were awaiting.
    if (this.running !== run) return;

    this.finish(run);
  }

  /** Tear down a transition: drop popped pages, fix up classes, fire the `did` hooks. */
  private finish(run: RunningTransition): void {
    this.applyStates();
    // Cancelling reverts elements to their CSS-defined transforms. Do it *after* `applyStates`
    // has hidden everything below the top, so nothing flashes back to centre.
    run.player?.destroy();

    for (const entry of run.removed) {
      this.destroyEntry(entry);
    }

    callLifecycle(run.leaving, 'ngxViewDidLeave');
    callLifecycle(run.entering, 'ngxViewDidEnter');

    this.running = null;
    this._animating.set(false);

    if (this.config.manageFocus) this.moveFocus(run.entering);
    this.onTransitionEnd?.(run.event);
  }

  /** Jump an in-flight transition straight to its end state. */
  private settle(run: RunningTransition): void {
    run.player?.finish();
    this.finish(run);
  }

  // ---------------------------------------------------------------------------
  // Swipe-back
  // ---------------------------------------------------------------------------

  /**
   * Set up a back transition and hand it to the gesture, paused at progress 0.
   *
   * Deliberately fires no lifecycle hooks: a swipe is a *peek* until the user releases, and
   * pages should not be told they entered somewhere the user may drag right back out of. The
   * hooks fire when the pop actually commits, through `run()`.
   */
  beginInteractiveBack(): InteractiveBack | null {
    if (this.running) return null;

    const stack = this.pages();
    if (stack.length < 2) return null;

    const leaving = stack[stack.length - 1];
    const entering = stack[stack.length - 2];

    this.reveal(entering);
    const player = this.buildPlayer(entering, leaving, 'back', true);
    entering.element.classList.remove('ngx-stack-page--invisible');
    entering.element.classList.add('ngx-stack-page--animating');
    leaving.element.classList.add('ngx-stack-page--animating');

    return { player, entering, leaving };
  }

  /** The user let go without going far enough: run the transition back to where it started. */
  async abortInteractiveBack(back: InteractiveBack, ms: number): Promise<void> {
    await back.player.settle(0, ms);
    this.applyStates();
    back.player.destroy();
  }

  private buildPlayer(
    entering: StackEntry,
    leaving: StackEntry | null,
    direction: StackDirection,
    interactive = false,
  ): TransitionPlayer {
    const spec = this.transitionFn()({
      enteringEl: entering.element,
      leavingEl: leaving?.element ?? null,
      hostEl: this.hostEl,
      direction,
      rtl: this.isRtl(),
      width: this.hostEl.clientWidth || 1,
      duration: this.config.duration,
    });
    return new TransitionPlayer(spec, interactive);
  }

  // ---------------------------------------------------------------------------
  // Resolution
  // ---------------------------------------------------------------------------

  /** Which platform's look we're using, honouring a `platform` override in the config. */
  platformKind(): StackPlatformKind {
    return this.config.platform === 'auto' ? this.platform.kind : this.config.platform;
  }

  /** One function for every platform, a per-platform override, or the built-in. */
  transitionFn(): StackTransition {
    const configured = this.config.transitions;
    if (typeof configured === 'function') return configured;

    const kind = this.platformKind();
    return configured?.[kind] ?? BUILT_IN[kind];
  }

  /**
   * Read from the DOM rather than cached, so an app that flips `dir` at runtime — which is what
   * a language switcher does — mirrors on the very next transition without a reload.
   */
  isRtl(): boolean {
    if (this.config.direction !== 'auto') return this.config.direction === 'rtl';
    const view = this.doc.defaultView;
    return view ? view.getComputedStyle(this.hostEl).direction === 'rtl' : false;
  }

  /**
   * Only gates the *automatic* transitions. A swipe-back still animates: the user is dragging it
   * themselves, and direct manipulation is exempt — a gesture that doesn't visibly follow the
   * finger isn't reduced motion, it's a broken gesture.
   */
  private prefersReducedMotion(): boolean {
    if (!this.config.respectReducedMotion) return false;
    return this.doc.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  // ---------------------------------------------------------------------------
  // DOM state
  // ---------------------------------------------------------------------------

  private reveal(entry: StackEntry): void {
    entry.element.classList.remove('ngx-stack-page--hidden');
  }

  /**
   * The definitive resting state. Exactly one page is visible: the top of the active tab's
   * stack. Everything else — buried pages, and every page of every inactive tab — is hidden and
   * inert but still mounted.
   */
  private applyStates(): void {
    const stacks = this.stacks();
    const activeTab = this.active();

    for (const [tab, stack] of Object.entries(stacks)) {
      const lastIndex = stack.length - 1;

      stack.forEach((entry, index) => {
        const isTop = tab === activeTab && index === lastIndex;

        entry.element.classList.toggle('ngx-stack-page--hidden', !isTop);
        entry.element.classList.remove('ngx-stack-page--invisible', 'ngx-stack-page--animating');
        entry.element.inert = !isTop;

        if (isTop) {
          entry.element.style.transform = '';
          entry.scrim.style.opacity = '';
        }
      });
    }
  }

  /**
   * Put focus in the page that just arrived, and say its name out loud.
   *
   * Without this a screen-reader user gets no signal that anything happened, and keyboard focus
   * stays on whatever control they activated — which has now slid off the screen and been marked
   * `inert`, leaving focus nowhere at all.
   */
  private moveFocus(entry: StackEntry): void {
    const explicit = entry.element.querySelector<HTMLElement>('[ngxStackAutofocus]');
    const target = explicit ?? entry.element;

    if (!explicit) {
      // A page container isn't focusable by default; -1 makes it programmatically focusable
      // without adding it to the tab order.
      target.setAttribute('tabindex', '-1');
    }
    target.focus({ preventScroll: true });

    const title = entry.route?.snapshot.title ?? this.doc.title;
    if (title) announce(this.doc, title);
  }

  private destroyEntry(entry: StackEntry): void {
    entry.ref.destroy();
    entry.element.remove();
  }

  destroy(): void {
    if (this.running) {
      this.running.player?.destroy();
      this.running = null;
    }
    for (const stack of Object.values(this.stacks())) {
      for (const entry of stack) this.destroyEntry(entry);
    }
    this.stacks.set({});
    this.pruned.clear();
  }
}

import type { ResolvedStackConfig } from '../config';
import type { InteractiveBack } from '../core/stack-controller';
import type { StackPlatform } from '../platform/platform';
import { VelocityTracker } from './velocity-tracker';

/** Travel along the axis, in px, before we commit to a swipe rather than a scroll or a tap. */
const DIRECTION_LOCK_PX = 10;

const MIN_SETTLE_MS = 90;
const MAX_SETTLE_MS = 380;

/** Below this speed the flick is treated as a release, not a throw. */
const IDLE_SPEED = 0.05;

export interface SwipeBackHost {
  readonly hostEl: HTMLElement;
  /**
   * May a swipe start right now? Asked on every touch that lands in the edge zone, so it is free
   * to depend on live state. The single gate: whether the gesture is enabled at all, whether
   * there is anything to go back to, and whether the current page objects.
   */
  canSwipeBack(): boolean;
  /** Right-to-left, so the gesture lives on the right edge and pulls the other way. */
  isRtl(): boolean;
  /** Build the scrubbable back transition, or return null to refuse. */
  beginSwipeBack(): InteractiveBack | null;
  /** The user let go past the threshold. Finish the animation over `ms`, then pop for real. */
  commitSwipeBack(back: InteractiveBack, ms: number): void;
  /** The user let go short of the threshold. Put everything back over `ms`. */
  abortSwipeBack(back: InteractiveBack, ms: number): void;
}

type GestureState = 'idle' | 'pending' | 'dragging';

/**
 * Edge-drag-to-go-back.
 *
 * Uses touch events rather than pointer events on purpose. On iOS a `touchmove` can be
 * `preventDefault()`-ed to stop the page scrolling out from under the drag, and a `touchstart`
 * can be prevented to stop WebKit starting its own back-navigation gesture. Pointer events give
 * us neither — once WebKit decides the touch is a scroll or a system gesture, we just get a
 * `pointercancel` and the drag dies.
 *
 * Everything horizontal is expressed against a `sign`: +1 in LTR, -1 in RTL. The gesture starts
 * at the *inline start* edge and pulls towards the *inline end*, which in Arabic and Hebrew means
 * starting at the right and dragging left.
 */
export class SwipeBackGesture {
  private state: GestureState = 'idle';
  private startX = 0;
  private startY = 0;
  private width = 1;
  private sign: 1 | -1 = 1;
  private touchId: number | null = null;
  private back: InteractiveBack | null = null;

  private readonly velocity = new VelocityTracker();
  private readonly teardown: (() => void)[] = [];

  constructor(
    private readonly host: SwipeBackHost,
    private readonly config: ResolvedStackConfig,
    private readonly platform: StackPlatform,
  ) {
    const el = host.hostEl;

    // Non-passive: both handlers need to be able to preventDefault.
    this.listen(el, 'touchstart', this.onTouchStart as EventListener, { passive: false });
    this.listen(el, 'touchmove', this.onTouchMove as EventListener, { passive: false });
    this.listen(el, 'touchend', this.onTouchEnd as EventListener);
    this.listen(el, 'touchcancel', this.onTouchEnd as EventListener);

    if (config.swipeWithMouse) {
      this.listen(el, 'mousedown', this.onMouseDown as EventListener);
      this.listen(el.ownerDocument, 'mousemove', this.onMouseMove as EventListener);
      this.listen(el.ownerDocument, 'mouseup', this.onMouseUp as EventListener);
    }
  }

  private listen(
    target: EventTarget,
    type: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, handler, options);
    this.teardown.push(() => target.removeEventListener(type, handler, options));
  }

  // ---------------------------------------------------------------------------
  // Touch
  // ---------------------------------------------------------------------------

  private readonly onTouchStart = (event: TouchEvent): void => {
    if (this.state !== 'idle' || event.touches.length !== 1) return;

    const touch = event.touches[0];
    if (!this.arm(touch.clientX, touch.clientY)) return;

    this.touchId = touch.identifier;

    // Stacks nest: an <ngx-stack> inside a page of an <ngx-stack-outlet> sits inside the outer
    // stack's host element, so this touch is on its way there too. Claim it, or both stacks
    // would go back at once. Listeners fire innermost-first, and arming already required
    // something to go back to — so the innermost stack that *can* go back wins, and one sitting
    // at its own root declines and lets the swipe fall through to its parent.
    event.stopPropagation();

    if (this.suppressesSystemGesture() && event.cancelable) {
      // Stops WebKit from starting its own interactive back navigation on this touch. The cost
      // is that this touch will not produce a synthetic `click`, which is why the default policy
      // is `inset` rather than `suppress`.
      event.preventDefault();
    }
  };

  private readonly onTouchMove = (event: TouchEvent): void => {
    if (this.state === 'idle') return;
    const touch = this.trackedTouch(event);
    if (!touch) return;
    this.drag(touch.clientX, touch.clientY, event);
  };

  private readonly onTouchEnd = (): void => {
    this.release();
  };

  /** A second finger landing must not hijack a drag the first one started. */
  private trackedTouch(event: TouchEvent): Touch | null {
    return Array.from(event.touches).find((touch) => touch.identifier === this.touchId) ?? null;
  }

  // ---------------------------------------------------------------------------
  // Mouse (development convenience only — `swipeWithMouse`)
  // ---------------------------------------------------------------------------

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (this.state !== 'idle' || event.button !== 0) return;
    // See onTouchStart: the innermost stack that can go back claims the drag.
    if (this.arm(event.clientX, event.clientY)) event.stopPropagation();
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (this.state === 'idle') return;
    this.drag(event.clientX, event.clientY, event);
  };

  private readonly onMouseUp = (): void => {
    this.release();
  };

  // ---------------------------------------------------------------------------

  private arm(x: number, y: number): boolean {
    this.sign = this.host.isRtl() ? -1 : 1;

    if (!this.inEdgeZone(x)) return false;
    if (!this.host.canSwipeBack()) return false;

    this.state = 'pending';
    this.startX = x;
    this.startY = y;
    this.width = Math.max(this.host.hostEl.clientWidth, 1);
    this.velocity.reset(x, performance.now());
    return true;
  }

  private drag(x: number, y: number, event: Event): void {
    // Travel *away from* the starting edge, so this is positive whichever way the app reads.
    const travel = (x - this.startX) * this.sign;

    if (this.state === 'pending') {
      const dy = y - this.startY;

      // A vertical drag is a scroll, and scrolling wins outright — bail rather than fight it.
      if (Math.abs(dy) > DIRECTION_LOCK_PX && Math.abs(dy) >= Math.abs(travel)) {
        this.reset();
        return;
      }
      if (travel < DIRECTION_LOCK_PX) return;

      const back = this.host.beginSwipeBack();
      if (!back) {
        this.reset();
        return;
      }
      this.back = back;
      this.state = 'dragging';
    }

    if (!this.back) return;

    // Keep the page underneath from scrolling while the finger is dragging it sideways.
    if (event.cancelable) event.preventDefault();

    this.velocity.add(x, performance.now());
    this.back.player.seek(travel / this.width);
  }

  private release(): void {
    const back = this.back;
    const wasDragging = this.state === 'dragging';
    const sign = this.sign;
    this.reset();

    if (!wasDragging || !back) return;

    const progress = back.player.progress;
    // Positive means "still moving away from the starting edge", i.e. towards completing.
    const velocity = this.velocity.velocity() * sign;
    const threshold = this.config.swipeVelocityThreshold;

    // A fast flick decides on its own: outwards completes even from barely anywhere, back
    // towards the edge cancels even from past the halfway mark. Otherwise distance decides.
    const complete =
      velocity > threshold || (velocity > -threshold && progress > this.config.swipeThreshold);

    const remaining = complete ? 1 - progress : progress;
    const ms = this.settleDuration(remaining, Math.abs(velocity));

    if (complete) {
      this.host.commitSwipeBack(back, ms);
    } else {
      this.host.abortSwipeBack(back, ms);
    }
  }

  /** Carry the finger's speed into the settle, so the page doesn't change pace on release. */
  private settleDuration(remainingProgress: number, speed: number): number {
    const distance = remainingProgress * this.width;
    const ms = speed > IDLE_SPEED ? distance / speed : this.config.duration * remainingProgress;
    return Math.min(Math.max(ms, MIN_SETTLE_MS), MAX_SETTLE_MS);
  }

  private reset(): void {
    this.state = 'idle';
    this.back = null;
    this.touchId = null;
  }

  /** The zone hugs the *inline start* edge: the left in LTR, the right in RTL. */
  private inEdgeZone(x: number): boolean {
    const rect = this.host.hostEl.getBoundingClientRect();
    const fromEdge = this.sign === 1 ? x - rect.left : rect.right - x;
    const start = this.systemInset();

    return fromEdge >= start && fromEdge <= start + this.config.swipeEdgeWidth;
  }

  /** Pixels at the very edge we concede to the browser's own gesture. */
  private systemInset(): number {
    return this.platform.hasSystemBackGesture && this.config.systemGesture === 'inset'
      ? this.config.systemEdgeInset
      : 0;
  }

  private suppressesSystemGesture(): boolean {
    return this.platform.hasSystemBackGesture && this.config.systemGesture === 'suppress';
  }

  destroy(): void {
    if (this.back) {
      this.host.abortSwipeBack(this.back, 0);
    }
    this.reset();
    for (const off of this.teardown) off();
    this.teardown.length = 0;
  }
}

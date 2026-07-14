import type { TransitionSpec } from './transition';

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Keyframe keys that carry timing rather than style. */
const META_KEYS = new Set(['offset', 'easing', 'composite']);

function styleKeysOf(keyframes: Keyframe[]): string[] {
  const keys = new Set<string>();
  for (const frame of keyframes) {
    for (const key of Object.keys(frame)) {
      if (!META_KEYS.has(key)) keys.add(key);
    }
  }
  return [...keys];
}

/** The element's current rendered value for each animated property. */
function snapshotOf(el: HTMLElement, keys: string[]): Keyframe {
  const frame: Record<string, string> = {};

  // A page destroyed mid-swipe — a navigation cancelled under the finger — has no defaultView. An
  // assertion here would throw inside a touch handler, taking the gesture down with it, when the
  // honest answer is simply that there is nothing left to animate from.
  const view = el.ownerDocument.defaultView;
  if (!view) return frame as Keyframe;

  const computed = view.getComputedStyle(el);
  for (const key of keys) {
    frame[key] = (computed as unknown as Record<string, string>)[key];
  }
  return frame as Keyframe;
}

function styleOnly(frame: Keyframe): Keyframe {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(frame)) {
    if (!META_KEYS.has(key)) out[key] = value;
  }
  return out as Keyframe;
}

/**
 * A page transition that can be either played or scrubbed.
 *
 * This is the whole reason the library exists. A CSS transition or a View Transition is
 * fire-and-forget: it runs to completion on its own clock. A swipe-back is the opposite —
 * the finger owns the clock, the transition has to follow it, and the user may change
 * their mind halfway and drag right back.
 *
 * So a transition is built as a set of paused Web Animations with `fill: 'both'`. Paused at
 * `currentTime = 0` they hold their first keyframe; the gesture then writes `currentTime`
 * directly on every touch move.
 */
export class TransitionPlayer {
  private animations: Animation[];
  private duration: number;
  private disposed = false;

  /**
   * @param interactive Build for scrubbing. Timing easing is forced to linear so that
   *   seeking to progress `p` puts the page at exactly `p` of the way across — otherwise
   *   the iOS curve makes the page lead and then lag the finger, which is precisely the
   *   tell that separates a native-feeling swipe from a web one. The real curve is applied
   *   later, by `settle()`.
   */
  constructor(
    private readonly spec: TransitionSpec,
    interactive = false,
  ) {
    this.duration = Math.max(spec.duration, 1);
    const easing = interactive ? 'linear' : spec.easing;

    this.animations = spec.animations.map((animation) => {
      const handle = animation.el.animate(animation.keyframes, {
        duration: this.duration,
        easing: interactive ? 'linear' : (animation.easing ?? easing),
        fill: 'both',
      });
      handle.pause();
      handle.currentTime = 0;
      return handle;
    });
  }

  /** Where the transition currently sits, in `[0, 1]`. */
  get progress(): number {
    const first = this.animations[0];
    if (!first) return 0;
    return clamp01(Number(first.currentTime ?? 0) / this.duration);
  }

  /** Jump to a progress in `[0, 1]`. Called on every touch move during a swipe. */
  seek(progress: number): void {
    if (this.disposed) return;
    const time = clamp01(progress) * this.duration;
    for (const animation of this.animations) {
      animation.currentTime = time;
    }
  }

  /** Run to progress 1 on the transition's own clock. */
  play(): Promise<void> {
    return this.run(1);
  }

  /**
   * Hand the clock back to the browser after a scrub, carrying on to `target`.
   *
   * Deliberately *not* a continuation of the scrub timeline. Re-applying the easing curve
   * to a timeline that is already part-way through would snap the page to `easing(t)`, a
   * visible jump at the exact moment the user lets go. Instead we snapshot what is
   * currently on screen and animate from there to the target with the real curve, which is
   * continuous by construction.
   *
   * @param ms How long the remaining distance should take. Scale this by the distance left
   *   so a release near the end is quick and one near the start is not.
   */
  settle(target: 0 | 1, ms: number, easing = this.spec.easing): Promise<void> {
    if (this.disposed || this.animations.length === 0) return Promise.resolve();

    const from = this.spec.animations.map((animation) => ({
      el: animation.el,
      frame: snapshotOf(animation.el, styleKeysOf(animation.keyframes)),
    }));
    const to = this.spec.animations.map((animation) =>
      styleOnly(
        target === 1 ? animation.keyframes[animation.keyframes.length - 1] : animation.keyframes[0],
      ),
    );

    for (const animation of this.animations) {
      animation.cancel();
    }

    this.duration = Math.max(ms, 1);
    this.animations = from.map((source, index) =>
      source.el.animate([source.frame, to[index]], {
        duration: this.duration,
        easing,
        fill: 'both',
      }),
    );

    return this.settled();
  }

  private run(direction: 1): Promise<void> {
    if (this.disposed || this.animations.length === 0) return Promise.resolve();

    // `Animation.play()` auto-rewinds: playing forward from the very end snaps back to the
    // start. Short-circuit when there is no distance left to cover.
    if (this.progress >= 0.999) {
      this.seek(1);
      return Promise.resolve();
    }

    for (const animation of this.animations) {
      animation.playbackRate = direction;
      animation.play();
    }
    return this.settled();
  }

  private settled(): Promise<void> {
    return Promise.all(
      // `finished` rejects when an animation is cancelled mid-flight, which is what happens
      // whenever a newer navigation interrupts this one. Not an error for us.
      this.animations.map((animation) => animation.finished.catch(() => undefined)),
    ).then(() => undefined);
  }

  /** Snap to the end state with no animation. */
  finish(): void {
    this.seek(1);
  }

  /** Drop the animations, reverting the elements to the styles they had before. */
  destroy(): void {
    if (this.disposed) return;
    for (const animation of this.animations) {
      animation.cancel();
    }
    this.disposed = true;
  }
}

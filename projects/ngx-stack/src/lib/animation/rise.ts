import type { ElementAnimation, StackTransition, TransitionSpec } from './transition';

export interface RiseOptions {
  /** How far the incoming page rises through, in px. Material moves a short distance, quickly. */
  travel: number;

  easing: string;

  /** Multiplier on the configured duration. */
  durationScale: number;
}

/**
 * The Material shape: the incoming page rises a short distance and fades in over the outgoing one,
 * which stays exactly where it is and is simply covered.
 *
 * The counterpart to {@link slideTransition}. `androidTransition` and `webTransition` are both
 * instances of this, with the same numbers — but they remain two separate transitions you can point
 * at different things, because "what Android does" and "what a browser does" are two decisions that
 * merely happen to agree today.
 *
 * Note there is no horizontal component, and that has a consequence: an edge swipe would drag
 * sideways while the page moved vertically. That is why `swipeBack: 'auto'` only arms the gesture on
 * iOS. For a swipe on Android or the web, give that platform a {@link slideTransition} instead.
 */
export function riseTransition(options: RiseOptions): StackTransition {
  return (ctx): TransitionSpec => {
    const forward = ctx.direction === 'forward';

    // The page riding on top. Going back, that's the one leaving.
    const overEl = forward ? ctx.enteringEl : ctx.leavingEl;

    const animations: ElementAnimation[] = [];

    if (overEl) {
      const away: Keyframe = { transform: `translateY(${options.travel}px)`, opacity: '0' };
      const home: Keyframe = { transform: 'translateY(0)', opacity: '1' };

      animations.push({ el: overEl, keyframes: forward ? [away, home] : [home, away] });
    }

    return {
      duration: Math.round(ctx.duration * options.durationScale),
      easing: options.easing,
      animations,
    };
  };
}

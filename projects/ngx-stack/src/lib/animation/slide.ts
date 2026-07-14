import {
  scrimOf,
  type ElementAnimation,
  type StackTransition,
  type TransitionSpec,
} from './transition';

export interface SlideOptions {
  /** How far the page riding on top travels, as a % of the host's width. */
  travel: number;

  /** How far the page underneath drifts the other way. Less than `travel` is what makes a parallax. */
  parallax: number;

  /** Peak opacity of the dim overlay on the covered page. `0` to skip it. */
  scrim: number;

  /** Fade the travelling page as well as moving it. iOS doesn't; a shorter web slide needs to. */
  fade: boolean;

  easing: string;

  /** Multiplier on the configured duration. */
  durationScale: number;
}

/**
 * The shape both horizontal transitions share: one page rides in over another, which drifts the
 * other way more slowly and dims underneath it.
 *
 * iOS and web are the same animation with different numbers — a full-width slide with a heavy
 * parallax, versus a short drift carried mostly by opacity. Writing that twice invites them to
 * quietly diverge, and the interesting parts here are subtle enough already:
 *
 * - `forward` and `back` are the same keyframes with the roles swapped. That symmetry is what makes
 *   a swipe scrubbable at all — the gesture just seeks the `back` spec.
 * - everything horizontal is signed by `rtl`, so a page pushed "forward" in Arabic arrives from the
 *   left, which is the direction the language reads towards.
 */
export function slideTransition(options: SlideOptions): StackTransition {
  return (ctx): TransitionSpec => {
    const forward = ctx.direction === 'forward';
    const sign = ctx.rtl ? -1 : 1;

    const offMain = `translateX(${options.travel * sign}%)`;
    const offUnder = `translateX(${-options.parallax * sign}%)`;
    const center = 'translateX(0)';

    // The page riding on top, sliding in from (or out to) the edge.
    const overEl = forward ? ctx.enteringEl : ctx.leavingEl;
    // The page underneath, parallaxing and dimming.
    const underEl = forward ? ctx.leavingEl : ctx.enteringEl;

    const animations: ElementAnimation[] = [];

    if (overEl) {
      const away: Keyframe = { transform: offMain, ...(options.fade ? { opacity: '0' } : {}) };
      const home: Keyframe = { transform: center, ...(options.fade ? { opacity: '1' } : {}) };
      animations.push({ el: overEl, keyframes: forward ? [away, home] : [home, away] });
    }

    if (underEl) {
      animations.push({
        el: underEl,
        keyframes: forward
          ? [{ transform: center }, { transform: offUnder }]
          : [{ transform: offUnder }, { transform: center }],
      });

      const scrim = options.scrim > 0 ? scrimOf(underEl) : null;
      if (scrim) {
        const clear: Keyframe = { opacity: '0' };
        const dim: Keyframe = { opacity: `${options.scrim}` };
        animations.push({ el: scrim, keyframes: forward ? [clear, dim] : [dim, clear] });
      }
    }

    return {
      duration: Math.round(ctx.duration * options.durationScale),
      easing: options.easing,
      animations,
    };
  };
}

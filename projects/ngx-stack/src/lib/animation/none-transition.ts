import type { StackTransition, TransitionSpec } from './transition';

/**
 * Pages swap instantly.
 *
 * Give it to a platform you'd rather not animate — `transitions: { web: noneTransition }` is a
 * common choice, since a page slide on a desktop monitor mostly just moves a lot of pixels.
 *
 * Note this also disarms the swipe on that platform in practice: there are no keyframes for a finger
 * to scrub, so a drag has nothing to follow.
 */
export const noneTransition: StackTransition = (): TransitionSpec => ({
  duration: 0,
  easing: 'linear',
  animations: [],
});

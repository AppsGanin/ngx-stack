import { riseTransition } from './rise';

/**
 * The Material push: the incoming page rises and fades in over the outgoing one, which stays where
 * it is. Shorter and flatter than iOS — Material moves things a short distance quickly rather than a
 * long distance smoothly.
 *
 * Deliberately has no horizontal component, which is why `swipeBack: 'auto'` doesn't arm the gesture
 * here: a finger dragging sideways would scrub a page moving vertically. On Android the back gesture
 * belongs to the OS anyway. If you do want an edge swipe, give this platform a `slideTransition()`.
 */
export const androidTransition = riseTransition({
  travel: 12,
  easing: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  durationScale: 0.65,
});

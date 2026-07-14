import { slideTransition } from './slide';

/**
 * The iOS navigation-controller push/pop.
 *
 * The incoming page slides the full width of the screen over the outgoing one, which drifts the
 * other way at a third of the speed and dims underneath it — the parallax that makes a UIKit stack
 * feel like sheets of paper rather than slides.
 *
 * The easing is UIKit's own: almost no acceleration, and a very long tail.
 */
export const iosTransition = slideTransition({
  travel: 100,
  parallax: 33,
  scrim: 0.16,
  fade: false,
  easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
  durationScale: 1,
});

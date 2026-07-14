import { riseTransition } from './rise';

/**
 * The browser default — the same rise-and-fade as Android, and identical to `androidTransition` down
 * to the numbers.
 *
 * They are still two transitions rather than one, and that is the point: "what a phone does" and
 * "what a browser does" are two separate decisions that merely happen to agree today. Retuning the
 * web here changes nothing on Android, and vice versa. If they were the same object, the first person
 * to want a different feel on the desktop would have to change both.
 *
 * Why Material rather than the iOS slide: a full-width slide says *"this screen came from over
 * there"*, which is true of something you swiped into view and not of something you clicked — and on
 * a wide monitor it is a great many pixels moving for no reason.
 */
export const webTransition = riseTransition({
  travel: 12,
  easing: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  durationScale: 0.65,
});

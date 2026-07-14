import { describe, expect, it } from 'vitest';

import { iosTransition } from './ios-transition';
import type { TransitionContext } from './transition';

/** A page wrapper plus the scrim the controller puts inside every one of them. */
function pageEl(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'ngx-stack-page';
  const scrim = document.createElement('div');
  scrim.className = 'ngx-stack-scrim';
  el.appendChild(scrim);
  return el;
}

function context(over: Partial<TransitionContext> = {}): TransitionContext {
  return {
    enteringEl: pageEl(),
    leavingEl: pageEl(),
    hostEl: document.createElement('div'),
    direction: 'forward',
    rtl: false,
    width: 390,
    duration: 420,
    ...over,
  };
}

const transformsOf = (spec: ReturnType<typeof iosTransition>, el: HTMLElement) =>
  spec.animations.find((a) => a.el === el)?.keyframes.map((k) => k['transform'] as string);

describe('iosTransition', () => {
  it('slides the incoming page in from the right and parallaxes the one below', () => {
    const ctx = context({ direction: 'forward' });
    const spec = iosTransition(ctx);

    expect(transformsOf(spec, ctx.enteringEl)).toEqual(['translateX(100%)', 'translateX(0)']);
    // A third of the distance, the other way — that's the parallax.
    expect(transformsOf(spec, ctx.leavingEl!)).toEqual(['translateX(0)', 'translateX(-33%)']);
  });

  it('is the same animation with the roles swapped when going back', () => {
    const ctx = context({ direction: 'back' });
    const spec = iosTransition(ctx);

    // Back: the *leaving* page is the one riding on top and sliding out to the right.
    expect(transformsOf(spec, ctx.leavingEl!)).toEqual(['translateX(0)', 'translateX(100%)']);
    expect(transformsOf(spec, ctx.enteringEl)).toEqual(['translateX(-33%)', 'translateX(0)']);
  });

  it('mirrors in RTL — forward arrives from the left', () => {
    const ctx = context({ direction: 'forward', rtl: true });
    const spec = iosTransition(ctx);

    expect(transformsOf(spec, ctx.enteringEl)).toEqual(['translateX(-100%)', 'translateX(0)']);
    expect(transformsOf(spec, ctx.leavingEl!)).toEqual(['translateX(0)', 'translateX(33%)']);
  });

  it('dims the page underneath as it is covered, and undims it on the way back', () => {
    const forward = context({ direction: 'forward' });
    const forwardScrim = iosTransition(forward).animations.find(
      (a) => a.el.className === 'ngx-stack-scrim',
    );
    expect(forwardScrim?.keyframes.map((k) => k['opacity'])).toEqual(['0', '0.16']);

    const back = context({ direction: 'back' });
    const backScrim = iosTransition(back).animations.find(
      (a) => a.el.className === 'ngx-stack-scrim',
    );
    expect(backScrim?.keyframes.map((k) => k['opacity'])).toEqual(['0.16', '0']);
  });

  it('animates only the entering page when the stack was empty', () => {
    const ctx = context({ direction: 'forward', leavingEl: null });
    const spec = iosTransition(ctx);

    expect(spec.animations).toHaveLength(1);
    expect(spec.animations[0].el).toBe(ctx.enteringEl);
  });

  it('keeps every keyframe interpolable, because the gesture scrubs them', () => {
    // A transition with a discrete or non-interpolable property would jump rather than follow the
    // finger. Guard the built-in against regressing into one.
    const spec = iosTransition(context({ direction: 'back' }));

    for (const animation of spec.animations) {
      expect(animation.keyframes).toHaveLength(2);
      for (const frame of animation.keyframes) {
        for (const value of Object.values(frame)) {
          expect(String(value)).not.toContain('none');
        }
      }
    }
  });
});

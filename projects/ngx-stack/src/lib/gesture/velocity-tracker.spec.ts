import { describe, expect, it } from 'vitest';

import { VelocityTracker } from './velocity-tracker';

describe('VelocityTracker', () => {
  it('is still until it has two samples', () => {
    const tracker = new VelocityTracker();
    expect(tracker.velocity()).toBe(0);

    tracker.reset(0, 0);
    expect(tracker.velocity()).toBe(0);
  });

  it('measures px per ms', () => {
    const tracker = new VelocityTracker();
    tracker.reset(0, 0);
    tracker.add(100, 50);

    expect(tracker.velocity()).toBe(2);
  });

  it('is negative when the finger reverses', () => {
    const tracker = new VelocityTracker();
    tracker.reset(200, 0);
    tracker.add(100, 50);

    expect(tracker.velocity()).toBe(-2);
  });

  it('only looks at the last 100ms', () => {
    const tracker = new VelocityTracker();

    // A long slow drag…
    tracker.reset(0, 0);
    tracker.add(10, 500);
    // …that ends in a fast flick. The flick is what the user meant; averaging it against the
    // slow part would read as "barely moving" and refuse to complete the swipe.
    tracker.add(110, 550);
    tracker.add(210, 580);

    expect(tracker.velocity()).toBeGreaterThan(2);
  });

  it('does not divide by zero when two samples share a timestamp', () => {
    const tracker = new VelocityTracker();
    tracker.reset(0, 100);
    tracker.add(50, 100);

    expect(tracker.velocity()).toBe(0);
  });
});

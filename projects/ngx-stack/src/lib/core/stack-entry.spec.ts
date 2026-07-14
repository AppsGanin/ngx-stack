import { describe, expect, it } from 'vitest';

import { pageAllowsSwipeBack, type NgxStackPage, type StackEntry } from './stack-entry';

function entry(options: {
  page?: NgxStackPage;
  data?: Record<string, unknown>;
  canDeactivate?: unknown[];
}): StackEntry {
  return {
    id: 1,
    url: '/x',
    tab: '',
    element: document.createElement('div'),
    scrim: document.createElement('div'),
    ref: { instance: options.page ?? {} } as StackEntry['ref'],
    route: {
      snapshot: {
        data: options.data ?? {},
        routeConfig: { canDeactivate: options.canDeactivate },
      },
    } as unknown as StackEntry['route'],
  };
}

describe('pageAllowsSwipeBack', () => {
  it('refuses when there is no page', () => {
    expect(pageAllowsSwipeBack(null)).toBe(false);
  });

  it('allows an ordinary page', () => {
    expect(pageAllowsSwipeBack(entry({}))).toBe(true);
  });

  it('honours data: { swipeBack: false } on the route', () => {
    expect(pageAllowsSwipeBack(entry({ data: { swipeBack: false } }))).toBe(false);
  });

  it('honours a live veto from the component', () => {
    expect(pageAllowsSwipeBack(entry({ page: { ngxCanSwipeBack: () => false } }))).toBe(false);
    expect(pageAllowsSwipeBack(entry({ page: { ngxCanSwipeBack: () => true } }))).toBe(true);
  });

  it("route data wins over a component that says it's fine", () => {
    // The route is the more deliberate statement of the two: someone wrote it down in the config.
    const page = entry({ data: { swipeBack: false }, page: { ngxCanSwipeBack: () => true } });
    expect(pageAllowsSwipeBack(page)).toBe(false);
  });

  describe('canDeactivate guards', () => {
    it("blocks the gesture by default, because a guard's answer arrives too late", () => {
      // The swipe animates the page away *before* the navigation runs. A guard that then refuses
      // can do nothing but bounce it back, which reads as a bug.
      expect(pageAllowsSwipeBack(entry({ canDeactivate: [() => true] }), 'block')).toBe(false);
    });

    it('lets the gesture run under guardPolicy: allow', () => {
      expect(pageAllowsSwipeBack(entry({ canDeactivate: [() => true] }), 'allow')).toBe(true);
    });

    it('lets a guarded page opt back in with a synchronous ngxCanSwipeBack()', () => {
      // Synchronous, so the gesture can simply decline to start — nothing moves, nothing bounces.
      const page = entry({ canDeactivate: [() => true], page: { ngxCanSwipeBack: () => true } });
      expect(pageAllowsSwipeBack(page, 'block')).toBe(true);
    });

    it('is unbothered by a route with an empty guard list', () => {
      expect(pageAllowsSwipeBack(entry({ canDeactivate: [] }), 'block')).toBe(true);
    });
  });
});

import { describe, expect, it } from 'vitest';

import { tabOfRouteData, tabOfRouteTree, tabOfUrl } from './tab-url';

const TABS = ['inbox', 'search', 'settings'];

const snap = (data?: Record<string, unknown>) => ({ routeConfig: data ? { data } : null });

describe('tabOfRouteTree', () => {
  it('lets a nested tab root declare the tab once, for everything under it', () => {
    // { path: 'settings', data: { tab: 'settings' }, children: [ …, { path: 'sheet' } ] }
    const tree = [snap(), snap({ tab: 'settings' }), snap({ title: 'Filters' })];
    expect(tabOfRouteTree(tree, TABS)).toBe('settings');
  });

  it('says nothing when no route in the tree declares a tab', () => {
    expect(tabOfRouteTree([snap(), snap({ title: 'Inbox' })], TABS)).toBe(null);
  });

  it('lets the page itself override the tab it is nested in', () => {
    const tree = [snap(), snap({ tab: 'settings' }), snap({ tab: 'inbox' })];
    expect(tabOfRouteTree(tree, TABS)).toBe('inbox');
  });
});

describe('tabOfRouteData', () => {
  it('says nothing when the route says nothing', () => {
    expect(tabOfRouteData(undefined, TABS)).toBe(null);
    expect(tabOfRouteData({}, TABS)).toBe(null);
    expect(tabOfRouteData({ title: 'Hi' }, TABS)).toBe(null);
  });

  it('files a page on the tab it names, whatever its URL looks like', () => {
    expect(tabOfRouteData({ tab: 'inbox' }, TABS)).toBe('inbox');
  });

  it('refuses a tab that does not exist, loudly', () => {
    // Silently filing the page under a stack no tab can reach would strand it: it would be mounted,
    // invisible, and unreachable from the tab bar. Better to fail at the point of the typo.
    expect(() => tabOfRouteData({ tab: 'inobx' }, TABS)).toThrow(/not one of the configured tabs/);
  });
});

describe('tabOfUrl', () => {
  it('has no opinion when the app has no tabs', () => {
    expect(tabOfUrl('/inbox/item/1', undefined)).toBe('');
    expect(tabOfUrl('/inbox/item/1', [])).toBe('');
  });

  it('takes the first path segment', () => {
    expect(tabOfUrl('/inbox', TABS)).toBe('inbox');
    expect(tabOfUrl('/inbox/item/1', TABS)).toBe('inbox');
    expect(tabOfUrl('/search/result/3', TABS)).toBe('search');
  });

  it('ignores query strings and fragments', () => {
    expect(tabOfUrl('/search?q=hello', TABS)).toBe('search');
    expect(tabOfUrl('/search/result/3?a=1#top', TABS)).toBe('search');
  });

  it('tolerates a missing or doubled leading slash', () => {
    expect(tabOfUrl('inbox/item/1', TABS)).toBe('inbox');
    expect(tabOfUrl('//inbox', TABS)).toBe('inbox');
  });

  it('returns no tab for a URL outside every tab', () => {
    // A login screen or a full-screen modal route lives outside the tab bar, and must not be
    // filed under whichever tab happened to be open.
    expect(tabOfUrl('/login', TABS)).toBe('');
    expect(tabOfUrl('/', TABS)).toBe('');
  });

  it('does not match a tab name as a prefix of a longer segment', () => {
    expect(tabOfUrl('/inboxes/1', TABS)).toBe('');
  });
});

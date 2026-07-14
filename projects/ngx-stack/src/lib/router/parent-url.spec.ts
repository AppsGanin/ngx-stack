import { describe, expect, it } from 'vitest';
import type { Routes } from '@angular/router';

import { deriveParentUrl } from './parent-url';

const Page = class {};

const ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inbox' },

  { path: 'inbox', component: Page },
  { path: 'inbox/item/:id', component: Page },
  { path: 'inbox/item/:id/notes', component: Page },

  { path: 'search', component: Page },
  { path: 'search/result/:id', component: Page },

  { path: 'settings', component: Page },
  { path: 'settings/sheet', component: Page },

  // Flat: the URL says nothing about where this sits, so it has to be declared.
  { path: 'ticket/:id', component: Page, data: { parent: '/inbox' } },

  { path: 'lazy', loadChildren: () => Promise.resolve([]) },
  { path: '**', component: Page },
];

describe('deriveParentUrl', () => {
  it('walks the URL nesting one level at a time', () => {
    expect(deriveParentUrl(ROUTES, '/inbox/item/12/notes')).toBe('/inbox/item/12');
    expect(deriveParentUrl(ROUTES, '/inbox/item/12')).toBe('/inbox');
    expect(deriveParentUrl(ROUTES, '/search/result/3')).toBe('/search');
    expect(deriveParentUrl(ROUTES, '/settings/sheet')).toBe('/settings');
  });

  it('skips intermediate URLs that are not real pages', () => {
    // /inbox/item is not a route. The derivation has to step over it and land on /inbox.
    expect(deriveParentUrl(ROUTES, '/inbox/item/12')).toBe('/inbox');
  });

  it('gives a root page no parent', () => {
    expect(deriveParentUrl(ROUTES, '/inbox')).toBe(null);
    expect(deriveParentUrl(ROUTES, '/')).toBe(null);
  });

  it('lets data: { parent } override the URL, for a hierarchy the URL does not express', () => {
    expect(deriveParentUrl(ROUTES, '/ticket/9')).toBe('/inbox');
  });

  it('ignores query strings and fragments', () => {
    expect(deriveParentUrl(ROUTES, '/inbox/item/12?from=push#top')).toBe('/inbox');
  });

  it('never claims the wildcard route as a parent', () => {
    // `**` matches anything, so left alone it would happily declare itself the parent of every
    // page — which is worse than admitting we don't know.
    expect(deriveParentUrl(ROUTES, '/nowhere/at/all')).toBe(null);
  });

  it('declines to guess into a lazy subtree', () => {
    // The children are behind a dynamic import and don't exist yet. Say so by returning null
    // rather than inventing a parent.
    expect(deriveParentUrl(ROUTES, '/lazy/thing/1')).toBe(null);
  });
});

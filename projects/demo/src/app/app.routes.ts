import type { Routes } from '@angular/router';

import { GuardedPage, unsavedChangesGuard } from './pages/guarded.page';
import { InboxPage } from './pages/inbox.page';
import { ItemPage } from './pages/item.page';
import { NotesPage } from './pages/notes.page';
import { ResultPage } from './pages/result.page';
import { SearchPage } from './pages/search.page';
import { SettingsPage } from './pages/settings.page';
import { SheetPage } from './pages/sheet.page';
import { StarredPage } from './pages/starred.page';

/**
 * The first segment of each path is the tab (see `tabs` in app.config.ts). Everything under
 * `inbox/` lands on the Inbox stack, everything under `search/` on the Search stack, and the two
 * never disturb each other.
 *
 * `title` is what gets announced to screen readers on every push and pop.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inbox' },

  // Note what is *not* here: no `parent`. These URLs already nest the way the screens do, so where
  // each page sits is derivable — /inbox/item/12/notes → /inbox/item/12 → /inbox. That's what makes
  // both the back button and the deep-link rebuild work with nothing declared.
  { path: 'inbox', component: InboxPage, title: 'Inbox' },
  { path: 'inbox/item/:id', component: ItemPage, title: 'Message' },
  { path: 'inbox/item/:id/notes', component: NotesPage, title: 'Notes' },

  // The exception, and the only route here that needs anything. Its URL says neither which tab it
  // belongs to nor what it sits under, because it is flat — so it says both itself.
  {
    path: 'starred',
    component: StarredPage,
    title: 'Starred',
    data: { tab: 'inbox', parent: '/inbox' },
  },

  { path: 'search', component: SearchPage, title: 'Search' },
  { path: 'search/result/:id', component: ResultPage, title: 'Result' },

  // Settings is written with nested routes, unlike the two tabs above, to show the other shape.
  // `tab` is declared once on the root and every page under it inherits — no repetition, and it
  // works whether or not the root has a component of its own.
  {
    path: 'settings',
    data: { tab: 'settings' },
    children: [
      { path: '', component: SettingsPage, title: 'Settings' },
      { path: 'sheet', component: SheetPage, title: 'Filters' },
      {
        path: 'guarded',
        component: GuardedPage,
        title: 'Guarded',
        // With the default `guardPolicy: 'block'`, the presence of this guard is enough to refuse
        // the swipe — the gesture would otherwise animate the page away before the guard even ran.
        canDeactivate: [unsavedChangesGuard],
      },
    ],
  },
];

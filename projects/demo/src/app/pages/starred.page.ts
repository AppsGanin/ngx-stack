import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgxStackNav } from 'ngx-stack';

/**
 * A page whose URL — `/starred` — says nothing about which tab it belongs to.
 *
 * Left alone it would land in the no-tab stack, outside the tab bar entirely: pushing it would
 * appear to leave Inbox, and switching tabs would strand it. `data: { tab: 'inbox' }` on the route
 * files it where it belongs.
 */
@Component({
  selector: 'demo-starred',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './shell.scss',
  template: `
    <header class="bar">
      <button type="button" (click)="back()">‹ Inbox</button>
      <h1>Starred</h1>
      <span class="spacer"></span>
    </header>

    <div class="body">
      <p class="note">
        The URL is <code>/starred</code> — it doesn't begin with <code>inbox</code>, so nothing
        about it says which tab it's in. <code>data: &#123; tab: 'inbox' &#125;</code> does. Note
        the Inbox tab is still the active one, and swiping back returns you to the Inbox stack.
      </p>
    </div>
  `,
})
export class StarredPage {
  private readonly nav = inject(NgxStackNav);

  back(): void {
    void this.nav.back();
  }
}

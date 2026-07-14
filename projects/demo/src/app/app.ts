import { ChangeDetectionStrategy, Component, effect, inject, viewChild } from '@angular/core';
import { NgxStackTabs, NgxStackOutlet, type StackTransitionEvent } from 'ngx-stack';

/**
 * The shell: one stack outlet and a tab bar.
 *
 * The tab bar is ordinary markup — the library ships no visual design. All it needs from
 * `NgxStackTabs` is which tab is active and where each one was last seen.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxStackOutlet],
  template: `
    <ngx-stack-outlet (transitionEnd)="onTransition($event)" />

    <nav class="tabbar">
      @for (tab of tabs.tabs(); track tab) {
        <button
          type="button"
          [class.active]="tabs.active() === tab"
          [attr.data-tab]="tab"
          [attr.aria-current]="tabs.active() === tab ? 'page' : null"
          (click)="tabs.select(tab)"
        >
          <span class="dot"></span>
          {{ tab }}
        </button>
      }
    </nav>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      font:
        16px/1.45 -apple-system,
        BlinkMacSystemFont,
        system-ui,
        sans-serif;
    }

    ngx-stack-outlet {
      flex: 1 1 auto;
      min-height: 0;
    }

    .tabbar {
      flex: 0 0 auto;
      display: flex;
      border-top: 1px solid rgb(0 0 0 / 12%);
      background: rgb(249 249 249 / 94%);
      backdrop-filter: saturate(180%) blur(20px);
      padding-bottom: var(--ngx-stack-safe-bottom, 0px);
    }

    .tabbar button {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      padding: 8px 0 10px;
      border: 0;
      background: none;
      font: inherit;
      font-size: 11px;
      text-transform: capitalize;
      color: #8e8e93;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    .tabbar button.active {
      color: #007aff;
    }

    .dot {
      width: 18px;
      height: 18px;
      border-radius: 6px;
      background: currentColor;
      opacity: 0.85;
    }
  `,
})
export class App {
  protected readonly tabs = inject(NgxStackTabs);

  private readonly outlet = viewChild.required(NgxStackOutlet);

  constructor() {
    // Publishes the outlet's own signals so the e2e can see what the stack thinks its state is,
    // rather than inferring it from pixels. `animating` is the one that matters: the gesture refuses
    // to start while a transition is in flight, and a transition that never finished would look
    // exactly like a gesture that mysteriously does nothing.
    effect(() => {
      (window as unknown as { __stack?: unknown }).__stack = {
        depth: this.outlet().depth(),
        canGoBack: this.outlet().canGoBack(),
        animating: this.outlet().animating(),
        activeTab: this.outlet().activeTab(),
      };
    });
  }

  /** Just to show the events exist. A real app might stop a spinner or log analytics here. */
  onTransition(event: StackTransitionEvent): void {
    (window as unknown as { __lastTransition?: unknown }).__lastTransition = {
      direction: event.direction,
      tab: event.tab,
      animated: event.animated,
      interactive: event.interactive,
      url: event.entering.url,
    };
  }
}

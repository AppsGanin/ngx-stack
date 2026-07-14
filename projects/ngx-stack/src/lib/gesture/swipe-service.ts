import { Injectable, inject, signal, type Signal } from '@angular/core';

import { NGX_STACK_CONFIG } from '../config';
import { NGX_STACK_PLATFORM } from '../platform/platform';

/**
 * The master switch for swipe-to-go-back.
 *
 * `provideNgxStack({ swipeBack })` only sets the *starting* value — this is what you reach
 * for when the answer changes while the app is running. A modal is open, a map is eating the
 * drag, a form has unsaved edits, a payment is in flight: turn it off, turn it back on after.
 *
 * ```ts
 * const swipe = inject(NgxStackSwipe);
 * swipe.disable();
 * // …later
 * swipe.reset();   // back to whatever the config said
 * ```
 *
 * This is the global layer. Two narrower ones sit on top of it, and either can veto:
 * `<ngx-stack-outlet [swipeBack]="…">` for one stack, and `ngxCanSwipeBack()` or
 * `data: { swipeBack: false }` for one page. See {@link NgxStackPage}.
 */
@Injectable({ providedIn: 'root' })
export class NgxStackSwipe {
  private readonly config = inject(NGX_STACK_CONFIG);
  private readonly platform = inject(NGX_STACK_PLATFORM);

  private readonly _enabled = signal(this.fromConfig());

  /** Read it in a template or a computed; it's a signal. */
  readonly enabled: Signal<boolean> = this._enabled.asReadonly();

  enable(): void {
    this._enabled.set(true);
  }

  disable(): void {
    this._enabled.set(false);
  }

  set(enabled: boolean): void {
    this._enabled.set(enabled);
  }

  /** Go back to what the config asked for, whatever that resolved to on this device. */
  reset(): void {
    this._enabled.set(this.fromConfig());
  }

  private fromConfig(): boolean {
    const setting = this.config.swipeBack;
    if (setting !== 'auto') return setting;

    // 'auto' means iOS only. Honour a forced `platform`, so an iOS build under test on a
    // laptop still arms the gesture.
    const kind = this.config.platform === 'auto' ? this.platform.kind : this.config.platform;
    return kind === 'ios';
  }
}

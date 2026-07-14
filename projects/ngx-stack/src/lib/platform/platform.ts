import { InjectionToken, inject } from '@angular/core';
import { DOCUMENT } from '@angular/core';

/** The three surfaces that get their own transition. */
export type StackPlatformKind = 'ios' | 'android' | 'web';

export interface StackPlatform {
  /** Which transition this device gets by default. Decided by OS, not by browser vs native. */
  readonly kind: StackPlatformKind;
  readonly isIos: boolean;
  readonly isAndroid: boolean;
  /** Running inside a Capacitor native webview. */
  readonly isCapacitor: boolean;
  /** Running inside a Cordova / PhoneGap native webview. */
  readonly isCordova: boolean;
  /** Either of the above: a native webview shell rather than a real browser. */
  readonly isNative: boolean;
  /** Installed to the home screen and running without browser chrome. */
  readonly isStandalonePwa: boolean;
  /**
   * True when the browser runs its own interactive back gesture at the screen edge, so we have to
   * share (or fight over) those pixels.
   *
   * That means iOS Safari and iOS PWAs. Native shells — Capacitor and Cordova alike — leave
   * `allowsBackForwardNavigationGestures` off in their WKWebView, so the edge is ours alone. Which
   * is why native is the easy target and the browser is the awkward one.
   */
  readonly hasSystemBackGesture: boolean;
}

export function detectPlatform(win: Window & typeof globalThis): StackPlatform {
  const nav = win.navigator;
  const ua = nav?.userAgent ?? '';

  // iPadOS 13+ reports itself as a Mac, so a Mac with a touchscreen is really an iPad.
  const isIos =
    /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav?.maxTouchPoints ?? 0) > 1);
  const isAndroid = /Android/.test(ua);

  const shell = win as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
    cordova?: unknown;
  };

  const isCapacitor = !!shell.Capacitor?.isNativePlatform?.();
  const isCordova = !isCapacitor && shell.cordova !== undefined;
  const isNative = isCapacitor || isCordova;

  const isStandalonePwa =
    (nav as unknown as { standalone?: boolean })?.standalone === true ||
    win.matchMedia?.('(display-mode: standalone)').matches === true;

  return {
    kind: isIos ? 'ios' : isAndroid ? 'android' : 'web',
    isIos,
    isAndroid,
    isCapacitor,
    isCordova,
    isNative,
    isStandalonePwa,
    // Note this keys off `isNative`, not `isCapacitor`. Getting that wrong would make an iOS
    // Cordova app needlessly concede the first 16px of the screen edge to a gesture its webview
    // does not have.
    hasSystemBackGesture: isIos && !isNative,
  };
}

export const NGX_STACK_PLATFORM = new InjectionToken<StackPlatform>('ngx-stack.platform', {
  providedIn: 'root',
  factory: () => {
    const doc = inject(DOCUMENT);
    const win = doc.defaultView;
    if (!win) {
      // SSR / no DOM: nothing animates anyway, so report the dullest possible platform.
      return {
        kind: 'web',
        isIos: false,
        isAndroid: false,
        isCapacitor: false,
        isCordova: false,
        isNative: false,
        isStandalonePwa: false,
        hasSystemBackGesture: false,
      };
    }
    return detectPlatform(win as Window & typeof globalThis);
  },
});

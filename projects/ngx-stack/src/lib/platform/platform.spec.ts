import { describe, expect, it } from 'vitest';

import { detectPlatform } from './platform';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko)';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

function fakeWindow(options: {
  ua: string;
  capacitor?: boolean;
  cordova?: boolean;
  maxTouchPoints?: number;
}) {
  return {
    navigator: { userAgent: options.ua, maxTouchPoints: options.maxTouchPoints ?? 0 },
    matchMedia: () => ({ matches: false }),
    Capacitor: options.capacitor ? { isNativePlatform: () => true } : undefined,
    cordova: options.cordova ? {} : undefined,
  } as unknown as Window & typeof globalThis;
}

describe('detectPlatform', () => {
  it('reads the OS, not the shell', () => {
    expect(detectPlatform(fakeWindow({ ua: IPHONE })).kind).toBe('ios');
    expect(detectPlatform(fakeWindow({ ua: ANDROID })).kind).toBe('android');
    expect(detectPlatform(fakeWindow({ ua: MAC })).kind).toBe('web');
  });

  it('sees through iPadOS pretending to be a Mac', () => {
    // An iPad has reported itself as a Macintosh since iPadOS 13. A Mac with a touchscreen does
    // not exist, so touch points are the giveaway.
    const ipad = detectPlatform(fakeWindow({ ua: MAC, maxTouchPoints: 5 }));
    expect(ipad.isIos).toBe(true);
    expect(ipad.kind).toBe('ios');
  });

  it('recognises both native shells', () => {
    const capacitor = detectPlatform(fakeWindow({ ua: IPHONE, capacitor: true }));
    expect(capacitor.isCapacitor).toBe(true);
    expect(capacitor.isCordova).toBe(false);
    expect(capacitor.isNative).toBe(true);

    const cordova = detectPlatform(fakeWindow({ ua: IPHONE, cordova: true }));
    expect(cordova.isCordova).toBe(true);
    expect(cordova.isCapacitor).toBe(false);
    expect(cordova.isNative).toBe(true);
  });

  describe('hasSystemBackGesture', () => {
    it('is true in an iOS browser, where WebKit owns the screen edge', () => {
      expect(detectPlatform(fakeWindow({ ua: IPHONE })).hasSystemBackGesture).toBe(true);
    });

    it('is false in a native shell — either one', () => {
      // Both Capacitor and Cordova leave allowsBackForwardNavigationGestures off, so the edge is
      // ours alone. Keying this off Capacitor alone would make an iOS *Cordova* app needlessly
      // concede the first 16px of the screen to a gesture its webview does not have.
      expect(detectPlatform(fakeWindow({ ua: IPHONE, capacitor: true })).hasSystemBackGesture).toBe(
        false,
      );
      expect(detectPlatform(fakeWindow({ ua: IPHONE, cordova: true })).hasSystemBackGesture).toBe(
        false,
      );
    });

    it('is false on Android and on the desktop, which have no such gesture', () => {
      expect(detectPlatform(fakeWindow({ ua: ANDROID })).hasSystemBackGesture).toBe(false);
      expect(detectPlatform(fakeWindow({ ua: MAC })).hasSystemBackGesture).toBe(false);
    });
  });
});

/**
 * Notices when the *browser* has already animated a navigation.
 *
 * On iOS Safari and iOS PWAs, an edge swipe triggers WebKit's own back navigation, and
 * WebKit draws its own page slide for it. We still get the resulting `popstate`, so without
 * this we would helpfully animate the same navigation a second time.
 *
 * The Navigation API's `hasUAVisualTransition` is exactly the flag for this. Where the API
 * isn't available we simply animate — a double animation is worse than no information, but
 * only slightly, and `systemGesture: 'suppress'` avoids the situation entirely.
 */
interface NavigateEventLike extends Event {
  readonly hasUAVisualTransition?: boolean;
}

interface NavigationLike extends EventTarget {
  addEventListener(type: 'navigate', listener: (event: NavigateEventLike) => void): void;
  removeEventListener(type: 'navigate', listener: (event: NavigateEventLike) => void): void;
}

export class SystemTransitionWatcher {
  private uaAnimated = false;
  private readonly detach: () => void;

  constructor(win: Window) {
    const navigation = (win as unknown as { navigation?: NavigationLike }).navigation;

    if (!navigation?.addEventListener) {
      this.detach = () => undefined;
      return;
    }

    const onNavigate = (event: NavigateEventLike): void => {
      this.uaAnimated = event.hasUAVisualTransition === true;
    };

    navigation.addEventListener('navigate', onNavigate);
    this.detach = () => navigation.removeEventListener('navigate', onNavigate);
  }

  /** Did the browser animate the navigation we are about to handle? Reads and clears. */
  consume(): boolean {
    const value = this.uaAnimated;
    this.uaAnimated = false;
    return value;
  }

  destroy(): void {
    this.detach();
  }
}

/** Which way the stack is moving. */
export type StackDirection = 'forward' | 'back';

export interface TransitionContext {
  /**
   * The page that will be on top of the stack once the transition finishes. On `forward` this is
   * the newly created page; on `back` it is the page being uncovered.
   */
  enteringEl: HTMLElement;

  /**
   * The page that was on top when the transition started, or `null` when the stack was empty
   * (the root page).
   */
  leavingEl: HTMLElement | null;

  /** The element both pages live in. */
  hostEl: HTMLElement;

  direction: StackDirection;

  /**
   * The app is running right-to-left. Everything horizontal mirrors: "forward" arrives from the
   * left rather than the right, and the swipe-back lives on the right edge. A transition that
   * ignores this will feel backwards in Arabic and Hebrew — the new page will appear to come
   * from where the user just came *from*.
   */
  rtl: boolean;

  /** Host width in px, for transitions that want absolute distances. */
  width: number;

  /** Requested duration in ms, from the config. */
  duration: number;
}

export interface ElementAnimation {
  el: HTMLElement;
  /**
   * The first keyframe is the state at progress 0, the last at progress 1. A swipe-back gesture
   * seeks between them, so keyframes must be continuous and reversible — avoid discrete steps or
   * properties that can't be interpolated.
   */
  keyframes: Keyframe[];
  /** Overrides the spec-level easing for this element. */
  easing?: string;
}

export interface TransitionSpec {
  duration: number;
  easing: string;
  animations: ElementAnimation[];
}

/**
 * Describes how two pages swap places. Called once per transition, and also at the start of a
 * swipe-back — in that case the resulting animation is seeked by the finger rather than played,
 * so it must be a pure function of progress.
 */
export type StackTransition = (ctx: TransitionContext) => TransitionSpec;

/** The dim overlay that sits on top of a page while it is covered by another. */
export function scrimOf(pageEl: HTMLElement): HTMLElement | null {
  return pageEl.querySelector<HTMLElement>(':scope > .ngx-stack-scrim');
}

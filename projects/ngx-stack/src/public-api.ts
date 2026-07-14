/*
 * ngx-stack — native-feeling page stacks for Angular.
 */

// Setup
export {
  provideNgxStack,
  provideCapacitorBack,
  provideCordovaBack,
  type CapacitorAppLike,
} from './lib/provide';
export {
  type GuardPolicy,
  type NgxStackConfig,
  type StackTransitionMap,
  type SystemGesturePolicy,
} from './lib/config';

// The two ways to hold a stack
export { NgxStackOutlet } from './lib/router/stack-outlet';
export { NgxStack } from './lib/nav/ngx-stack';

// Navigation
export { NgxStackNav } from './lib/router/stack-nav';
export { NgxStackTabs } from './lib/router/stack-tabs';
export { NgxStackSwipe } from './lib/gesture/swipe-service';

// Required by provideNgxStack, and exported so an app composing its own strategy can defer to it.
export { NgxStackRouteReuseStrategy } from './lib/router/route-reuse-strategy';

// Pages
export type { NgxStackPage, StackEntry } from './lib/core/stack-entry';
export type { StackTransitionEvent } from './lib/core/stack-controller';

// Transitions
export { iosTransition } from './lib/animation/ios-transition';
export { androidTransition } from './lib/animation/android-transition';
export { webTransition } from './lib/animation/web-transition';
export { noneTransition } from './lib/animation/none-transition';
// The two shapes the built-ins are made of. Build your own by re-tuning either.
export { slideTransition, type SlideOptions } from './lib/animation/slide';
export { riseTransition, type RiseOptions } from './lib/animation/rise';
export { scrimOf } from './lib/animation/transition';
export type {
  ElementAnimation,
  StackDirection,
  StackTransition,
  TransitionContext,
  TransitionSpec,
} from './lib/animation/transition';

// Deep links — for composing with a custom `deepLinks` function.
export { deriveParentUrl } from './lib/router/parent-url';

// Platform
export { NGX_STACK_PLATFORM } from './lib/platform/platform';
export type { StackPlatform, StackPlatformKind } from './lib/platform/platform';

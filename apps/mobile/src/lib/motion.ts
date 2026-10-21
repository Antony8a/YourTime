import { Easing } from 'react-native-reanimated';

/**
 * Motion tokens. Rules these encode (Emil Kowalski's design-engineering guide):
 *  - UI motion stays under 300 ms; press feedback is 100-160 ms.
 *  - Never ease-in on UI: it feels sluggish. Use a strong ease-out.
 *  - Animate only transform and opacity.
 *  - Entrances start from a slight offset or scale plus opacity, never from scale(0).
 *  - Frequent actions (tab switches, list refreshes) do not animate at all.
 */

/** Strong ease-out: fast start so the UI feels immediately responsive. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export const DURATION = {
  /** Finger down on a pressable. */
  pressIn: 100,
  /** Finger up. Slightly slower so the release reads as a settle. */
  pressOut: 160,
  enter: 240,
  exit: 160,
} as const;

/** Scale a pressable shrinks to while held. */
export const PRESS_SCALE = 0.97;

/** Distance (px) a sheet or toast travels while entering. Small on purpose. */
export const ENTER_OFFSET = 36;

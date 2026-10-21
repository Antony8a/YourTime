import { useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { DURATION, EASE_OUT, PRESS_SCALE } from '@/lib/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  /** Static style, or a function of the pressed state for colour changes. */
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  scaleTo?: number;
}

/**
 * A pressable that shrinks slightly while held, running on the UI thread.
 * With reduced motion the scale is skipped; the `pressed` style still changes
 * so there is always feedback.
 */
export function PressableScale({
  style,
  scaleTo = PRESS_SCALE,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();
  const [pressed, setPressed] = useState(false);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        setPressed(true);
        if (!reduceMotion)
          scale.value = withTiming(scaleTo, { duration: DURATION.pressIn, easing: EASE_OUT });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        if (!reduceMotion)
          scale.value = withTiming(1, { duration: DURATION.pressOut, easing: EASE_OUT });
        onPressOut?.(e);
      }}
      style={[typeof style === 'function' ? style({ pressed }) : style, animated]}
    />
  );
}

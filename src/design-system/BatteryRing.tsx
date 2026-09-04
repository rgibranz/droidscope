import { useEffect } from 'react';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from './tamagui';
import { motion } from '../core/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 168;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The hero gauge (§41.2). Built on react-native-svg -- already a dependency for
 * icons -- rather than pulling in Skia for a single animated arc.
 */
export function BatteryRing({
  percent,
  charging,
}: {
  percent: number | null;
  charging: boolean;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    const target = percent === null ? 0 : Math.max(0, Math.min(100, percent)) / 100;
    progress.value = reducedMotion
      ? target
      : withTiming(target, { duration: motion.layout });
  }, [percent, progress, reducedMotion]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  const trackColor = theme.surfaceInteractive?.val ?? '#232830';
  const arcColor = charging
    ? theme.charging?.val ?? '#3DD68C'
    : theme.accent?.val ?? '#4C8DFF';

  return (
    <Svg width={SIZE} height={SIZE}>
      <Circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        stroke={trackColor}
        strokeWidth={STROKE}
        fill="none"
      />
      <AnimatedCircle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        stroke={arcColor}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={CIRCUMFERENCE}
        animatedProps={animatedProps}
        // Start the arc at 12 o'clock instead of 3 o'clock.
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
      />
    </Svg>
  );
}

export const BATTERY_RING_SIZE = SIZE;

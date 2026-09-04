import type { ReactNode } from 'react';
import { Text, XStack, YStack } from './tamagui';
import { typeScale } from '../core/theme/tokens';

// §41.8: a quick, small scale on press. Hoisted so it is not re-created per render.
const PRESS_FEEDBACK = { opacity: 0.7, scale: 0.98 } as const;

export function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <Text
      fontSize={typeScale.label}
      letterSpacing={1}
      textTransform="uppercase"
      color="$textMuted"
      marginBottom="$1"
    >
      {children}
    </Text>
  );
}

/**
 * §41.11: unsupported and in-progress states must look designed, not broken.
 */
export function InlineNotice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'warning';
}) {
  return (
    <XStack
      backgroundColor="$surface"
      borderColor={tone === 'warning' ? '$warning' : '$borderColor'}
      borderWidth={1}
      borderRadius="$1"
      paddingHorizontal="$4"
      paddingVertical="$3"
    >
      <Text fontSize={typeScale.label} color="$textMuted" flex={1}>
        {children}
      </Text>
    </XStack>
  );
}

/** Keeps page structure while values load, instead of a centred spinner. */
export function MetricSkeleton() {
  return (
    <YStack
      flex={1}
      backgroundColor="$surface"
      borderColor="$borderColor"
      borderWidth={1}
      borderRadius="$2"
      padding="$4"
      gap="$3"
      minHeight={104}
    >
      <YStack height={10} width="55%" borderRadius="$1" backgroundColor="$surfaceInteractive" />
      <YStack height={22} width="70%" borderRadius="$1" backgroundColor="$surfaceInteractive" />
      <YStack height={10} width="40%" borderRadius="$1" backgroundColor="$surfaceInteractive" />
    </YStack>
  );
}

/**
 * Small action button. Tamagui's own Button lives in the barrel that drags in
 * web-only dependencies, and this needs eight lines.
 */
export function ActionButton({
  children,
  onPress,
}: {
  children: ReactNode;
  onPress: () => void;
}) {
  return (
    <XStack
      onPress={onPress}
      accessibilityRole="button"
      alignSelf="flex-start"
      backgroundColor="$surfaceInteractive"
      borderColor="$borderColor"
      borderWidth={1}
      borderRadius="$1"
      paddingHorizontal="$4"
      paddingVertical="$3"
      pressStyle={PRESS_FEEDBACK}
    >
      <Text fontSize={typeScale.body} color="$color">
        {children}
      </Text>
    </XStack>
  );
}

export function DiagnosticRow({
  label,
  value,
  state,
}: {
  label: string;
  value?: string;
  state?: 'available' | 'unavailable' | 'rejected';
}) {
  const marker =
    state === 'available'
      ? '✓'
      : state === 'unavailable'
        ? '✗'
        : state === 'rejected'
          ? '⚠'
          : null;

  const markerColor =
    state === 'available'
      ? '$charging'
      : state === 'rejected'
        ? '$warning'
        : '$textMuted';

  return (
    <XStack
      paddingVertical="$2"
      gap="$3"
      alignItems="center"
      borderBottomWidth={1}
      borderBottomColor="$borderColor"
    >
      {marker ? (
        <Text fontSize={typeScale.body} color={markerColor} width={16}>
          {marker}
        </Text>
      ) : null}
      <Text fontSize={typeScale.body} color="$color" flex={1}>
        {label}
      </Text>
      {value ? (
        <Text
          fontSize={typeScale.label}
          color="$textMuted"
          fontVariant={['tabular-nums']}
        >
          {value}
        </Text>
      ) : null}
    </XStack>
  );
}

import type { ComponentType } from 'react';
import { Text, XStack, YStack } from './tamagui';
import { typeScale } from '../core/theme/tokens';
import { UNAVAILABLE } from '../core/utils/units';

export type MetricAvailability = 'measured' | 'calculated' | 'unsupported';

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  availability?: MetricAvailability;
  /** Reason shown in place of the unit when the metric is unavailable. */
  unavailableNote?: string;
  icon?: ComponentType<{ size?: number; color?: string }>;
  tone?: 'default' | 'charging' | 'warning' | 'danger';
  /**
   * Word values ("Not plugged") need less size than telemetry figures and would
   * otherwise overflow a half-width card. §41.4: not every value is huge.
   */
  variant?: 'numeric' | 'text';
}

const TONE_COLOR = {
  default: '$color',
  charging: '$charging',
  warning: '$warning',
  danger: '$danger',
} as const;

/**
 * §2.2 asks the UI to distinguish measured from calculated values, and §35 asks
 * unavailable metrics to look intentional rather than broken -- so an
 * unsupported card keeps its full layout and says why, instead of showing 0.
 */
export function MetricCard({
  label,
  value,
  unit,
  availability = 'measured',
  unavailableNote,
  icon: Icon,
  tone = 'default',
  variant = 'numeric',
}: MetricCardProps) {
  const unsupported = availability === 'unsupported';
  const displayValue = unsupported ? UNAVAILABLE : value;

  return (
    <YStack
      flex={1}
      backgroundColor="$surface"
      borderColor="$borderColor"
      borderWidth={1}
      borderRadius="$2"
      padding="$4"
      gap="$2"
      minHeight={104}
      accessible
      accessibilityLabel={
        unsupported
          ? `${label}: unavailable on this device`
          : `${label}: ${value}${unit ? ` ${unit}` : ''}`
      }
    >
      <XStack alignItems="center" gap="$2">
        {Icon ? <Icon size={13} color="currentColor" /> : null}
        <Text
          fontSize={typeScale.label}
          letterSpacing={0.6}
          textTransform="uppercase"
          color="$textMuted"
        >
          {label}
        </Text>
      </XStack>

      <XStack alignItems="baseline" gap="$1">
        <Text
          flexShrink={1}
          numberOfLines={2}
          fontSize={
            variant === 'text' && !unsupported
              ? typeScale.sectionTitle
              : typeScale.metricValue
          }
          fontWeight="600"
          color={unsupported ? '$textMuted' : TONE_COLOR[tone]}
          fontVariant={['tabular-nums']}
        >
          {displayValue}
        </Text>
        {!unsupported && unit ? (
          <Text fontSize={typeScale.label} color="$textMuted">
            {unit}
          </Text>
        ) : null}
      </XStack>

      <Text fontSize={typeScale.label} color="$textMuted">
        {unsupported
          ? unavailableNote ?? 'Not exposed by this device'
          : availability === 'calculated'
            ? 'calculated'
            : 'measured'}
      </Text>
    </YStack>
  );
}

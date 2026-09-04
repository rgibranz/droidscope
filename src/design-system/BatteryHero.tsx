import { BatteryCharging, BatteryFull, TrendingDown } from 'lucide-react-native';
import { Text, XStack, YStack, useTheme } from './tamagui';
import { BATTERY_RING_SIZE, BatteryRing } from './BatteryRing';
import { typeScale } from '../core/theme/tokens';
import { formatPercent, formatWatts, UNAVAILABLE } from '../core/utils/units';
import type { ChargeStatus } from '../data/models/battery';
import {
  formatDuration,
  type Confidence,
  type Estimate,
} from '../features/analytics/estimate';

const STATUS_LABEL: Record<ChargeStatus, string> = {
  charging: 'Charging',
  discharging: 'Discharging',
  full: 'Full',
  notCharging: 'Not charging',
  unknown: 'Unknown',
};

/**
 * §41.5 requires state to be readable without relying on colour, so the hero
 * always pairs the accent with an icon and a written status.
 */
const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

export function BatteryHero({
  levelPercent,
  powerW,
  status,
  isCharging,
  estimate,
}: {
  levelPercent: number | null;
  powerW: number | null;
  status: ChargeStatus;
  isCharging: boolean;
  estimate: Estimate;
}) {
  const theme = useTheme();
  const accent = isCharging
    ? theme.charging?.val ?? '#3DD68C'
    : theme.color?.val ?? '#E8EAED';

  const Icon =
    status === 'full' ? BatteryFull : isCharging ? BatteryCharging : TrendingDown;

  const powerLabel = powerW === null ? UNAVAILABLE : `${formatWatts(powerW)} W`;

  return (
    <YStack
      backgroundColor="$surface"
      borderColor="$borderColor"
      borderWidth={1}
      borderRadius="$4"
      paddingVertical="$6"
      paddingHorizontal="$4"
      alignItems="center"
      gap="$3"
      accessible
      accessibilityLabel={
        `Battery ${formatPercent(levelPercent)} percent, ${STATUS_LABEL[status].toLowerCase()}` +
        (powerW === null ? '' : `, ${formatWatts(powerW)} watts`)
      }
    >
      <YStack width={BATTERY_RING_SIZE} height={BATTERY_RING_SIZE} alignItems="center">
        <YStack position="absolute" top={0} left={0}>
          <BatteryRing percent={levelPercent} charging={isCharging} />
        </YStack>
        <YStack flex={1} justifyContent="center" alignItems="center">
          <XStack alignItems="baseline">
            <Text
              fontSize={typeScale.hero}
              fontWeight="700"
              color="$color"
              fontVariant={['tabular-nums']}
            >
              {formatPercent(levelPercent)}
            </Text>
            <Text fontSize={typeScale.sectionTitle} color="$textMuted">
              %
            </Text>
          </XStack>
        </YStack>
      </YStack>

      <XStack alignItems="center" gap="$2">
        <Icon size={16} color={accent} />
        <Text
          fontSize={typeScale.label}
          letterSpacing={1}
          textTransform="uppercase"
          color={isCharging ? '$charging' : '$color'}
        >
          {STATUS_LABEL[status]}
        </Text>
      </XStack>

      <Text
        fontSize={typeScale.heroPower}
        fontWeight="600"
        color="$color"
        fontVariant={['tabular-nums']}
      >
        {powerLabel}
      </Text>

      <EstimateLine estimate={estimate} isCharging={isCharging} />
    </YStack>
  );
}

/**
 * §2.2 and §31: an estimate is labelled as one, and carries its confidence.
 * When there is not enough history it says what it is waiting for rather than
 * showing a placeholder number.
 */
function EstimateLine({
  estimate,
  isCharging,
}: {
  estimate: Estimate;
  isCharging: boolean;
}) {
  if (estimate.kind === 'unavailable') {
    return (
      <Text fontSize={typeScale.label} color="$textMuted" textAlign="center">
        {estimate.reason}
      </Text>
    );
  }

  return (
    <YStack alignItems="center" gap="$1">
      <Text
        fontSize={typeScale.sectionTitle}
        color="$color"
        fontVariant={['tabular-nums']}
      >
        {formatDuration(estimate.hours)}
      </Text>
      <Text fontSize={typeScale.label} color="$textMuted" textAlign="center">
        {isCharging ? 'estimated until full' : 'estimated remaining'} ·{' '}
        {CONFIDENCE_LABEL[estimate.confidence].toLowerCase()}
      </Text>
    </YStack>
  );
}

import { BatteryCharging, BatteryFull, TrendingDown } from 'lucide-react-native';
import { Text, XStack, YStack, useTheme } from './tamagui';
import { BATTERY_RING_SIZE, BatteryRing } from './BatteryRing';
import { typeScale } from '../core/theme/tokens';
import { formatPercent, formatWatts, UNAVAILABLE } from '../core/utils/units';
import type { ChargeStatus } from '../data/models/battery';

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
export function BatteryHero({
  levelPercent,
  powerW,
  status,
  isCharging,
}: {
  levelPercent: number | null;
  powerW: number | null;
  status: ChargeStatus;
  isCharging: boolean;
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
    </YStack>
  );
}

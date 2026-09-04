import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { BatteryCharging, TrendingDown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Text, XStack, YStack, useTheme } from '../../design-system/tamagui';
import { InlineNotice, SectionHeader } from '../../design-system/primitives';
import { typeScale } from '../../core/theme/tokens';
import {
  formatCelsius,
  formatPercent,
  formatWatts,
  UNAVAILABLE,
} from '../../core/utils/units';
import { formatDuration } from '../analytics/estimate';
import { getSessions } from '../../data/history/historyRepository';
import type { Session } from '../../data/history/sessions';
import { RANGE_MS } from '../../data/history/buckets';

// FlashList takes a restricted style object, not a full RN style, so this is
// built here rather than through StyleSheet.
const LIST_PADDING = { paddingHorizontal: 16, paddingTop: 12 } as const;

/**
 * §42.4: sessions as cards, on FlashList because this list grows without bound
 * within the retention window.
 */
export function SessionsScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const contentStyle = useMemo(
    () => ({ ...LIST_PADDING, paddingBottom: tabBarHeight + 24 }),
    [tabBarHeight],
  );

  const load = useCallback(() => {
    try {
      setSessions(getSessions(Date.now() - RANGE_MS['7D']));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  return (
    <YStack flex={1} backgroundColor="$background">
      <YStack paddingHorizontal="$4" paddingTop={insets.top + 12} gap="$3">
        <SectionHeader>Sessions</SectionHeader>
        {error ? (
          <InlineNotice tone="warning">
            Could not read sessions: {error}
          </InlineNotice>
        ) : null}
      </YStack>

      <FlashList
        data={sessions}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => <SessionCard session={item} />}
        contentContainerStyle={contentStyle}
        ListEmptyComponent={
          error ? null : (
            <YStack paddingHorizontal="$4">
              <InlineNotice>
                No charging or discharging sessions recorded yet. A session forms
                once monitoring has covered a stretch of time on one power state.
              </InlineNotice>
            </YStack>
          )
        }
      />
    </YStack>
  );
}

function SessionCard({ session }: { session: Session }) {
  const theme = useTheme();
  const accent = session.isCharging
    ? theme.charging?.val ?? '#3DD68C'
    : theme.textMuted?.val ?? '#9AA1AC';
  const Icon = session.isCharging ? BatteryCharging : TrendingDown;

  const levels =
    session.startPercent === null || session.endPercent === null
      ? UNAVAILABLE
      : `${formatPercent(session.startPercent)}% → ${formatPercent(session.endPercent)}%`;

  const durationHours = (session.endTime - session.startTime) / 3_600_000;

  return (
    <YStack
      backgroundColor="$surface"
      borderColor="$borderColor"
      borderWidth={1}
      borderRadius="$2"
      padding="$4"
      gap="$3"
      marginBottom="$3"
      accessible
      accessibilityLabel={
        `${session.isCharging ? 'Charging' : 'Discharging'} session, ` +
        `${levels}, ${formatDuration(durationHours)}`
      }
    >
      <XStack alignItems="center" justifyContent="space-between">
        <XStack alignItems="center" gap="$2">
          <Icon size={15} color={accent} />
          <Text
            fontSize={typeScale.label}
            letterSpacing={0.8}
            textTransform="uppercase"
            color={session.isCharging ? '$charging' : '$textMuted'}
          >
            {session.isCharging ? 'Charging' : 'Discharging'}
          </Text>
        </XStack>
        <Text fontSize={typeScale.label} color="$textMuted">
          {formatDateTime(session.startTime)}
        </Text>
      </XStack>

      <XStack alignItems="baseline" gap="$3">
        <Text
          fontSize={typeScale.metricValue}
          fontWeight="600"
          color="$color"
          fontVariant={['tabular-nums']}
        >
          {levels}
        </Text>
        <Text fontSize={typeScale.body} color="$textMuted">
          {formatDuration(durationHours)}
        </Text>
      </XStack>

      <XStack justifyContent="space-between">
        <Stat
          label="Avg"
          value={
            session.averagePowerW === null
              ? UNAVAILABLE
              : `${formatWatts(session.averagePowerW)} W`
          }
        />
        <Stat
          label="Peak"
          value={
            session.peakPowerW === null
              ? UNAVAILABLE
              : `${formatWatts(session.peakPowerW)} W`
          }
        />
        <Stat
          label="Peak temp"
          value={
            session.peakTemperatureC === null
              ? UNAVAILABLE
              : `${formatCelsius(session.peakTemperatureC)} °C`
          }
        />
      </XStack>

      {session.energyAddedWh === null ? null : (
        <Text fontSize={typeScale.label} color="$textMuted">
          {/* §2.2: derived from average power, so labelled as an estimate. */}
          ≈ {session.energyAddedWh.toFixed(2)} Wh{' '}
          {session.isCharging ? 'added' : 'used'} (estimated)
        </Text>
      )}
    </YStack>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <YStack gap="$1">
      <Text
        fontSize={typeScale.label}
        letterSpacing={0.6}
        textTransform="uppercase"
        color="$textMuted"
      >
        {label}
      </Text>
      <Text
        fontSize={typeScale.body}
        color="$color"
        fontVariant={['tabular-nums']}
      >
        {value}
      </Text>
    </YStack>
  );
}

function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
  return `${d.getDate()}/${d.getMonth() + 1} ${time}`;
}

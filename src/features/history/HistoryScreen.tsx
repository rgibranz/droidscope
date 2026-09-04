import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Text, XStack, YStack } from '../../design-system/tamagui';
import { AppScreen } from '../../design-system/AppScreen';
import { InlineNotice, SectionHeader } from '../../design-system/primitives';
import { TimeRangeSelector } from '../../design-system/TimeRangeSelector';
import {
  TelemetryChart,
  type ChartMetric,
} from '../../design-system/TelemetryChart';
import { typeScale } from '../../core/theme/tokens';
import {
  formatCelsius,
  formatMilliamps,
  formatPercent,
  formatWatts,
  UNAVAILABLE,
} from '../../core/utils/units';
import { RANGE_MS, type HistoryRange } from '../../data/history/buckets';
import {
  queryHistory,
  querySummary,
} from '../../data/history/historyRepository';
import type { HistoryPoint, HistorySummary } from '../../data/history/schema';

interface MetricConfig {
  key: ChartMetric;
  title: string;
  format: (value: number) => string;
  fixedDomain?: [number, number];
}

const METRICS: MetricConfig[] = [
  {
    key: 'levelPercent',
    title: 'Battery level',
    format: v => `${formatPercent(v)}%`,
    // §45: never exaggerate small changes with a narrow scale.
    fixedDomain: [0, 100],
  },
  { key: 'powerW', title: 'Power', format: v => `${formatWatts(v)} W` },
  { key: 'currentMa', title: 'Current', format: v => `${formatMilliamps(v)} mA` },
  { key: 'temperatureC', title: 'Temperature', format: v => `${formatCelsius(v)} °C` },
];

export function HistoryScreen() {
  const [range, setRange] = useState<HistoryRange>('1H');
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [summary, setSummary] = useState<HistorySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const to = Date.now();
    const from = to - RANGE_MS[range];
    try {
      setPoints(queryHistory(from, to));
      setSummary(querySummary(from, to));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [range]);

  useEffect(() => {
    load();
    // Refresh on resume rather than polling: §19.1 keeps the JS layer passive
    // and history only moves as fast as the sampling interval anyway.
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  return (
    <AppScreen>
      <SectionHeader>History</SectionHeader>
      <TimeRangeSelector value={range} onChange={setRange} />

      {error ? (
        <InlineNotice tone="warning">Could not read history: {error}</InlineNotice>
      ) : null}

      <SummaryBlock summary={summary} range={range} />

      {METRICS.map(metric => (
        <YStack key={metric.key} gap="$2">
          <SectionHeader>{metric.title}</SectionHeader>
          <TelemetryChart
            points={points}
            metric={metric.key}
            format={metric.format}
            fixedDomain={metric.fixedDomain}
          />
        </YStack>
      ))}
    </AppScreen>
  );
}

/**
 * §45 requires the key numbers to exist outside the chart, so this block is not
 * decoration -- it is how the screen stays usable without scrubbing a graph.
 */
function SummaryBlock({
  summary,
  range,
}: {
  summary: HistorySummary | null;
  range: HistoryRange;
}) {
  if (!summary || summary.count === 0) {
    return (
      <InlineNotice>
        No samples stored for the last {range} yet. Monitoring writes one sample
        every 10 seconds while the app is open.
      </InlineNotice>
    );
  }

  const drain =
    summary.levelStart === null || summary.levelEnd === null
      ? null
      : summary.levelEnd - summary.levelStart;

  return (
    <YStack
      backgroundColor="$surface"
      borderColor="$borderColor"
      borderWidth={1}
      borderRadius="$2"
      padding="$4"
      gap="$3"
      accessible
      accessibilityLabel={
        `Last ${range}: ${summary.count} samples, average power ` +
        `${summary.averagePowerW === null ? 'unavailable' : formatWatts(summary.averagePowerW) + ' watts'}`
      }
    >
      <XStack justifyContent="space-between">
        <SummaryItem
          label="Level change"
          value={drain === null ? UNAVAILABLE : `${drain > 0 ? '+' : ''}${drain}%`}
        />
        <SummaryItem
          label="Avg power"
          value={
            summary.averagePowerW === null
              ? UNAVAILABLE
              : `${formatWatts(summary.averagePowerW)} W`
          }
        />
      </XStack>
      <XStack justifyContent="space-between">
        <SummaryItem
          label="Min power"
          value={
            summary.minPowerW === null
              ? UNAVAILABLE
              : `${formatWatts(summary.minPowerW)} W`
          }
        />
        <SummaryItem
          label="Max power"
          value={
            summary.maxPowerW === null
              ? UNAVAILABLE
              : `${formatWatts(summary.maxPowerW)} W`
          }
        />
      </XStack>
      <Text fontSize={typeScale.label} color="$textMuted">
        {summary.count} samples stored
      </Text>
    </YStack>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <YStack flex={1} gap="$1">
      <Text
        fontSize={typeScale.label}
        letterSpacing={0.6}
        textTransform="uppercase"
        color="$textMuted"
      >
        {label}
      </Text>
      <Text
        fontSize={typeScale.metricValue}
        fontWeight="600"
        color="$color"
        fontVariant={['tabular-nums']}
      >
        {value}
      </Text>
    </YStack>
  );
}

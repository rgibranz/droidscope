import { useMemo, useState } from 'react';
import { Area, CartesianChart, Line, useChartPressState } from 'victory-native';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { Text, XStack, YStack, useTheme } from './tamagui';
import { typeScale } from '../core/theme/tokens';
import type { HistoryPoint } from '../data/history/schema';

export type ChartMetric =
  | 'levelPercent'
  | 'powerW'
  | 'currentMa'
  | 'temperatureC';

interface TelemetryChartProps {
  points: HistoryPoint[];
  metric: ChartMetric;
  /** Formats a value for the scale labels and the scrub readout. */
  format: (value: number) => string;
  /** §45: battery % is always 0-100 so small changes are not exaggerated. */
  fixedDomain?: [number, number];
  height?: number;
}

type Row = { x: number; y: number };

/**
 * Skia-backed time series (§4.0.5). Axis labels are deliberately not drawn by
 * Skia: that needs a bundled font file, and §45 wants the key numbers to exist
 * as real text outside the graph anyway -- rendered as Tamagui text they also
 * respect the user's font size settings.
 */
export function TelemetryChart({
  points,
  metric,
  format,
  fixedDomain,
  height = 200,
}: TelemetryChartProps) {
  const theme = useTheme();
  const accent = theme.accent?.val ?? '#4C8DFF';

  // A null metric is a genuine gap in the data, so those buckets are dropped
  // rather than plotted as zero.
  const data = useMemo<Row[]>(
    () =>
      points
        .map(p => ({ x: p.timestamp, y: p[metric] }))
        .filter((r): r is Row => r.y !== null && Number.isFinite(r.y)),
    [points, metric],
  );

  const domain = useMemo<[number, number] | undefined>(() => {
    if (fixedDomain) return fixedDomain;
    if (!data.length) return undefined;
    const values = data.map(r => r.y);
    const min = Math.min(...values);
    const max = Math.max(...values);
    // A flat series would otherwise collapse to a zero-height domain.
    if (min === max) return [min - 1, max + 1];
    const pad = (max - min) * 0.12;
    return [min - pad, max + pad];
  }, [data, fixedDomain]);

  const { state } = useChartPressState({ x: 0, y: { y: 0 } });
  const [scrub, setScrub] = useState<{ x: number; y: number } | null>(null);

  // state.isActive is a shared value; reading the hook's plain boolean inside a
  // worklet would capture a stale copy from the render that created it.
  useAnimatedReaction(
    () =>
      state.isActive.value
        ? { x: state.x.value.value, y: state.y.y.value.value }
        : null,
    (current, previous) => {
      if (current?.x !== previous?.x || current?.y !== previous?.y) {
        runOnJS(setScrub)(current);
      }
    },
  );

  if (data.length < 2) {
    return (
      <YStack
        height={height}
        backgroundColor="$surface"
        borderColor="$borderColor"
        borderWidth={1}
        borderRadius="$2"
        alignItems="center"
        justifyContent="center"
        padding="$4"
      >
        <Text fontSize={typeScale.body} color="$textMuted" textAlign="center">
          Collecting enough history to plot this range…
        </Text>
      </YStack>
    );
  }

  const [low, high] = domain ?? [0, 1];

  return (
    <YStack
      backgroundColor="$surface"
      borderColor="$borderColor"
      borderWidth={1}
      borderRadius="$2"
      padding="$3"
      gap="$2"
    >
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize={typeScale.label} color="$textMuted">
          {format(high)}
        </Text>
        {scrub ? (
          <Text
            fontSize={typeScale.label}
            color="$color"
            fontVariant={['tabular-nums']}
          >
            {formatClock(scrub.x)} · {format(scrub.y)}
          </Text>
        ) : null}
      </XStack>

      <YStack height={height}>
        <CartesianChart
          data={data}
          xKey="x"
          yKeys={['y']}
          domain={{ y: [low, high] }}
          chartPressState={state}
        >
          {({ points: chartPoints, chartBounds }) => (
            <>
              <Area
                points={chartPoints.y}
                y0={chartBounds.bottom}
                color={accent}
                opacity={0.16}
                animate={{ type: 'timing', duration: 220 }}
              />
              <Line
                points={chartPoints.y}
                color={accent}
                strokeWidth={2}
                animate={{ type: 'timing', duration: 220 }}
              />
            </>
          )}
        </CartesianChart>
      </YStack>

      <XStack justifyContent="space-between">
        <Text fontSize={typeScale.label} color="$textMuted">
          {format(low)}
        </Text>
        <Text fontSize={typeScale.label} color="$textMuted">
          {formatClock(data[0].x)} – {formatClock(data[data.length - 1].x)}
        </Text>
      </XStack>
    </YStack>
  );
}

function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

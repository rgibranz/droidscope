import { useEffect } from 'react';
import { Activity, Gauge, Plug, RefreshCw, Thermometer } from 'lucide-react-native';
import { Text, XStack, YStack } from '../../design-system/tamagui';
import { AppScreen } from '../../design-system/AppScreen';
import { BatteryHero } from '../../design-system/BatteryHero';
import { MetricCard, type MetricAvailability } from '../../design-system/MetricCard';
import {
  InlineNotice,
  MetricSkeleton,
  SectionHeader,
} from '../../design-system/primitives';
import { typeScale } from '../../core/theme/tokens';
import {
  formatCelsius,
  formatMah,
  formatMilliamps,
  formatVolts,
} from '../../core/utils/units';
import {
  temperatureBand,
  type BatteryHealth,
  type PlugType,
} from '../../data/models/battery';
import { useBatteryStore } from './store';
import { useEstimate } from '../analytics/useEstimate';

const PLUG_LABEL: Record<PlugType, string> = {
  ac: 'AC',
  usb: 'USB',
  wireless: 'Wireless',
  dock: 'Dock',
  none: 'Not plugged',
  unknown: 'Unknown',
};

const HEALTH_LABEL: Record<BatteryHealth, string> = {
  good: 'Good',
  overheat: 'Overheating',
  dead: 'Dead',
  overVoltage: 'Over voltage',
  unspecifiedFailure: 'Failure',
  cold: 'Cold',
  unknown: 'Unknown',
};

export function DashboardScreen() {
  const status = useBatteryStore(s => s.status);
  const reading = useBatteryStore(s => s.reading);
  const capabilities = useBatteryStore(s => s.capabilities);
  const calibration = useBatteryStore(s => s.calibration);
  const error = useBatteryStore(s => s.error);
  const start = useBatteryStore(s => s.start);

  // Called before the early returns below: hooks cannot be conditional.
  const estimate = useEstimate(reading?.isCharging ?? false);

  // Monitoring normally starts with the bundle (see core/monitoring/bootstrap).
  // This is a safety net for the case where that failed; start() is idempotent.
  // Deliberately no cleanup: sampling must outlive this screen.
  useEffect(() => {
    start();
  }, [start]);

  if (status === 'error') {
    return (
      <AppScreen>
        <SectionHeader>BatteryScope</SectionHeader>
        <InlineNotice tone="warning">
          Could not read battery telemetry: {error}
        </InlineNotice>
      </AppScreen>
    );
  }

  if (!reading) {
    return (
      <AppScreen>
        <SectionHeader>BatteryScope</SectionHeader>
        <Text fontSize={typeScale.body} color="$textMuted">
          Reading battery sensors…
        </Text>
        <XStack gap="$3">
          <MetricSkeleton />
          <MetricSkeleton />
        </XStack>
        <XStack gap="$3">
          <MetricSkeleton />
          <MetricSkeleton />
        </XStack>
      </AppScreen>
    );
  }

  const availability = (
    supported: boolean | undefined,
    kind: MetricAvailability = 'measured',
  ): MetricAvailability => (supported ? kind : 'unsupported');

  const tempBand =
    reading.temperatureC === null ? null : temperatureBand(reading.temperatureC);
  const tempTone =
    tempBand === 'veryHot' ? 'danger' : tempBand === 'hot' ? 'warning' : 'default';

  return (
    <AppScreen>
      <SectionHeader>BatteryScope</SectionHeader>

      <BatteryHero
        levelPercent={reading.levelPercent}
        powerW={reading.powerW}
        status={reading.status}
        isCharging={reading.isCharging}
        estimate={estimate}
      />

      {calibration.convention === 'unknown' && capabilities?.currentNow ? (
        <InlineNotice>
          Learning this device's current-sign convention ({calibration.streak} of 10
          consistent samples). Direction is taken from Android's charge status
          until then.
        </InlineNotice>
      ) : null}

      <YStack gap="$3">
        <XStack gap="$3">
          <MetricCard
            label="Current"
            value={formatMilliamps(reading.currentMa)}
            unit="mA"
            icon={Activity}
            availability={availability(capabilities?.currentNow)}
            unavailableNote="Not reported by this device"
          />
          <MetricCard
            label="Voltage"
            value={formatVolts(reading.voltageV)}
            unit="V"
            icon={Gauge}
            availability={availability(capabilities?.voltage)}
          />
        </XStack>

        <XStack gap="$3">
          <MetricCard
            label="Temperature"
            value={formatCelsius(reading.temperatureC)}
            unit="°C"
            icon={Thermometer}
            tone={tempTone}
            availability={availability(capabilities?.temperature)}
          />
          <MetricCard
            label="Power source"
            value={PLUG_LABEL[reading.plug]}
            icon={Plug}
            variant="text"
          />
        </XStack>

        <XStack gap="$3">
          <MetricCard
            label="Charge counter"
            value={formatMah(reading.chargeCounterMah)}
            unit="mAh"
            availability={availability(capabilities?.chargeCounter)}
            unavailableNote="Not exposed by Android here"
          />
          <MetricCard
            label="Cycles"
            value={reading.cycleCount === null ? '' : String(reading.cycleCount)}
            icon={RefreshCw}
            availability={availability(capabilities?.cycleCount)}
            unavailableNote="Not exposed by Android here"
          />
        </XStack>
      </YStack>

      <YStack gap="$2">
        <SectionHeader>System battery status</SectionHeader>
        <Text fontSize={typeScale.sectionTitle} color="$color">
          {HEALTH_LABEL[reading.health]}
        </Text>
        {/* §15: the health enum is a status, never a percentage. */}
        <Text fontSize={typeScale.label} color="$textMuted">
          Android reports a status, not a capacity percentage.
        </Text>
      </YStack>
    </AppScreen>
  );
}

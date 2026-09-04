import { Text, XStack, YStack } from '../../design-system/tamagui';
import { AppScreen } from '../../design-system/AppScreen';
import {
  ActionButton,
  DiagnosticRow,
  InlineNotice,
  SectionHeader,
} from '../../design-system/primitives';
import { typeScale } from '../../core/theme/tokens';
import { verdictFor, type RangedField } from '../../core/utils/validate';
import { useBatteryStore } from '../battery-live/store';
import type { NativeCapabilities } from '../../core/native/NativeBatteryTelemetry';

const CAPABILITY_LABELS: Array<[keyof NativeCapabilities, string]> = [
  ['levelPercent', 'Battery percentage'],
  ['voltage', 'Voltage'],
  ['temperature', 'Temperature'],
  ['currentNow', 'Current (now)'],
  ['currentAverage', 'Current (average)'],
  ['chargeCounter', 'Charge counter'],
  ['energyCounter', 'Energy counter'],
  ['cycleCount', 'Cycle count'],
  ['fullChargeCapacity', 'Measured full-charge capacity'],
  ['designCapacity', 'Design capacity'],
];

/**
 * The transparency screen (§7.5). It distinguishes "not exposed" from "reported
 * but rejected as implausible" -- without that, debugging an unfamiliar vendor
 * is guesswork.
 */
export function DiagnosticsScreen() {
  const diagnostics = useBatteryStore(s => s.diagnostics);
  const capabilities = useBatteryStore(s => s.capabilities);
  const snapshot = useBatteryStore(s => s.snapshot);
  const calibration = useBatteryStore(s => s.calibration);
  const resetCalibration = useBatteryStore(s => s.resetCalibration);

  const rejected = (value: number | null | undefined, field: RangedField) =>
    value === undefined ? false : verdictFor(value, field) === 'outOfRange';

  return (
    <AppScreen>
      <SectionHeader>Device</SectionHeader>
      <YStack>
        <DiagnosticRow
          label="Model"
          value={
            diagnostics
              ? `${diagnostics.manufacturer} ${diagnostics.model}`
              : '—'
          }
        />
        <DiagnosticRow
          label="Android"
          value={
            diagnostics
              ? `${diagnostics.androidRelease} (SDK ${diagnostics.sdkInt})`
              : '—'
          }
        />
        <DiagnosticRow label="Hardware" value={diagnostics?.hardware ?? '—'} />
        <DiagnosticRow
          label="sysfs access"
          value={diagnostics?.sysfsReadable ? 'readable' : 'blocked'}
          state={diagnostics?.sysfsReadable ? 'available' : 'unavailable'}
        />
      </YStack>
      {diagnostics && !diagnostics.sysfsReadable ? (
        <InlineNotice>{diagnostics.sysfsNote}</InlineNotice>
      ) : null}

      <SectionHeader>Telemetry support</SectionHeader>
      <YStack>
        {capabilities
          ? CAPABILITY_LABELS.map(([key, label]) => (
              <DiagnosticRow
                key={key}
                label={label}
                state={capabilities[key] ? 'available' : 'unavailable'}
              />
            ))
          : null}
      </YStack>

      <SectionHeader>Value checks</SectionHeader>
      <YStack>
        <DiagnosticRow
          label="Voltage in plausible range"
          value={snapshot?.voltageMv === null ? 'unsupported' : `${snapshot?.voltageMv} mV`}
          state={rejected(snapshot?.voltageMv, 'voltageMv') ? 'rejected' : 'available'}
        />
        <DiagnosticRow
          label="Current in plausible range"
          value={snapshot?.currentUa === null ? 'unsupported' : `${snapshot?.currentUa} µA`}
          state={rejected(snapshot?.currentUa, 'currentUa') ? 'rejected' : 'available'}
        />
        <DiagnosticRow
          label="Temperature in plausible range"
          value={
            snapshot?.temperatureDeciC === null
              ? 'unsupported'
              : `${snapshot?.temperatureDeciC} d°C`
          }
          state={
            rejected(snapshot?.temperatureDeciC, 'temperatureDeciC')
              ? 'rejected'
              : 'available'
          }
        />
      </YStack>

      <SectionHeader>Current sign calibration</SectionHeader>
      <YStack gap="$3">
        <DiagnosticRow
          label="Convention"
          value={calibration.convention}
          state={calibration.convention === 'unknown' ? 'unavailable' : 'available'}
        />
        <DiagnosticRow
          label="Consistent samples"
          value={`${calibration.streak} / 10`}
        />
        <ActionButton onPress={resetCalibration}>
          Reset calibration
        </ActionButton>
      </YStack>

      <SectionHeader>Raw values</SectionHeader>
      <YStack>
        {diagnostics?.raw.map(entry => (
          <XStack
            key={entry.key}
            paddingVertical="$2"
            gap="$3"
            borderBottomWidth={1}
            borderBottomColor="$borderColor"
          >
            <YStack flex={1}>
              <Text fontSize={typeScale.label} color="$color">
                {entry.key}
              </Text>
              <Text fontSize={typeScale.label} color="$textMuted">
                {entry.source}
              </Text>
            </YStack>
            <Text
              fontSize={typeScale.label}
              color={entry.value === 'unsupported' ? '$textMuted' : '$color'}
              fontVariant={['tabular-nums']}
            >
              {entry.value}
            </Text>
          </XStack>
        ))}
      </YStack>
    </AppScreen>
  );
}

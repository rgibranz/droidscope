import type { NativeSnapshot } from '../native/NativeBatteryTelemetry';
import {
  toChargeStatus,
  toHealth,
  toPlugType,
  type BatteryReading,
} from '../../data/models/battery';
import {
  computePowerW,
  deciCToCelsius,
  mvToVolts,
  uahToMah,
  uaToMilliamps,
} from '../utils/units';
import { sanitize } from '../utils/validate';
import { normaliseCurrentUa, type SignConvention } from './signCalibration';

/**
 * Turns a raw device snapshot into the reading screens consume: values
 * validated, current sign normalised, units converted.
 */
export function toReading(
  snapshot: NativeSnapshot,
  convention: SignConvention,
): BatteryReading {
  const status = toChargeStatus(snapshot.statusCode);

  const voltageMv = sanitize(snapshot.voltageMv, 'voltageMv');
  const rawCurrentUa = sanitize(snapshot.currentUa, 'currentUa');
  const currentUa = normaliseCurrentUa(rawCurrentUa, convention, status);

  return {
    timestamp: snapshot.timestamp,
    levelPercent: sanitize(snapshot.levelPercent, 'levelPercent'),
    voltageV: mvToVolts(voltageMv),
    currentMa: uaToMilliamps(currentUa),
    powerW: computePowerW(voltageMv, currentUa),
    temperatureC: deciCToCelsius(
      sanitize(snapshot.temperatureDeciC, 'temperatureDeciC'),
    ),
    chargeCounterMah: uahToMah(
      sanitize(snapshot.chargeCounterUah, 'chargeCounterUah'),
    ),
    cycleCount: sanitize(snapshot.cycleCount, 'cycleCount'),
    status,
    plug: toPlugType(snapshot.pluggedCode),
    health: toHealth(snapshot.healthCode),
    // Android's status is authoritative for charge direction; `full` still
    // counts as plugged-in behaviour for the hero state.
    isCharging: status === 'charging' || status === 'full',
    technology: snapshot.technology,
  };
}

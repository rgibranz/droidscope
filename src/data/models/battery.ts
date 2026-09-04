/**
 * Domain models. Two distinct shapes on purpose:
 *
 *  - NativeSnapshot (see core/native) is what the device reports, raw.
 *  - BatteryReading is what screens consume: sign-normalised, human units.
 *
 * The split is what makes "never fabricate a value" structurally enforceable --
 * powerW cannot be populated when either of its inputs is null.
 */

export type ChargeStatus =
  | 'charging'
  | 'discharging'
  | 'full'
  | 'notCharging'
  | 'unknown';

export type PlugType = 'ac' | 'usb' | 'wireless' | 'dock' | 'none' | 'unknown';

export type BatteryHealth =
  | 'good'
  | 'overheat'
  | 'dead'
  | 'overVoltage'
  | 'unspecifiedFailure'
  | 'cold'
  | 'unknown';

export interface BatteryReading {
  timestamp: number;
  levelPercent: number | null;
  voltageV: number | null;
  /** Sign-normalised: negative drains the battery, positive charges it. */
  currentMa: number | null;
  /** null whenever voltage or current is missing -- never estimated. */
  powerW: number | null;
  temperatureC: number | null;
  chargeCounterMah: number | null;
  cycleCount: number | null;
  status: ChargeStatus;
  plug: PlugType;
  health: BatteryHealth;
  isCharging: boolean;
  technology: string | null;
}

/**
 * Android's BatteryManager constants. Duplicated here rather than read from
 * native so the mapping can be unit tested without a device.
 */
export const ANDROID_STATUS: Record<number, ChargeStatus> = {
  1: 'unknown',
  2: 'charging',
  3: 'discharging',
  4: 'notCharging',
  5: 'full',
};

export const ANDROID_HEALTH: Record<number, BatteryHealth> = {
  1: 'unknown',
  2: 'good',
  3: 'overheat',
  4: 'dead',
  5: 'overVoltage',
  6: 'unspecifiedFailure',
  7: 'cold',
};

export const ANDROID_PLUG: Record<number, PlugType> = {
  0: 'none',
  1: 'ac',
  2: 'usb',
  4: 'wireless',
  8: 'dock',
};

export function toChargeStatus(code: number | null): ChargeStatus {
  if (code === null) return 'unknown';
  return ANDROID_STATUS[code] ?? 'unknown';
}

export function toHealth(code: number | null): BatteryHealth {
  if (code === null) return 'unknown';
  return ANDROID_HEALTH[code] ?? 'unknown';
}

export function toPlugType(code: number | null): PlugType {
  if (code === null) return 'unknown';
  return ANDROID_PLUG[code] ?? 'unknown';
}

/** Labels for §13's temperature bands. Informational only, not a diagnosis. */
export type TemperatureBand = 'normal' | 'warm' | 'hot' | 'veryHot';

export function temperatureBand(celsius: number): TemperatureBand {
  if (celsius < 35) return 'normal';
  if (celsius < 40) return 'warm';
  if (celsius <= 45) return 'hot';
  return 'veryHot';
}

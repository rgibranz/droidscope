/**
 * Conservative sanity ranges from §18. A value outside the plausible range for
 * a phone battery is rejected rather than shown.
 *
 * "Unsupported" and "out of range" both end up as null in a BatteryReading, but
 * they are different facts and Diagnostics reports them differently -- without
 * that distinction, debugging an unfamiliar vendor is guesswork.
 */

export interface Range {
  min: number;
  max: number;
}

export const RANGES = {
  levelPercent: { min: 0, max: 100 },
  voltageMv: { min: 2500, max: 5000 },
  temperatureDeciC: { min: -100, max: 800 },
  // 20 A is far above any phone charger; anything beyond it is a bad reading.
  currentUa: { min: -20_000_000, max: 20_000_000 },
  chargeCounterUah: { min: 0, max: 50_000_000 },
  cycleCount: { min: 0, max: 10_000 },
} as const satisfies Record<string, Range>;

export type RangedField = keyof typeof RANGES;

export type FieldVerdict = 'ok' | 'unsupported' | 'outOfRange';

export function verdictFor(
  value: number | null,
  field: RangedField,
): FieldVerdict {
  if (value === null) return 'unsupported';
  return inRange(value, RANGES[field]) ? 'ok' : 'outOfRange';
}

export function sanitize(
  value: number | null,
  field: RangedField,
): number | null {
  if (value === null) return null;
  return inRange(value, RANGES[field]) ? value : null;
}

function inRange(value: number, range: Range): boolean {
  return Number.isFinite(value) && value >= range.min && value <= range.max;
}

import type { ChargeStatus } from '../../data/models/battery';

/**
 * Devices disagree on the sign of current_now. §11 requires many consistent
 * observations before flipping anything -- a single sample is never enough.
 *
 * Pure reducer so the streak logic is testable without a device or storage.
 */

export type SignConvention = 'unknown' | 'normal' | 'reversed';

export interface SignCalibration {
  convention: SignConvention;
  /** Consecutive qualifying samples agreeing with `suggests`. */
  streak: number;
  suggests: Exclude<SignConvention, 'unknown'> | null;
}

export const INITIAL_CALIBRATION: SignCalibration = {
  convention: 'unknown',
  streak: 0,
  suggests: null,
};

export const REQUIRED_STREAK = 10;

/**
 * Current near zero carries no directional information and is the main source
 * of wrong guesses, so those samples are skipped rather than counted.
 */
export const MIN_SIGNIFICANT_UA = 30_000;

/**
 * Observed on an INFINIX X6728 at 100%: Android still reports status
 * `charging` while the full battery draws a *negative* current, because it is
 * no longer accepting charge and the system takes a little back out. Sampling
 * there would calibrate the device as reversed for good. A near-full battery
 * says nothing reliable about sign convention, so it is excluded.
 */
export const MAX_CALIBRATION_LEVEL = 95;

export interface SignObservation {
  currentUa: number | null;
  levelPercent: number | null;
  status: ChargeStatus;
}

export function observeSign(
  state: SignCalibration,
  observation: SignObservation,
): SignCalibration {
  // Once locked, only an explicit reset changes it.
  if (state.convention !== 'unknown') return state;

  const observed = conventionImpliedBy(observation);
  // Non-qualifying samples are ignored, not treated as disagreement.
  if (observed === null) return state;

  const streak = state.suggests === observed ? state.streak + 1 : 1;
  const next: SignCalibration = {
    convention: 'unknown',
    streak,
    suggests: observed,
  };

  if (streak >= REQUIRED_STREAK) {
    return { convention: observed, streak, suggests: observed };
  }
  return next;
}

export function resetCalibration(): SignCalibration {
  return INITIAL_CALIBRATION;
}

function conventionImpliedBy(
  observation: SignObservation,
): Exclude<SignConvention, 'unknown'> | null {
  const { currentUa, levelPercent, status } = observation;
  if (currentUa === null) return null;
  if (Math.abs(currentUa) < MIN_SIGNIFICANT_UA) return null;
  if (status !== 'charging' && status !== 'discharging') return null;
  // Without a level reading we cannot tell whether the battery is near full,
  // so the sample is not trustworthy enough to calibrate from.
  if (levelPercent === null || levelPercent >= MAX_CALIBRATION_LEVEL) return null;

  const positive = currentUa > 0;
  if (status === 'charging') return positive ? 'normal' : 'reversed';
  return positive ? 'reversed' : 'normal';
}

/**
 * Applies the calibration. While the convention is still unknown the magnitude
 * is trusted but the direction is taken from Android's charge status, which is
 * always reliable.
 */
export function normaliseCurrentUa(
  currentUa: number | null,
  convention: SignConvention,
  status: ChargeStatus,
): number | null {
  if (currentUa === null) return null;
  if (convention === 'reversed') return -currentUa;
  if (convention === 'normal') return currentUa;

  if (status === 'charging') return Math.abs(currentUa);
  if (status === 'discharging') return -Math.abs(currentUa);
  return currentUa;
}

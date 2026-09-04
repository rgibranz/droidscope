/**
 * Derived metrics (§39). Pure functions, no React, no native -- every rule in
 * §24, §25, §26 and §48 is expressible and testable here.
 */

export interface AnalyticsSample {
  timestamp: number;
  levelPercent: number;
  chargeCounterMah: number | null;
  powerW: number | null;
  isCharging: boolean;
}

export type Confidence = 'high' | 'medium' | 'low';

/**
 * A discriminated union rather than nullable fields: an estimate either exists
 * with its basis and confidence, or it does not exist and says why. There is no
 * shape in which a number appears without the context to read it.
 */
export type Estimate =
  | { kind: 'unavailable'; reason: string }
  | {
      kind: 'ready';
      hours: number;
      /**
       * Positive percent per hour; direction is implied by which estimate this
       * is. Null when the charge counter produced the estimate but the battery
       * percentage has not moved -- the rate is genuinely unknown then.
       */
      percentPerHour: number | null;
      confidence: Confidence;
      basis: 'chargeCounter' | 'level';
    };

/** §25: nothing is shown until there is enough usable history. */
export const MIN_WINDOW_MS = 5 * 60_000;
/** §24: the smoothing window. */
export const PREFERRED_WINDOW_MS = 30 * 60_000;

const HIGH_CONFIDENCE_MS = 20 * 60_000;
const MEDIUM_CONFIDENCE_MS = 10 * 60_000;

/**
 * Charging slows markedly near full (§26), so a linear extrapolation from the
 * fast part of the curve would be optimistic. Above this level the estimate is
 * still shown but never claims high confidence.
 */
const CHARGE_TAPER_LEVEL = 80;

export function estimateTimeRemaining(
  samples: AnalyticsSample[],
  windowMs: number = PREFERRED_WINDOW_MS,
): Estimate {
  const segment = latestSegment(samples, false, windowMs);
  if (segment.length < 2) {
    return { kind: 'unavailable', reason: 'Collecting usage data…' };
  }

  const first = segment[0];
  const last = segment[segment.length - 1];
  const elapsedMs = last.timestamp - first.timestamp;
  if (elapsedMs < MIN_WINDOW_MS) {
    return { kind: 'unavailable', reason: 'Collecting usage data…' };
  }

  const hours = elapsedMs / 3_600_000;

  // §24 prefers the charge counter: it moves smoothly, while battery percent
  // can sit unchanged for minutes.
  const counterEstimate = fromChargeCounter(first, last, hours);
  if (counterEstimate) return counterEstimate;

  const levelDrop = first.levelPercent - last.levelPercent;
  // §48: an unchanged percentage means "not enough data", never "infinite".
  if (levelDrop <= 0) {
    return { kind: 'unavailable', reason: 'Battery level has not moved yet' };
  }

  const percentPerHour = levelDrop / hours;
  return {
    kind: 'ready',
    hours: last.levelPercent / percentPerHour,
    percentPerHour,
    confidence: confidenceFor(elapsedMs),
    basis: 'level',
  };
}

export function estimateTimeToFull(
  samples: AnalyticsSample[],
  windowMs: number = PREFERRED_WINDOW_MS,
): Estimate {
  const segment = latestSegment(samples, true, windowMs);
  if (segment.length < 2) {
    return { kind: 'unavailable', reason: 'Collecting charging data…' };
  }

  const first = segment[0];
  const last = segment[segment.length - 1];
  const elapsedMs = last.timestamp - first.timestamp;
  if (elapsedMs < MIN_WINDOW_MS) {
    return { kind: 'unavailable', reason: 'Collecting charging data…' };
  }
  if (last.levelPercent >= 100) {
    return { kind: 'unavailable', reason: 'Battery is full' };
  }

  const gain = last.levelPercent - first.levelPercent;
  if (gain <= 0) {
    return { kind: 'unavailable', reason: 'Battery level has not moved yet' };
  }

  const hours = elapsedMs / 3_600_000;
  const percentPerHour = gain / hours;
  const confidence =
    last.levelPercent >= CHARGE_TAPER_LEVEL
      ? 'low'
      : confidenceFor(elapsedMs);

  return {
    kind: 'ready',
    hours: (100 - last.levelPercent) / percentPerHour,
    percentPerHour,
    confidence,
    basis: 'level',
  };
}

/** §47: analytics smooth, the dashboard shows the latest reading. */
export function averagePowerW(
  samples: AnalyticsSample[],
  windowMs: number,
  now: number,
): number | null {
  const values = samples
    .filter(s => now - s.timestamp <= windowMs)
    .map(s => s.powerW)
    .filter((v): v is number => v !== null);
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Takes only the trailing run of samples in the requested charge state. A
 * window that straddles a plug-in event describes two different behaviours, and
 * averaging across it would describe neither.
 */
function latestSegment(
  samples: AnalyticsSample[],
  charging: boolean,
  windowMs: number,
): AnalyticsSample[] {
  if (!samples.length) return [];
  const ordered = [...samples].sort((a, b) => a.timestamp - b.timestamp);
  const cutoff = ordered[ordered.length - 1].timestamp - windowMs;

  const segment: AnalyticsSample[] = [];
  for (let i = ordered.length - 1; i >= 0; i--) {
    const sample = ordered[i];
    if (sample.isCharging !== charging) break;
    if (sample.timestamp < cutoff) break;
    segment.unshift(sample);
  }
  return segment;
}

function fromChargeCounter(
  first: AnalyticsSample,
  last: AnalyticsSample,
  hours: number,
): Estimate | null {
  if (first.chargeCounterMah === null || last.chargeCounterMah === null) {
    return null;
  }
  const drop = first.chargeCounterMah - last.chargeCounterMah;
  // A vendor reporting a constant counter gives drop === 0; fall back to level.
  if (drop <= 0) return null;

  const ratePerHour = drop / hours;
  const levelDrop = first.levelPercent - last.levelPercent;

  return {
    kind: 'ready',
    hours: last.chargeCounterMah / ratePerHour,
    // The counter gives mAh per hour, not percent per hour. Percent is only
    // known if the level also moved; deriving it from mAh would require a
    // full-charge capacity this device may not report.
    percentPerHour: levelDrop > 0 ? levelDrop / hours : null,
    confidence: confidenceFor(hours * 3_600_000),
    basis: 'chargeCounter',
  };
}

function confidenceFor(elapsedMs: number): Confidence {
  if (elapsedMs >= HIGH_CONFIDENCE_MS) return 'high';
  if (elapsedMs >= MEDIUM_CONFIDENCE_MS) return 'medium';
  return 'low';
}

/** "5h 42m" -- §7.1's format. */
export function formatDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) return '--';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

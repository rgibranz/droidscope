/**
 * Downsampling arithmetic (§45, §23). Kept as pure functions so the bucketing
 * can be tested without a database.
 *
 * §45 is explicit that tens of thousands of raw points must never reach the
 * chart: a ~400px wide plot can show a few hundred meaningful points and no
 * more.
 */

export const CHART_TARGET_POINTS = 300;

/**
 * Bucket widths are chosen from a fixed ladder rather than computed exactly, so
 * that buckets line up on recognisable time boundaries and stay stable while a
 * range scrolls.
 */
const BUCKET_LADDER_MS = [
  10_000, // 10s -- the fastest sampling interval offered
  30_000,
  60_000,
  2 * 60_000,
  5 * 60_000,
  10 * 60_000,
  15 * 60_000,
  30 * 60_000,
  60 * 60_000,
  2 * 60 * 60_000,
  6 * 60 * 60_000,
] as const;

export function bucketSizeMs(
  rangeMs: number,
  targetPoints: number = CHART_TARGET_POINTS,
): number {
  if (rangeMs <= 0 || targetPoints <= 0) return BUCKET_LADDER_MS[0];
  const ideal = rangeMs / targetPoints;
  const chosen = BUCKET_LADDER_MS.find(size => size >= ideal);
  return chosen ?? BUCKET_LADDER_MS[BUCKET_LADDER_MS.length - 1];
}

/** Number of buckets a range will produce -- used to sanity check queries. */
export function bucketCount(rangeMs: number, sizeMs: number): number {
  if (sizeMs <= 0) return 0;
  return Math.ceil(rangeMs / sizeMs);
}

export type HistoryRange = '1H' | '6H' | '24H' | '7D';

export const RANGE_MS: Record<HistoryRange, number> = {
  '1H': 60 * 60_000,
  '6H': 6 * 60 * 60_000,
  '24H': 24 * 60 * 60_000,
  '7D': 7 * 24 * 60 * 60_000,
};

export const RANGE_ORDER: HistoryRange[] = ['1H', '6H', '24H', '7D'];

import {
  bucketCount,
  bucketSizeMs,
  CHART_TARGET_POINTS,
  RANGE_MS,
  RANGE_ORDER,
} from './buckets';

describe('chart bucketing', () => {
  it('keeps every offered range within a sane point count (§45)', () => {
    for (const range of RANGE_ORDER) {
      const rangeMs = RANGE_MS[range];
      const points = bucketCount(rangeMs, bucketSizeMs(rangeMs));
      // Enough resolution to be meaningful, few enough to render smoothly.
      expect(points).toBeGreaterThanOrEqual(60);
      expect(points).toBeLessThanOrEqual(CHART_TARGET_POINTS);
    }
  });

  it('never buckets finer than the fastest sampling interval', () => {
    expect(bucketSizeMs(60_000)).toBeGreaterThanOrEqual(10_000);
  });

  it('widens the bucket as the range grows', () => {
    const sizes = RANGE_ORDER.map(r => bucketSizeMs(RANGE_MS[r]));
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
    }
  });

  it('caps the bucket for absurdly long ranges instead of overflowing', () => {
    const tenYears = 10 * 365 * 24 * 60 * 60_000;
    expect(bucketSizeMs(tenYears)).toBe(6 * 60 * 60_000);
  });

  it('degrades safely on nonsense input', () => {
    expect(bucketSizeMs(0)).toBe(10_000);
    expect(bucketSizeMs(-1)).toBe(10_000);
    expect(bucketCount(60_000, 0)).toBe(0);
  });

  it('gives 7 days an hourly bucket and 1 hour a 30-second one', () => {
    expect(bucketSizeMs(RANGE_MS['7D'])).toBe(60 * 60_000);
    expect(bucketSizeMs(RANGE_MS['1H'])).toBe(30_000);
  });
});

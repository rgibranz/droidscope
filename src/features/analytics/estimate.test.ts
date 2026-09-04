import {
  averagePowerW,
  estimateTimeRemaining,
  estimateTimeToFull,
  formatDuration,
  MIN_WINDOW_MS,
  type AnalyticsSample,
} from './estimate';

const T0 = 1_788_500_000_000;
const MINUTE = 60_000;

function series(
  spec: Array<{
    minute: number;
    level: number;
    counter?: number | null;
    power?: number | null;
    charging?: boolean;
  }>,
): AnalyticsSample[] {
  return spec.map(s => ({
    timestamp: T0 + s.minute * MINUTE,
    levelPercent: s.level,
    chargeCounterMah: s.counter ?? null,
    powerW: s.power ?? null,
    isCharging: s.charging ?? false,
  }));
}

/** A steady discharge over `minutes`, losing `drop` percent. */
function steadyDischarge(minutes: number, from: number, drop: number) {
  const steps = Math.max(2, Math.floor(minutes / 5) + 1);
  return series(
    Array.from({ length: steps }, (_, i) => ({
      minute: (minutes / (steps - 1)) * i,
      level: from - (drop / (steps - 1)) * i,
    })),
  );
}

describe('time remaining', () => {
  it('refuses to estimate before there is enough history (§25)', () => {
    const result = estimateTimeRemaining(steadyDischarge(4, 80, 2));
    expect(result.kind).toBe('unavailable');
  });

  it('estimates from the battery percentage trend', () => {
    // 30 minutes, 80% -> 74% = 12 %/h; 74% left => ~6.2 h
    const result = estimateTimeRemaining(steadyDischarge(30, 80, 6));
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.percentPerHour).toBeCloseTo(12, 5);
    expect(result.hours).toBeCloseTo(74 / 12, 4);
    expect(result.basis).toBe('level');
  });

  it('says so rather than reporting infinite life when level has not moved (§48)', () => {
    const flat = series([
      { minute: 0, level: 80 },
      { minute: 15, level: 80 },
      { minute: 30, level: 80 },
    ]);
    const result = estimateTimeRemaining(flat);
    expect(result.kind).toBe('unavailable');
    if (result.kind !== 'unavailable') return;
    expect(result.reason).toMatch(/has not moved/);
  });

  it('prefers the charge counter when it is moving (§24)', () => {
    // 30 min, 3000 -> 2700 mAh = 600 mAh/h; 2700 left => 4.5 h
    const withCounter = series([
      { minute: 0, level: 80, counter: 3000 },
      { minute: 15, level: 79, counter: 2850 },
      { minute: 30, level: 78, counter: 2700 },
    ]);
    const result = estimateTimeRemaining(withCounter);
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.basis).toBe('chargeCounter');
    expect(result.hours).toBeCloseTo(4.5, 4);
  });

  it('falls back to level when the counter is a frozen constant', () => {
    // What an Infinix X6728 does: charge_full-style constant that never moves.
    const frozen = series([
      { minute: 0, level: 80, counter: 5000 },
      { minute: 15, level: 77, counter: 5000 },
      { minute: 30, level: 74, counter: 5000 },
    ]);
    const result = estimateTimeRemaining(frozen);
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.basis).toBe('level');
  });

  it('reports percent-per-hour as unknown when only the counter moved', () => {
    const counterOnly = series([
      { minute: 0, level: 80, counter: 3000 },
      { minute: 30, level: 80, counter: 2700 },
    ]);
    const result = estimateTimeRemaining(counterOnly);
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    // A rate in %/h cannot be derived without a full-charge capacity.
    expect(result.percentPerHour).toBeNull();
  });

  it('ignores samples from before the charger was unplugged', () => {
    const straddling = series([
      { minute: 0, level: 40, charging: true },
      { minute: 10, level: 60, charging: true },
      { minute: 12, level: 60 },
      { minute: 42, level: 54 },
    ]);
    const result = estimateTimeRemaining(straddling);
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    // 6% over 30 min, not a blend with the charging run.
    expect(result.percentPerHour).toBeCloseTo(12, 5);
  });

  it('grows more confident with a longer window (§31)', () => {
    const short = estimateTimeRemaining(steadyDischarge(6, 80, 2));
    const medium = estimateTimeRemaining(steadyDischarge(12, 80, 3));
    const long = estimateTimeRemaining(steadyDischarge(25, 80, 6));
    expect(short.kind === 'ready' && short.confidence).toBe('low');
    expect(medium.kind === 'ready' && medium.confidence).toBe('medium');
    expect(long.kind === 'ready' && long.confidence).toBe('high');
  });

  it('returns unavailable for an empty series rather than throwing', () => {
    expect(estimateTimeRemaining([]).kind).toBe('unavailable');
  });
});

describe('time to full', () => {
  it('estimates from the charging trend', () => {
    // 30 min, 40 -> 55% = 30 %/h; 45% to go => 1.5 h
    const charging = series([
      { minute: 0, level: 40, charging: true },
      { minute: 15, level: 47.5, charging: true },
      { minute: 30, level: 55, charging: true },
    ]);
    const result = estimateTimeToFull(charging);
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.hours).toBeCloseTo(1.5, 4);
  });

  it('never claims high confidence in the taper zone (§26)', () => {
    const nearFull = series([
      { minute: 0, level: 85, charging: true },
      { minute: 15, level: 88, charging: true },
      { minute: 30, level: 91, charging: true },
    ]);
    const result = estimateTimeToFull(nearFull);
    expect(result.kind === 'ready' && result.confidence).toBe('low');
  });

  it('says the battery is full instead of estimating zero', () => {
    const full = series([
      { minute: 0, level: 99, charging: true },
      { minute: 30, level: 100, charging: true },
    ]);
    const result = estimateTimeToFull(full);
    expect(result.kind).toBe('unavailable');
    if (result.kind !== 'unavailable') return;
    expect(result.reason).toMatch(/full/i);
  });

  it('does not estimate while discharging', () => {
    expect(estimateTimeToFull(steadyDischarge(30, 80, 6)).kind).toBe(
      'unavailable',
    );
  });
});

describe('rolling average power (§47)', () => {
  it('averages only inside the window', () => {
    const now = T0 + 60 * MINUTE;
    const samples = series([
      { minute: 0, level: 80, power: -10 }, // outside
      { minute: 59, level: 79, power: -2 },
      { minute: 60, level: 79, power: -4 },
    ]);
    expect(averagePowerW(samples, 5 * MINUTE, now)).toBeCloseTo(-3, 6);
  });

  it('is null when no sample in the window reported power', () => {
    const now = T0;
    expect(averagePowerW(series([{ minute: 0, level: 80 }]), MINUTE, now)).toBeNull();
  });
});

describe('duration formatting', () => {
  it('matches §7.1', () => {
    expect(formatDuration(5.7)).toBe('5h 42m');
    expect(formatDuration(0.5)).toBe('30m');
  });

  it('degrades safely', () => {
    expect(formatDuration(Infinity)).toBe('--');
    expect(formatDuration(-1)).toBe('--');
  });

  it('exposes the §25 threshold it enforces', () => {
    expect(MIN_WINDOW_MS).toBe(5 * MINUTE);
  });
});

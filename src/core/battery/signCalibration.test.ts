import {
  INITIAL_CALIBRATION,
  MIN_SIGNIFICANT_UA,
  normaliseCurrentUa,
  observeSign,
  REQUIRED_STREAK,
  type SignCalibration,
} from './signCalibration';

function feed(
  samples: Array<{
    currentUa: number | null;
    levelPercent?: number | null;
    status: 'charging' | 'discharging' | 'full';
  }>,
  from: SignCalibration = INITIAL_CALIBRATION,
): SignCalibration {
  return samples.reduce(
    (state, s) => observeSign(state, { levelPercent: 60, ...s }),
    from,
  );
}

const charging = (currentUa: number) =>
  ({ currentUa, levelPercent: 60, status: 'charging' as const });
const discharging = (currentUa: number) =>
  ({ currentUa, levelPercent: 60, status: 'discharging' as const });

describe('sign calibration', () => {
  it('does not lock on a single sample (§11)', () => {
    const state = observeSign(INITIAL_CALIBRATION, charging(244000));
    expect(state.convention).toBe('unknown');
    expect(state.streak).toBe(1);
  });

  it('still unknown one sample short of the threshold', () => {
    const state = feed(Array(REQUIRED_STREAK - 1).fill(charging(244000)));
    expect(state.convention).toBe('unknown');
    expect(state.streak).toBe(REQUIRED_STREAK - 1);
  });

  it('locks to normal after enough agreeing samples', () => {
    const state = feed(Array(REQUIRED_STREAK).fill(charging(244000)));
    expect(state.convention).toBe('normal');
  });

  it('locks to reversed when charging reports negative current', () => {
    const state = feed(Array(REQUIRED_STREAK).fill(charging(-244000)));
    expect(state.convention).toBe('reversed');
  });

  it('resets the streak when a sample disagrees', () => {
    const state = feed([
      ...Array(REQUIRED_STREAK - 1).fill(charging(244000)),
      charging(-244000),
    ]);
    expect(state.convention).toBe('unknown');
    expect(state.streak).toBe(1);
    expect(state.suggests).toBe('reversed');
  });

  it('ignores near-zero current instead of counting it', () => {
    const state = feed([charging(MIN_SIGNIFICANT_UA - 1)]);
    expect(state.streak).toBe(0);
    expect(state.suggests).toBeNull();
  });

  it('ignores samples with no current reading', () => {
    const state = feed([{ currentUa: null, status: 'charging' }]);
    expect(state).toEqual(INITIAL_CALIBRATION);
  });

  it('ignores samples taken near a full battery', () => {
    // Real behaviour on an INFINIX X6728: at 100% Android still says
    // "charging" while current is negative. Calibrating from this would lock
    // the device to "reversed" permanently.
    const state = feed(
      Array(REQUIRED_STREAK).fill({
        currentUa: -48800,
        levelPercent: 100,
        status: 'charging' as const,
      }),
    );
    expect(state.convention).toBe('unknown');
    expect(state.streak).toBe(0);
  });

  it('ignores samples with no level reading', () => {
    const state = feed([
      { currentUa: 244000, levelPercent: null, status: 'charging' },
    ]);
    expect(state.streak).toBe(0);
  });

  it('ignores ambiguous statuses such as full', () => {
    const state = feed([{ currentUa: 244000, status: 'full' }]);
    expect(state.streak).toBe(0);
  });

  it('does not skip a qualifying sample that follows an ignored one', () => {
    const state = feed([charging(0), charging(244000)]);
    expect(state.streak).toBe(1);
  });

  it('stays locked once calibrated', () => {
    const locked = feed(Array(REQUIRED_STREAK).fill(charging(244000)));
    const after = feed(Array(REQUIRED_STREAK).fill(charging(-244000)), locked);
    expect(after.convention).toBe('normal');
  });

  it('handles a genuinely reversed device consistently on discharge', () => {
    const state = feed(Array(REQUIRED_STREAK).fill(discharging(500000)));
    expect(state.convention).toBe('reversed');
  });
});

describe('applying the calibration', () => {
  it('leaves values alone under the normal convention', () => {
    expect(normaliseCurrentUa(-727000, 'normal', 'discharging')).toBe(-727000);
  });

  it('flips values under the reversed convention', () => {
    expect(normaliseCurrentUa(727000, 'reversed', 'discharging')).toBe(-727000);
  });

  it('falls back to Android status while still uncalibrated', () => {
    expect(normaliseCurrentUa(727000, 'unknown', 'discharging')).toBe(-727000);
    expect(normaliseCurrentUa(-244000, 'unknown', 'charging')).toBe(244000);
  });

  it('leaves ambiguous statuses untouched while uncalibrated', () => {
    expect(normaliseCurrentUa(-5000, 'unknown', 'full')).toBe(-5000);
  });

  it('propagates a missing reading', () => {
    expect(normaliseCurrentUa(null, 'normal', 'discharging')).toBeNull();
  });
});

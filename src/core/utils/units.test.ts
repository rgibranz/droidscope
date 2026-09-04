import {
  computePowerW,
  deciCToCelsius,
  formatCelsius,
  formatMilliamps,
  formatVolts,
  formatWatts,
  mvToVolts,
  uahToMah,
  uaToMilliamps,
  UNAVAILABLE,
} from './units';

describe('unit conversion', () => {
  it('converts millivolts to volts (§44)', () => {
    expect(mvToVolts(4313)).toBeCloseTo(4.313, 6);
  });

  it('converts microamps to milliamps (§44)', () => {
    expect(uaToMilliamps(-727000)).toBe(-727);
  });

  it('converts deci-celsius to celsius (§53)', () => {
    expect(deciCToCelsius(350)).toBe(35);
  });

  it('converts microamp-hours to milliamp-hours (§17)', () => {
    expect(uahToMah(3912000)).toBe(3912);
  });

  it('propagates null instead of substituting zero', () => {
    expect(mvToVolts(null)).toBeNull();
    expect(uaToMilliamps(null)).toBeNull();
    expect(deciCToCelsius(null)).toBeNull();
    expect(uahToMah(null)).toBeNull();
  });

  it('treats zero as a real reading, not a missing one', () => {
    expect(uaToMilliamps(0)).toBe(0);
    expect(deciCToCelsius(0)).toBe(0);
  });
});

describe('power calculation', () => {
  it('matches the worked example in §53', () => {
    // 4.313 V x -0.727 A = -3.1356 W
    expect(computePowerW(4313, -727000)).toBeCloseTo(-3.1356, 4);
  });

  it('is positive while charging', () => {
    expect(computePowerW(4396, 244000)).toBeCloseTo(1.0726, 4);
  });

  it('refuses to guess when current is unavailable', () => {
    expect(computePowerW(4313, null)).toBeNull();
  });

  it('refuses to guess when voltage is unavailable', () => {
    expect(computePowerW(null, -727000)).toBeNull();
  });
});

describe('display formatting', () => {
  it('rounds power to two decimals (§44)', () => {
    expect(formatWatts(-3.136)).toBe('-3.14');
  });

  it('signs charging values explicitly so colour is not the only cue', () => {
    expect(formatWatts(1.0726)).toBe('+1.07');
    expect(formatMilliamps(244)).toBe('+244');
  });

  it('keeps three decimals for voltage', () => {
    expect(formatVolts(4.313)).toBe('4.313');
  });

  it('keeps one decimal for temperature', () => {
    expect(formatCelsius(29)).toBe('29.0');
  });

  it('renders missing values as unavailable rather than zero', () => {
    expect(formatWatts(null)).toBe(UNAVAILABLE);
    expect(formatVolts(null)).toBe(UNAVAILABLE);
    expect(formatMilliamps(null)).toBe(UNAVAILABLE);
    expect(formatCelsius(null)).toBe(UNAVAILABLE);
  });
});

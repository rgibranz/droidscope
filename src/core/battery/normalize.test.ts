import type { NativeSnapshot } from '../native/NativeBatteryTelemetry';
import { toReading } from './normalize';

const base: NativeSnapshot = {
  timestamp: 1_788_503_940_000,
  levelPercent: 97,
  voltageMv: 4396,
  currentUa: 244000,
  currentAvgUa: 66700,
  temperatureDeciC: 290,
  chargeCounterUah: 4850000,
  energyCounterNwh: null,
  cycleCount: 351,
  healthCode: 2,
  statusCode: 2, // charging
  pluggedCode: 2, // usb
  technology: 'Li-ion',
  present: true,
};

describe('snapshot normalisation', () => {
  it('maps a real Infinix X6728 charging snapshot', () => {
    const reading = toReading(base, 'normal');
    expect(reading.levelPercent).toBe(97);
    expect(reading.voltageV).toBeCloseTo(4.396, 3);
    expect(reading.currentMa).toBe(244);
    expect(reading.powerW).toBeCloseTo(1.0726, 4);
    expect(reading.temperatureC).toBe(29);
    expect(reading.chargeCounterMah).toBe(4850);
    expect(reading.cycleCount).toBe(351);
    expect(reading.status).toBe('charging');
    expect(reading.plug).toBe('usb');
    expect(reading.health).toBe('good');
    expect(reading.isCharging).toBe(true);
  });

  it('leaves power null when the device does not report current', () => {
    const reading = toReading({ ...base, currentUa: null }, 'normal');
    expect(reading.currentMa).toBeNull();
    expect(reading.powerW).toBeNull();
  });

  it('rejects an implausible voltage instead of displaying it', () => {
    const reading = toReading({ ...base, voltageMv: 0 }, 'normal');
    expect(reading.voltageV).toBeNull();
    expect(reading.powerW).toBeNull();
  });

  it('rejects an implausible temperature', () => {
    const reading = toReading({ ...base, temperatureDeciC: 1200 }, 'normal');
    expect(reading.temperatureC).toBeNull();
  });

  it('accepts a current of exactly zero', () => {
    const reading = toReading({ ...base, currentUa: 0 }, 'normal');
    expect(reading.currentMa).toBe(0);
    expect(reading.powerW).toBe(0);
  });

  it('flips current on a device with the reversed convention', () => {
    const reading = toReading(base, 'reversed');
    expect(reading.currentMa).toBe(-244);
    expect(reading.powerW).toBeLessThan(0);
  });

  it('treats full as charging for hero state but keeps the status distinct', () => {
    const reading = toReading({ ...base, statusCode: 5 }, 'normal');
    expect(reading.status).toBe('full');
    expect(reading.isCharging).toBe(true);
  });

  it('survives a snapshot where every optional metric is missing', () => {
    const reading = toReading(
      {
        ...base,
        levelPercent: null,
        voltageMv: null,
        currentUa: null,
        temperatureDeciC: null,
        chargeCounterUah: null,
        cycleCount: null,
        healthCode: null,
        statusCode: null,
        pluggedCode: null,
        technology: null,
      },
      'unknown',
    );
    expect(reading.status).toBe('unknown');
    expect(reading.plug).toBe('unknown');
    expect(reading.health).toBe('unknown');
    expect(reading.powerW).toBeNull();
    expect(reading.isCharging).toBe(false);
  });
});

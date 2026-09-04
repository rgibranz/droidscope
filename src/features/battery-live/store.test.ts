jest.mock('../../core/native/NativeBatteryTelemetry');

jest.mock('../../data/history/historyRepository', () => ({
  insertSample: jest.fn(),
  purgeOlderThan: jest.fn(),
}));

// MMKV is a native module; an in-memory map is enough to exercise persistence.
jest.mock('react-native-mmkv', () => {
  const map = new Map<string, string>();
  return {
    __map: map,
    createMMKV: () => ({
      getString: (k: string) => map.get(k),
      set: (k: string, v: string) => {
        map.set(k, v);
      },
      remove: (k: string) => map.delete(k),
    }),
  };
});

import { REQUIRED_STREAK } from '../../core/battery/signCalibration';
import { useBatteryStore } from './store';

// Importing the __mocks__ file by path would load a *second* module instance
// with its own listener; requireMock returns the one the store is wired to.
const { __emit, __reset, emptySnapshot } = jest.requireMock(
  '../../core/native/NativeBatteryTelemetry',
) as typeof import('../../core/native/__mocks__/NativeBatteryTelemetry');

const history = jest.requireMock('../../data/history/historyRepository') as {
  insertSample: jest.Mock;
  purgeOlderThan: jest.Mock;
};

const initialState = useBatteryStore.getState();

beforeEach(() => {
  __reset();
  useBatteryStore.setState(initialState, true);
  (require('react-native-mmkv') as { __map: Map<string, string> }).__map.clear();
  history.insertSample.mockClear();
  history.purgeOlderThan.mockClear();
});

describe('battery store', () => {
  it('reaches ready on a device that reports almost nothing', async () => {
    await useBatteryStore.getState().start();
    const state = useBatteryStore.getState();

    expect(state.status).toBe('ready');
    expect(state.reading).not.toBeNull();
    // §62: missing metrics must be absent, not zero.
    expect(state.reading?.voltageV).toBeNull();
    expect(state.reading?.currentMa).toBeNull();
    expect(state.reading?.powerW).toBeNull();
    expect(state.reading?.levelPercent).toBe(82);
  });

  it('updates the reading when native emits telemetry', async () => {
    await useBatteryStore.getState().start();

    __emit({ ...emptySnapshot, levelPercent: 81, voltageMv: 4100, currentUa: -682000 });

    const reading = useBatteryStore.getState().reading;
    expect(reading?.levelPercent).toBe(81);
    expect(reading?.currentMa).toBe(-682);
    expect(reading?.powerW).toBeCloseTo(-2.7962, 4);
  });

  it('locks and persists the sign convention after a consistent run', async () => {
    await useBatteryStore.getState().start();

    for (let i = 0; i < REQUIRED_STREAK; i++) {
      __emit({
        ...emptySnapshot,
        statusCode: 2, // charging
        currentUa: 244000,
        voltageMv: 4396,
      });
    }

    expect(useBatteryStore.getState().calibration.convention).toBe('normal');

    const stored = (require('react-native-mmkv') as { __map: Map<string, string> })
      .__map;
    expect(stored.get('sign.Mock Device')).toBe('normal');
  });

  it('persists the first reading and purges on startup', async () => {
    await useBatteryStore.getState().start();

    expect(history.purgeOlderThan).toHaveBeenCalledTimes(1);
    expect(history.insertSample).toHaveBeenCalledTimes(1);
  });

  it('throttles writes so a burst of broadcasts does not inflate the database', async () => {
    await useBatteryStore.getState().start();
    history.insertSample.mockClear();

    const base = emptySnapshot.timestamp;
    // Three broadcasts one second apart -- what plugging a cable in looks like.
    __emit({ ...emptySnapshot, timestamp: base + 1000 });
    __emit({ ...emptySnapshot, timestamp: base + 2000 });
    __emit({ ...emptySnapshot, timestamp: base + 3000 });
    expect(history.insertSample).not.toHaveBeenCalled();

    // Past the sampling interval, writing resumes.
    __emit({ ...emptySnapshot, timestamp: base + 11_000 });
    expect(history.insertSample).toHaveBeenCalledTimes(1);
  });

  it('keeps live telemetry working when storage fails', async () => {
    history.insertSample.mockImplementationOnce(() => {
      throw new Error('disk full');
    });

    await useBatteryStore.getState().start();

    const state = useBatteryStore.getState();
    expect(state.status).toBe('ready');
    expect(state.reading).not.toBeNull();
    expect(state.historyError).toBe('disk full');
  });

  it('forgets the stored convention when reset', async () => {
    await useBatteryStore.getState().start();
    for (let i = 0; i < REQUIRED_STREAK; i++) {
      __emit({ ...emptySnapshot, statusCode: 2, currentUa: 244000 });
    }

    useBatteryStore.getState().resetCalibration();

    expect(useBatteryStore.getState().calibration.convention).toBe('unknown');
    const stored = (require('react-native-mmkv') as { __map: Map<string, string> })
      .__map;
    expect(stored.has('sign.Mock Device')).toBe(false);
  });
});

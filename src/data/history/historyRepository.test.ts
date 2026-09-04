jest.mock('react-native-nitro-sqlite', () => ({ open: jest.fn() }));

import type { BatteryReading } from '../models/battery';
import {
  __setConnection,
  insertSample,
  purgeOlderThan,
  queryHistory,
} from './historyRepository';

type Call = { query: string; params: unknown[] };

function fakeConnection(rows: Record<string, unknown>[] = [], rowsAffected = 0) {
  const calls: Call[] = [];
  const connection = {
    execute: (query: string, params: unknown[] = []) => {
      calls.push({ query, params });
      return {
        rowsAffected,
        rows: {
          _array: rows,
          length: rows.length,
          item: (i: number) => rows[i],
        },
      };
    },
  };
  // The repository only ever uses `execute`; the rest of the connection surface
  // is irrelevant to these tests.
  __setConnection(connection as never);
  return calls;
}

afterEach(() => __setConnection(null));

const reading: BatteryReading = {
  timestamp: 1_788_503_940_000,
  levelPercent: 82,
  voltageV: 4.112,
  currentMa: -682,
  powerW: -2.804,
  temperatureC: 34.8,
  chargeCounterMah: 3912,
  cycleCount: 351,
  status: 'discharging',
  plug: 'none',
  health: 'good',
  isCharging: false,
  technology: 'Li-ion',
};

describe('inserting samples', () => {
  it('stores platform units, not display units', () => {
    const calls = fakeConnection();
    insertSample(reading);

    const [, params] = [calls[0].query, calls[0].params];
    expect(params[1]).toBe(82); // level
    expect(params[2]).toBeCloseTo(4112, 6); // volts back to millivolts
    expect(params[3]).toBeCloseTo(-682000, 6); // milliamps back to microamps
    expect(params[4]).toBeCloseTo(-2.804, 6); // watts stay watts
  });

  it('writes NULL for metrics the device does not report', () => {
    const calls = fakeConnection();
    insertSample({ ...reading, currentMa: null, powerW: null });

    expect(calls[0].params[3]).toBeNull();
    expect(calls[0].params[4]).toBeNull();
  });

  it('records screen state as unknown rather than inventing "off"', () => {
    const calls = fakeConnection();
    insertSample(reading);
    expect(calls[0].params[10]).toBeNull();
  });

  it('skips a reading with no battery level at all', () => {
    const calls = fakeConnection();
    insertSample({ ...reading, levelPercent: null });
    expect(calls).toHaveLength(0);
  });
});

describe('querying history', () => {
  it('aggregates in SQL rather than fetching raw rows (§45)', () => {
    const calls = fakeConnection([]);
    queryHistory(0, 60 * 60_000);

    expect(calls[0].query).toContain('GROUP BY bucket_start');
    expect(calls[0].query).toContain('AVG(power_w)');
    // 1 hour -> 30s buckets
    expect(calls[0].params[0]).toBe(30_000);
  });

  it('converts stored microamps back to milliamps', () => {
    fakeConnection([
      {
        bucket_start: 1000,
        level_percent: 80,
        power_w: -2.5,
        current_ua: -682000,
        temperature_c: 34.8,
        sample_count: 3,
      },
    ]);

    const [point] = queryHistory(0, 60 * 60_000);
    expect(point.currentMa).toBe(-682);
    expect(point.sampleCount).toBe(3);
  });

  it('keeps an empty bucket column as null instead of zero', () => {
    fakeConnection([
      {
        bucket_start: 1000,
        level_percent: 80,
        power_w: null,
        current_ua: null,
        temperature_c: null,
        sample_count: 2,
      },
    ]);

    const [point] = queryHistory(0, 60 * 60_000);
    expect(point.powerW).toBeNull();
    expect(point.currentMa).toBeNull();
    expect(point.temperatureC).toBeNull();
  });
});

describe('retention', () => {
  it('reports how many rows were purged (§22)', () => {
    fakeConnection([], 128);
    expect(purgeOlderThan(1000)).toBe(128);
  });
});

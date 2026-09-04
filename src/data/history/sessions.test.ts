jest.mock('@op-engineering/op-sqlite', () => ({ open: jest.fn() }));

import { querySessions, SESSION_GAP_MS, toSession } from './sessions';

const T0 = 1_788_500_000_000;

const row = {
  session_id: 3,
  is_charging: 1,
  start_time: T0,
  end_time: T0 + 48 * 60_000, // 48 minutes
  start_level: 21,
  end_level: 86,
  avg_power: 14.2,
  peak_power: 22.4,
  avg_current_ua: 3_200_000,
  min_temp: 31.5,
  max_temp: 39.1,
  sample_count: 288,
};

function connectionReturning(rows: unknown[]) {
  const calls: Array<{ query: string; params: unknown[] }> = [];
  const connection = {
    executeSync: (query: string, params: unknown[] = []) => {
      calls.push({ query, params });
      return { rowsAffected: 0, rows };
    },
  } as never;
  return { connection, calls };
}

describe('session mapping', () => {
  it('converts stored units and derives energy', () => {
    const session = toSession(row);
    expect(session.isCharging).toBe(true);
    expect(session.startPercent).toBe(21);
    expect(session.endPercent).toBe(86);
    expect(session.averageCurrentMa).toBe(3200);
    expect(session.peakTemperatureC).toBe(39.1);
    // 14.2 W over 0.8 h = 11.36 Wh
    expect(session.energyAddedWh).toBeCloseTo(11.36, 4);
  });

  it('leaves energy null when no power was ever recorded', () => {
    const session = toSession({ ...row, avg_power: null });
    expect(session.energyAddedWh).toBeNull();
    expect(session.averagePowerW).toBeNull();
  });

  it('keeps energy positive for a discharging session', () => {
    const session = toSession({ ...row, is_charging: 0, avg_power: -2.5 });
    expect(session.isCharging).toBe(false);
    expect(session.energyAddedWh).toBeGreaterThan(0);
  });

  it('preserves a missing temperature rather than reporting zero', () => {
    const session = toSession({ ...row, min_temp: null, max_temp: null });
    expect(session.startTemperatureC).toBeNull();
    expect(session.peakTemperatureC).toBeNull();
  });
});

describe('session query', () => {
  it('sessionises in SQL and passes the gap threshold', () => {
    const { connection, calls } = connectionReturning([]);
    querySessions(connection, T0);

    expect(calls[0].query).toContain('OVER (ORDER BY timestamp)');
    expect(calls[0].query).toContain('GROUP BY session_id');
    expect(calls[0].params[0]).toBe(SESSION_GAP_MS);
  });

  it('discards single-sample runs as noise', () => {
    const { connection } = connectionReturning([
      { ...row, session_id: 1, sample_count: 1 },
      { ...row, session_id: 2, sample_count: 2 },
    ]);
    const sessions = querySessions(connection, T0);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe(2);
  });
});

import type { DB } from '@op-engineering/op-sqlite';

/**
 * Sessions (§27, §28) are *derived* from the samples table rather than tracked
 * in a second table with its own state machine.
 *
 * Two reasons: a tracked session can be left hanging open when the process is
 * killed, and a derived one cannot; and retention then applies to sessions for
 * free, because they only exist as long as the samples behind them do.
 */

export interface Session {
  id: number;
  isCharging: boolean;
  startTime: number;
  endTime: number;
  startPercent: number | null;
  endPercent: number | null;
  averagePowerW: number | null;
  peakPowerW: number | null;
  averageCurrentMa: number | null;
  startTemperatureC: number | null;
  peakTemperatureC: number | null;
  /** Estimated from average power over the elapsed time, not measured. */
  energyAddedWh: number | null;
  sampleCount: number;
}

/**
 * Sampling stops when the app is closed (background monitoring is a later
 * phase), so a long silence is not evidence that charging continued. A gap
 * wider than this splits the run rather than papering over the missing time.
 */
export const SESSION_GAP_MS = 5 * 60_000;

/** A one-sample run is noise, not a session. */
const MIN_SESSION_SAMPLES = 2;

type SessionRow = {
  session_id: number;
  is_charging: number;
  start_time: number;
  end_time: number;
  start_level: number | null;
  end_level: number | null;
  avg_power: number | null;
  peak_power: number | null;
  avg_current_ua: number | null;
  min_temp: number | null;
  max_temp: number | null;
  sample_count: number;
};

/**
 * A window function walks the samples once, marking a boundary wherever the
 * charge state flips or a gap appears, then a running sum turns those into
 * group ids. This keeps sessionisation in SQLite instead of pulling tens of
 * thousands of rows into JS.
 */
const SESSION_QUERY = `
  WITH marked AS (
    SELECT
      timestamp, level_percent, power_w, current_ua, temperature_c, is_charging,
      CASE
        WHEN is_charging != LAG(is_charging, 1, -1) OVER (ORDER BY timestamp)
          OR timestamp - LAG(timestamp, 1, 0) OVER (ORDER BY timestamp) > ?
        THEN 1 ELSE 0
      END AS is_boundary
    FROM samples
    WHERE timestamp >= ?
  ),
  grouped AS (
    SELECT *, SUM(is_boundary) OVER (ORDER BY timestamp) AS session_id
    FROM marked
  ),
  edged AS (
    SELECT *,
      FIRST_VALUE(level_percent) OVER (
        PARTITION BY session_id ORDER BY timestamp
      ) AS start_level,
      LAST_VALUE(level_percent) OVER (
        PARTITION BY session_id ORDER BY timestamp
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
      ) AS end_level
    FROM grouped
  )
  SELECT
    session_id,
    is_charging,
    MIN(timestamp)      AS start_time,
    MAX(timestamp)      AS end_time,
    start_level,
    end_level,
    AVG(power_w)        AS avg_power,
    MAX(power_w)        AS peak_power,
    AVG(current_ua)     AS avg_current_ua,
    MIN(temperature_c)  AS min_temp,
    MAX(temperature_c)  AS max_temp,
    COUNT(*)            AS sample_count
  FROM edged
  GROUP BY session_id
  ORDER BY start_time DESC
  LIMIT ?
`;

export function querySessions(
  db: DB,
  since: number,
  limit = 100,
): Session[] {
  const rows = db.executeSync(SESSION_QUERY, [
    SESSION_GAP_MS,
    since,
    limit,
  ]);
  return (rows.rows as unknown as SessionRow[])
    .filter(row => Number(row.sample_count) >= MIN_SESSION_SAMPLES)
    .map(toSession);
}

export function toSession(row: SessionRow): Session {
  const startTime = Number(row.start_time);
  const endTime = Number(row.end_time);
  const averagePowerW = nullable(row.avg_power);
  const hours = (endTime - startTime) / 3_600_000;

  return {
    id: Number(row.session_id),
    isCharging: Number(row.is_charging) === 1,
    startTime,
    endTime,
    startPercent: nullable(row.start_level),
    endPercent: nullable(row.end_level),
    averagePowerW,
    peakPowerW: nullable(row.peak_power),
    averageCurrentMa:
      row.avg_current_ua === null ? null : Number(row.avg_current_ua) / 1000,
    startTemperatureC: nullable(row.min_temp),
    peakTemperatureC: nullable(row.max_temp),
    // Calculated, not measured: average power over elapsed time.
    energyAddedWh:
      averagePowerW === null ? null : Math.abs(averagePowerW) * hours,
    sampleCount: Number(row.sample_count),
  };
}

function nullable(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

import { open, type NitroSQLiteConnection } from 'react-native-nitro-sqlite';
import type { BatteryReading } from '../models/battery';
import type { AnalyticsSample } from '../../features/analytics/estimate';
import { bucketSizeMs } from './buckets';
import { querySessions, type Session } from './sessions';
import type { ExportRow } from '../../features/export/csv';
import {
  DATABASE_NAME,
  MIGRATIONS,
  type HistoryPoint,
  type HistorySummary,
} from './schema';

let connection: NitroSQLiteConnection | null = null;

function db(): NitroSQLiteConnection {
  if (connection) return connection;
  connection = open({ name: DATABASE_NAME });
  for (const migration of MIGRATIONS) {
    connection.execute(migration);
  }
  return connection;
}

/** Test seam: lets a suite inject a fake connection. */
export function __setConnection(fake: NitroSQLiteConnection | null): void {
  connection = fake;
}

export function insertSample(reading: BatteryReading): void {
  // A reading with no level at all carries nothing worth plotting.
  if (reading.levelPercent === null) return;

  db().execute(
    `INSERT INTO samples (
       timestamp, level_percent, voltage_mv, current_ua, power_w,
       temperature_c, charge_counter_uah, is_charging, charge_status,
       plug_type, screen_on
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reading.timestamp,
      reading.levelPercent,
      reading.voltageV === null ? null : reading.voltageV * 1000,
      reading.currentMa === null ? null : reading.currentMa * 1000,
      reading.powerW,
      reading.temperatureC,
      reading.chargeCounterMah === null ? null : reading.chargeCounterMah * 1000,
      reading.isCharging ? 1 : 0,
      reading.status,
      reading.plug,
      null, // screen state not tracked yet (§29)
    ],
  );
}

type BucketRow = {
  bucket_start: number;
  level_percent: number | null;
  power_w: number | null;
  current_ua: number | null;
  temperature_c: number | null;
  sample_count: number;
};

/**
 * Aggregates in SQL rather than fetching raw rows: §45 forbids handing tens of
 * thousands of points to the UI, and doing the averaging in the query keeps the
 * transfer proportional to what is actually drawn.
 */
export function queryHistory(from: number, to: number): HistoryPoint[] {
  const bucket = bucketSizeMs(to - from);
  const result = db().execute<BucketRow>(
    `SELECT
       (timestamp / ?) * ? AS bucket_start,
       AVG(level_percent)  AS level_percent,
       AVG(power_w)        AS power_w,
       AVG(current_ua)     AS current_ua,
       AVG(temperature_c)  AS temperature_c,
       COUNT(*)            AS sample_count
     FROM samples
     WHERE timestamp >= ? AND timestamp <= ?
     GROUP BY bucket_start
     ORDER BY bucket_start ASC`,
    [bucket, bucket, from, to],
  );

  return result.rows._array.map(row => ({
    timestamp: Number(row.bucket_start),
    levelPercent: nullableNumber(row.level_percent),
    powerW: nullableNumber(row.power_w),
    currentMa:
      row.current_ua === null ? null : Number(row.current_ua) / 1000,
    temperatureC: nullableNumber(row.temperature_c),
    sampleCount: Number(row.sample_count),
  }));
}

type SummaryRow = {
  count: number;
  from_ts: number | null;
  to_ts: number | null;
  avg_power: number | null;
  min_power: number | null;
  max_power: number | null;
};

/**
 * §45 requires key numbers to exist outside the graph, so a screen reader user
 * -- or anyone who does not want to scrub a chart -- still gets them.
 */
export function querySummary(from: number, to: number): HistorySummary {
  const stats = db().execute<SummaryRow>(
    `SELECT
       COUNT(*)        AS count,
       MIN(timestamp)  AS from_ts,
       MAX(timestamp)  AS to_ts,
       AVG(power_w)    AS avg_power,
       MIN(power_w)    AS min_power,
       MAX(power_w)    AS max_power
     FROM samples
     WHERE timestamp >= ? AND timestamp <= ?`,
    [from, to],
  );
  const row = stats.rows.item(0);

  const edges = db().execute<{ level_percent: number | null; timestamp: number }>(
    `SELECT level_percent, timestamp FROM samples
     WHERE timestamp >= ? AND timestamp <= ? AND level_percent IS NOT NULL
     ORDER BY timestamp ASC`,
    [from, to],
  );
  const levels = edges.rows._array;

  return {
    count: row ? Number(row.count) : 0,
    from: row?.from_ts === null || row === undefined ? null : Number(row.from_ts),
    to: row?.to_ts === null || row === undefined ? null : Number(row.to_ts),
    averagePowerW: nullableNumber(row?.avg_power ?? null),
    minPowerW: nullableNumber(row?.min_power ?? null),
    maxPowerW: nullableNumber(row?.max_power ?? null),
    levelStart: levels.length ? nullableNumber(levels[0].level_percent) : null,
    levelEnd: levels.length
      ? nullableNumber(levels[levels.length - 1].level_percent)
      : null,
  };
}

/** §22: old samples are purged rather than kept forever. */
export function purgeOlderThan(cutoff: number): number {
  const result = db().execute(`DELETE FROM samples WHERE timestamp < ?`, [
    cutoff,
  ]);
  return result.rowsAffected ?? 0;
}

type AnalyticsRow = {
  timestamp: number;
  level_percent: number | null;
  charge_counter_uah: number | null;
  power_w: number | null;
  is_charging: number;
};

/**
 * Raw (un-bucketed) samples for the analytics layer. §24 works on a 10-30
 * minute window, which is a few hundred rows -- small enough to hand to JS,
 * unlike a chart range.
 */
export function queryAnalyticsSamples(
  from: number,
  to: number,
): AnalyticsSample[] {
  const result = db().execute<AnalyticsRow>(
    `SELECT timestamp, level_percent, charge_counter_uah, power_w, is_charging
     FROM samples
     WHERE timestamp >= ? AND timestamp <= ? AND level_percent IS NOT NULL
     ORDER BY timestamp ASC`,
    [from, to],
  );

  return result.rows._array.map(row => ({
    timestamp: Number(row.timestamp),
    levelPercent: Number(row.level_percent),
    chargeCounterMah:
      row.charge_counter_uah === null
        ? null
        : Number(row.charge_counter_uah) / 1000,
    powerW: nullableNumber(row.power_w),
    isCharging: Number(row.is_charging) === 1,
  }));
}

type ExportQueryRow = {
  timestamp: number;
  level_percent: number | null;
  voltage_mv: number | null;
  current_ua: number | null;
  power_w: number | null;
  temperature_c: number | null;
  charge_status: string;
};

/** Every stored column, in chronological order, for CSV export (§32). */
export function queryForExport(from: number, to: number): ExportRow[] {
  const result = db().execute<ExportQueryRow>(
    `SELECT timestamp, level_percent, voltage_mv, current_ua, power_w,
            temperature_c, charge_status
     FROM samples
     WHERE timestamp >= ? AND timestamp <= ?
     ORDER BY timestamp ASC`,
    [from, to],
  );

  return result.rows._array.map(row => ({
    timestamp: Number(row.timestamp),
    levelPercent: nullableNumber(row.level_percent),
    voltageMv: nullableNumber(row.voltage_mv),
    currentMa:
      row.current_ua === null ? null : Number(row.current_ua) / 1000,
    powerW: nullableNumber(row.power_w),
    temperatureC: nullableNumber(row.temperature_c),
    status: String(row.charge_status),
  }));
}

export function getSessions(since: number, limit = 100): Session[] {
  return querySessions(db(), since, limit);
}

export function countSamples(): number {
  const result = db().execute<{ count: number }>(
    `SELECT COUNT(*) AS count FROM samples`,
  );
  return Number(result.rows.item(0)?.count ?? 0);
}

export function clearHistory(): void {
  db().execute(`DELETE FROM samples`);
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

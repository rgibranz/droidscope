/**
 * Time-series storage for battery samples (§21). Raw values only -- analytics
 * stay in TypeScript so they remain testable.
 */

export const DATABASE_NAME = 'batteryscope.sqlite';

/**
 * `screen_on` is nullable rather than defaulted to 0: screen-state tracking
 * (§29) is not implemented yet, and recording "screen was off" for every sample
 * would be a fabricated value. NULL correctly means "not known".
 */
export const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS samples (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     timestamp INTEGER NOT NULL,
     level_percent REAL,
     voltage_mv REAL,
     current_ua REAL,
     power_w REAL,
     temperature_c REAL,
     charge_counter_uah REAL,
     is_charging INTEGER NOT NULL,
     charge_status TEXT NOT NULL,
     plug_type TEXT NOT NULL,
     screen_on INTEGER
   );`,
  `CREATE INDEX IF NOT EXISTS idx_samples_timestamp ON samples (timestamp);`,
];

export interface HistoryPoint {
  /** Start of the bucket, in epoch milliseconds. */
  timestamp: number;
  levelPercent: number | null;
  powerW: number | null;
  currentMa: number | null;
  temperatureC: number | null;
  sampleCount: number;
}

export interface HistorySummary {
  count: number;
  from: number | null;
  to: number | null;
  averagePowerW: number | null;
  minPowerW: number | null;
  maxPowerW: number | null;
  levelStart: number | null;
  levelEnd: number | null;
}

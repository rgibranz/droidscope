import type { AnalyticsSample } from '../analytics/estimate';

/**
 * CSV export (§32). Pure string building so the format is testable without a
 * device or a file system.
 */

export interface ExportRow {
  timestamp: number;
  levelPercent: number | null;
  voltageMv: number | null;
  currentMa: number | null;
  powerW: number | null;
  temperatureC: number | null;
  status: string;
}

const HEADER =
  'timestamp,level_percent,voltage_mv,current_ma,power_w,temp_c,status';

export function buildCsv(rows: ExportRow[]): string {
  const lines = [HEADER];
  for (const row of rows) {
    lines.push(
      [
        toIsoLocal(row.timestamp),
        num(row.levelPercent, 0),
        num(row.voltageMv, 0),
        num(row.currentMa, 0),
        num(row.powerW, 2),
        num(row.temperatureC, 1),
        escape(row.status),
      ].join(','),
    );
  }
  return lines.join('\n');
}

/**
 * An unsupported metric is an empty field, not a zero. A reader importing this
 * must be able to tell "no reading" from "a reading of zero" -- the same
 * distinction §9 makes in the data model.
 */
function num(value: number | null, decimals: number): string {
  if (value === null || !Number.isFinite(value)) return '';
  return value.toFixed(decimals);
}

function escape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Local time without a timezone suffix, matching §32's example. */
export function toIsoLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

export function exportFileName(now: number = Date.now()): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `batteryscope-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}.csv`
  );
}

/** Adapts the analytics row shape, which the repository already returns. */
export function toExportRow(
  sample: AnalyticsSample & {
    voltageMv?: number | null;
    currentMa?: number | null;
    temperatureC?: number | null;
    status?: string;
  },
): ExportRow {
  return {
    timestamp: sample.timestamp,
    levelPercent: sample.levelPercent,
    voltageMv: sample.voltageMv ?? null,
    currentMa: sample.currentMa ?? null,
    powerW: sample.powerW,
    temperatureC: sample.temperatureC ?? null,
    status: sample.status ?? (sample.isCharging ? 'charging' : 'discharging'),
  };
}

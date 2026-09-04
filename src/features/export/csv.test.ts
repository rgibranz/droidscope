import { buildCsv, exportFileName, toIsoLocal, type ExportRow } from './csv';

const T = new Date(2026, 8, 4, 14, 10, 0).getTime(); // 2026-09-04 14:10 local

const row: ExportRow = {
  timestamp: T,
  levelPercent: 82,
  voltageMv: 4112,
  currentMa: -682,
  powerW: -2.804,
  temperatureC: 34.8,
  status: 'discharging',
};

describe('CSV export', () => {
  it('writes the header from §32', () => {
    expect(buildCsv([]).split('\n')[0]).toBe(
      'timestamp,level_percent,voltage_mv,current_ma,power_w,temp_c,status',
    );
  });

  it('matches the worked example in §32', () => {
    const line = buildCsv([row]).split('\n')[1];
    expect(line).toBe('2026-09-04T14:10:00,82,4112,-682,-2.80,34.8,discharging');
  });

  it('leaves unsupported metrics empty rather than zero', () => {
    const line = buildCsv([
      { ...row, currentMa: null, powerW: null, temperatureC: null },
    ]).split('\n')[1];
    expect(line).toBe('2026-09-04T14:10:00,82,4112,,,,discharging');
  });

  it('keeps a genuine zero as 0', () => {
    const line = buildCsv([{ ...row, currentMa: 0, powerW: 0 }]).split('\n')[1];
    expect(line).toContain(',0,0.00,');
  });

  it('quotes a status containing a comma', () => {
    const line = buildCsv([{ ...row, status: 'not charging, full' }]).split(
      '\n',
    )[1];
    expect(line).toContain('"not charging, full"');
  });

  it('formats timestamps in local time (§32)', () => {
    expect(toIsoLocal(T)).toBe('2026-09-04T14:10:00');
  });

  it('names the file with a sortable timestamp', () => {
    expect(exportFileName(T)).toBe('batteryscope-20260904-1410.csv');
  });
});

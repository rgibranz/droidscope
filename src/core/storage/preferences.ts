import { createMMKV } from 'react-native-mmkv';
import type { SignConvention } from '../battery/signCalibration';

/**
 * Small key/value state only (§4.0.6). Battery history belongs in SQLite --
 * nothing large goes in here.
 */
const storage = createMMKV({ id: 'batteryscope.preferences' });

export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_KEY = 'theme';

export function readThemePreference(): ThemePreference {
  const value = storage.getString(THEME_KEY);
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function writeThemePreference(value: ThemePreference): void {
  storage.set(THEME_KEY, value);
}

/** §7.6 sampling intervals. */
export const SAMPLE_INTERVALS = [5_000, 10_000, 30_000, 60_000] as const;
export type SampleInterval = (typeof SAMPLE_INTERVALS)[number];

const INTERVAL_KEY = 'sampleInterval';
const BACKGROUND_KEY = 'backgroundEnabled';

export function readSampleInterval(): SampleInterval {
  const value = storage.getNumber(INTERVAL_KEY);
  return SAMPLE_INTERVALS.includes(value as SampleInterval)
    ? (value as SampleInterval)
    : 10_000; // §19 foreground default
}

export function writeSampleInterval(value: SampleInterval): void {
  storage.set(INTERVAL_KEY, value);
}

/** §20: monitoring state is restored after an app restart. */
export function readBackgroundEnabled(): boolean {
  return storage.getBoolean(BACKGROUND_KEY) ?? false;
}

export function writeBackgroundEnabled(value: boolean): void {
  storage.set(BACKGROUND_KEY, value);
}

/** §22 retention options. `unlimited` never purges. */
export type RetentionOption = '24h' | '3d' | '7d' | '30d' | 'unlimited';

const RETENTION_KEY = 'retention';

export const RETENTION_MS: Record<RetentionOption, number | null> = {
  '24h': 24 * 60 * 60_000,
  '3d': 3 * 24 * 60 * 60_000,
  '7d': 7 * 24 * 60 * 60_000,
  '30d': 30 * 24 * 60 * 60_000,
  unlimited: null,
};

export function readRetention(): RetentionOption {
  const value = storage.getString(RETENTION_KEY);
  return value !== undefined && value in RETENTION_MS
    ? (value as RetentionOption)
    : '7d'; // §22 default
}

export function writeRetention(value: RetentionOption): void {
  storage.set(RETENTION_KEY, value);
}

/**
 * Sign calibration is per device model: carrying a Samsung's convention over to
 * an Infinix would be worse than starting from unknown.
 */
function signKey(deviceModel: string): string {
  return `sign.${deviceModel}`;
}

export function readSignConvention(deviceModel: string): SignConvention {
  const value = storage.getString(signKey(deviceModel));
  return value === 'normal' || value === 'reversed' ? value : 'unknown';
}

export function writeSignConvention(
  deviceModel: string,
  convention: SignConvention,
): void {
  storage.set(signKey(deviceModel), convention);
}

export function clearSignConvention(deviceModel: string): void {
  storage.remove(signKey(deviceModel));
}

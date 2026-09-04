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

import { create } from 'zustand';
import {
  readBackgroundEnabled,
  readRetention,
  readSampleInterval,
  readThemePreference,
  writeBackgroundEnabled,
  writeRetention,
  writeSampleInterval,
  writeThemePreference,
  type RetentionOption,
  type SampleInterval,
  type ThemePreference,
} from '../../core/storage/preferences';

/**
 * Settings are read from MMKV once at startup and written through on change.
 * Keeping them in a store rather than reading MMKV per render means a theme
 * change repaints immediately instead of on the next mount.
 */
interface SettingsStore {
  theme: ThemePreference;
  retention: RetentionOption;
  sampleIntervalMs: SampleInterval;
  backgroundEnabled: boolean;

  setTheme: (value: ThemePreference) => void;
  setRetention: (value: RetentionOption) => void;
  setSampleInterval: (value: SampleInterval) => void;
  setBackgroundEnabled: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>(set => ({
  theme: readThemePreference(),
  retention: readRetention(),
  sampleIntervalMs: readSampleInterval(),
  backgroundEnabled: readBackgroundEnabled(),

  setTheme: value => {
    writeThemePreference(value);
    set({ theme: value });
  },
  setRetention: value => {
    writeRetention(value);
    set({ retention: value });
  },
  setSampleInterval: value => {
    writeSampleInterval(value);
    set({ sampleIntervalMs: value });
  },
  setBackgroundEnabled: value => {
    writeBackgroundEnabled(value);
    set({ backgroundEnabled: value });
  },
}));

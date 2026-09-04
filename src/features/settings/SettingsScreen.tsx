import { useCallback, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Text } from '../../design-system/tamagui';
import { AppScreen } from '../../design-system/AppScreen';
import { InlineNotice, SectionHeader } from '../../design-system/primitives';
import {
  SettingsChoice,
  SettingsDivider,
  SettingsGroup,
  SettingsRow,
  SettingsToggle,
} from '../../design-system/SettingsRow';
import { typeScale } from '../../core/theme/tokens';
import BatteryTelemetry from '../../core/native/NativeBatteryTelemetry';
import BatteryScopeFiles from '../../core/native/NativeBatteryScopeFiles';
import {
  RETENTION_MS,
  SAMPLE_INTERVALS,
  type RetentionOption,
  type SampleInterval,
  type ThemePreference,
} from '../../core/storage/preferences';
import {
  clearHistory,
  countSamples,
  queryForExport,
} from '../../data/history/historyRepository';
import { buildCsv, exportFileName } from '../export/csv';
import { RANGE_MS } from '../../data/history/buckets';
import { useSettingsStore } from './store';

const THEMES: ThemePreference[] = ['system', 'light', 'dark'];
const RETENTIONS = Object.keys(RETENTION_MS) as RetentionOption[];

const THEME_LABEL: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

const RETENTION_LABEL: Record<RetentionOption, string> = {
  '24h': '24 hours',
  '3d': '3 days',
  '7d': '7 days',
  '30d': '30 days',
  unlimited: 'Unlimited',
};

export function SettingsScreen() {
  const settings = useSettingsStore();
  const navigation = useNavigation<{ navigate: (screen: string) => void }>();
  const [status, setStatus] = useState<string | null>(null);
  const [sampleCount, setSampleCount] = useState(0);

  // Recounted whenever the screen comes into view: the number changes while
  // other tabs are open, and a figure that silently goes stale is exactly the
  // kind of inaccuracy §2.1 rules out.
  useFocusEffect(
    useCallback(() => {
      try {
        setSampleCount(countSamples());
      } catch {
        setSampleCount(0);
      }
    }, []),
  );

  const toggleBackground = useCallback(
    async (next: boolean) => {
      try {
        if (next) {
          // §33: the notification permission is requested only at the point the
          // feature that needs it is switched on.
          if (Platform.OS === 'android' && Platform.Version >= 33) {
            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            );
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
              setStatus(
                'Background monitoring needs notification permission, because Android requires a visible notification for it.',
              );
              return;
            }
          }
          await BatteryTelemetry.startBackgroundMonitoring(
            Math.max(settings.sampleIntervalMs, 30_000),
          );
        } else {
          await BatteryTelemetry.stopBackgroundMonitoring();
        }
        settings.setBackgroundEnabled(next);
        setStatus(null);
      } catch (e) {
        setStatus(e instanceof Error ? e.message : String(e));
      }
    },
    [settings],
  );

  const exportCsv = useCallback(async () => {
    try {
      const to = Date.now();
      const rows = queryForExport(to - RANGE_MS['7D'], to);
      if (!rows.length) {
        setStatus('Nothing to export yet — no samples stored.');
        return;
      }
      await BatteryScopeFiles.shareCsv(exportFileName(to), buildCsv(rows));
      setStatus(`Exported ${rows.length} samples.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const confirmClear = useCallback(() => {
    Alert.alert(
      'Clear history?',
      'All stored battery samples are deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            try {
              clearHistory();
              setSampleCount(0);
              setStatus('History cleared.');
            } catch (e) {
              setStatus(e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );
  }, []);

  return (
    <AppScreen>
      <SectionHeader>Settings</SectionHeader>

      {status ? <InlineNotice>{status}</InlineNotice> : null}

      <SettingsGroup title="Appearance">
        <SettingsChoice
          label="Theme"
          options={THEMES}
          value={settings.theme}
          format={t => THEME_LABEL[t]}
          onChange={settings.setTheme}
        />
      </SettingsGroup>

      <SettingsGroup title="Monitoring">
        <SettingsChoice
          label="Sample interval"
          options={SAMPLE_INTERVALS}
          value={settings.sampleIntervalMs}
          format={ms => `${ms / 1000}s`}
          onChange={v => settings.setSampleInterval(v as SampleInterval)}
        />
        <SettingsDivider />
        <SettingsToggle
          label="Keep monitoring in the background"
          description="Shows a permanent notification, which Android requires to sample while the app is closed. Sampling drops to at least 30s to stay cheap."
          value={settings.backgroundEnabled}
          onChange={toggleBackground}
        />
      </SettingsGroup>

      <SettingsGroup title="History">
        <SettingsChoice
          label="Keep samples for"
          options={RETENTIONS}
          value={settings.retention}
          format={r => RETENTION_LABEL[r]}
          onChange={settings.setRetention}
        />
      </SettingsGroup>

      <SettingsGroup title="Data">
        <SettingsRow
          label="Export as CSV"
          description="Shares the last 7 days of samples through the Android share sheet."
          onPress={exportCsv}
        />
        <SettingsDivider />
        <SettingsRow
          label="Clear history"
          description={`${sampleCount} samples stored`}
          tone="danger"
          onPress={confirmClear}
        />
      </SettingsGroup>

      <SettingsGroup title="Diagnostics">
        <SettingsRow
          label="Sensor support and raw values"
          description="What this device actually reports, and what it does not."
          onPress={() => navigation.navigate('Diagnostics')}
        />
      </SettingsGroup>

      <SettingsGroup title="About">
        <SettingsRow
          label="Privacy"
          description="All battery data stays on this device. Nothing is sent anywhere unless you export it yourself."
        />
      </SettingsGroup>

      <Text fontSize={typeScale.label} color="$textMuted">
        BatteryScope · local-first battery telemetry
      </Text>
    </AppScreen>
  );
}

import { createTamagui, createTokens } from '../../design-system/tamagui';
import {
  fonts,
  media,
  settings,
  shorthands,
  themes as baseThemes,
  tokens as baseTokens,
} from '@tamagui/config/v5';
import {
  darkPalette,
  lightPalette,
  radiusScale,
  spaceScale,
  type AppPalette,
} from './tokens';

/**
 * No Tamagui animation driver is registered: the only animation in the app runs
 * on Reanimated directly (BatteryRing), and press feedback works through
 * pressStyle without one. A driver goes in when something actually needs it.
 */
const tokens = createTokens({
  ...baseTokens,
  space: spaceScale,
  size: spaceScale,
  radius: radiusScale,
});

/**
 * The v5 preset supplies a complete theme -- Tamagui primitives expect many
 * keys -- and BatteryScope's semantics are layered on top rather than rebuilt.
 */
function theme(palette: AppPalette, base: Record<string, unknown>) {
  return {
    ...base,
    background: palette.background,
    backgroundHover: palette.surface,
    backgroundPress: palette.surfaceInteractive,
    backgroundFocus: palette.surfaceInteractive,
    borderColor: palette.border,
    borderColorHover: palette.border,
    color: palette.text,
    colorHover: palette.text,
    colorPress: palette.text,
    colorFocus: palette.text,
    placeholderColor: palette.textMuted,
    // BatteryScope semantics
    surface: palette.surface,
    surfaceElevated: palette.surfaceElevated,
    surfaceInteractive: palette.surfaceInteractive,
    textMuted: palette.textMuted,
    accent: palette.accent,
    charging: palette.charging,
    warning: palette.warning,
    danger: palette.danger,
  };
}

export const config = createTamagui({
  fonts,
  media,
  settings: {
    ...settings,
    // The v5 preset defaults to web-style prop names and shorthand-only
    // styling. Keeping React Native's names means any RN engineer can read
    // these components without learning a second styling vocabulary.
    styleCompat: 'react-native',
    onlyAllowShorthands: false,
  },
  shorthands,
  tokens,
  themes: {
    dark: theme(darkPalette, baseThemes.dark as Record<string, unknown>),
    light: theme(lightPalette, baseThemes.light as Record<string, unknown>),
  },
});

export type AppConfig = typeof config;

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;

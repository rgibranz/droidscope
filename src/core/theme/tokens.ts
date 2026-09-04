/**
 * Every visual value in the app comes from here (§41.3). Screens must not
 * introduce one-off numbers like 17 or 23.
 */

/** §41.3 spacing scale. */
export const spaceScale = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
  9: 48,
  true: 16,
} as const;

/** §41.3 radius family. */
export const radiusScale = {
  0: 0,
  1: 12, // small
  2: 16, // medium
  3: 20, // large
  4: 26, // hero
  pill: 9999,
  true: 16,
} as const;

/**
 * Dark-first palette (§41.5). Layered surfaces rather than pure black, and
 * discharge is deliberately not red -- a draining battery is normal behaviour,
 * so red is reserved for genuinely abnormal states.
 */
export const darkPalette = {
  background: '#0B0D10',
  surface: '#14171C',
  surfaceElevated: '#1C2027',
  surfaceInteractive: '#232830',
  border: '#262B33',
  text: '#E8EAED',
  textMuted: '#9AA1AC',
  accent: '#4C8DFF',
  charging: '#3DD68C',
  warning: '#F2B441',
  danger: '#F2555A',
} as const;

export const lightPalette = {
  background: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceInteractive: '#EEF1F5',
  border: '#E3E6EB',
  text: '#14171C',
  textMuted: '#5C6470',
  accent: '#2563EB',
  charging: '#0F9D63',
  warning: '#B8760A',
  danger: '#D1343A',
} as const;

/**
 * §41.4 type hierarchy. Not every number is huge -- only the hero reading is,
 * so the eye lands on it first.
 */
export const typeScale = {
  hero: 56,
  heroPower: 30,
  metricValue: 24,
  sectionTitle: 18,
  body: 15,
  label: 12,
} as const;

/** §41.9 motion timings. */
export const motion = {
  quick: 140,
  normal: 220,
  layout: 320,
} as const;

export type AppPalette = { [K in keyof typeof darkPalette]: string };

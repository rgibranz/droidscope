/**
 * Unit conversion and display formatting. Pure functions only -- these are the
 * calculations §52 requires tests for, and they must be verifiable without a
 * device.
 *
 * Every function propagates null rather than substituting a placeholder: a
 * missing input can only produce a missing output.
 */

export function mvToVolts(mv: number | null): number | null {
  return mv === null ? null : mv / 1000;
}

export function uaToMilliamps(ua: number | null): number | null {
  return ua === null ? null : ua / 1000;
}

export function deciCToCelsius(deci: number | null): number | null {
  return deci === null ? null : deci / 10;
}

export function uahToMah(uah: number | null): number | null {
  return uah === null ? null : uah / 1000;
}

/**
 * power = voltage x current, in watts.
 * Returns null unless both inputs are present, which is what stops the app
 * from inventing a wattage on devices that do not report current.
 */
export function computePowerW(
  voltageMv: number | null,
  currentUa: number | null,
): number | null {
  if (voltageMv === null || currentUa === null) return null;
  return (voltageMv / 1000) * (currentUa / 1_000_000);
}

// ------------------------------------------------------------- formatting

export const UNAVAILABLE = '--';

export function formatVolts(volts: number | null): string {
  return volts === null ? UNAVAILABLE : volts.toFixed(3);
}

export function formatMilliamps(ma: number | null): string {
  if (ma === null) return UNAVAILABLE;
  const rounded = Math.round(ma);
  // Explicit sign makes charge direction readable without relying on colour.
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

export function formatWatts(watts: number | null): string {
  if (watts === null) return UNAVAILABLE;
  const value = watts.toFixed(2);
  return watts > 0 ? `+${value}` : value;
}

export function formatCelsius(celsius: number | null): string {
  return celsius === null ? UNAVAILABLE : celsius.toFixed(1);
}

export function formatMah(mah: number | null): string {
  return mah === null ? UNAVAILABLE : String(Math.round(mah));
}

export function formatPercent(percent: number | null): string {
  return percent === null ? UNAVAILABLE : String(Math.round(percent));
}

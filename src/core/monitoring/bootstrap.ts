import { useBatteryStore } from '../../features/battery-live/store';

/**
 * Starts telemetry sampling and persistence as soon as the JS bundle loads,
 * independently of whether any screen is mounted.
 *
 * This is what makes background monitoring actually record. The foreground
 * service owns the schedule, but the database write happens in JavaScript --
 * so when Android restarts the process without an Activity, the bundle running
 * is the only thing that subscribes. Leaving that subscription to a screen's
 * effect meant nothing was written unless the UI was open, which defeats the
 * feature entirely.
 */
export function bootstrapMonitoring(): void {
  useBatteryStore
    .getState()
    .start()
    .catch(() => {
      // The store records the failure in its own state; the dashboard shows it.
      // Throwing here would take down the bundle before any UI exists.
    });
}

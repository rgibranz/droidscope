import { create } from 'zustand';
import BatteryTelemetry, {
  type NativeCapabilities,
  type NativeDiagnostics,
  type NativeSnapshot,
} from '../../core/native/NativeBatteryTelemetry';
import { toReading } from '../../core/battery/normalize';
import {
  INITIAL_CALIBRATION,
  observeSign,
  type SignCalibration,
} from '../../core/battery/signCalibration';
import { toChargeStatus, type BatteryReading } from '../../data/models/battery';
import {
  clearSignConvention,
  readBackgroundEnabled,
  readRetention,
  readSampleInterval,
  readSignConvention,
  RETENTION_MS,
  writeSignConvention,
} from '../../core/storage/preferences';
import { insertSample, purgeOlderThan } from '../../data/history/historyRepository';

/** @see §19 -- background sampling stays coarse to keep the app cheap. */
const MIN_BACKGROUND_INTERVAL_MS = 30_000;

/**
 * Telemetry also arrives on plug/unplug broadcasts, which can burst. Persisting
 * is throttled to the sampling interval so a flurry of state changes does not
 * inflate the database (§19, §63).
 */
const MIN_PERSIST_GAP_MS = 9_500;

/**
 * A device missing a metric is still `ready` -- availability is a property of
 * each metric, not of the screen. Making it a screen state (as §40 suggests)
 * would force every card to ask the wrong question.
 */
export type TelemetryStatus = 'loading' | 'ready' | 'error';

interface BatteryStore {
  status: TelemetryStatus;
  reading: BatteryReading | null;
  snapshot: NativeSnapshot | null;
  capabilities: NativeCapabilities | null;
  diagnostics: NativeDiagnostics | null;
  calibration: SignCalibration;
  error: string | null;
  /** Storage problems are surfaced separately: live telemetry still works. */
  historyError: string | null;

  start: () => Promise<void>;
  stop: () => void;
  resetCalibration: () => void;
}

let subscription: { remove: () => void } | null = null;
let lastPersistedAt = 0;

/**
 * Monitoring is owned by the app process, not by a screen.
 *
 * It used to be started from DashboardScreen's effect and stopped when that
 * screen unmounted, which meant nothing was recorded unless the UI happened to
 * be mounted -- the exact case background monitoring exists to cover.
 */
let monitoring = false;

export const useBatteryStore = create<BatteryStore>((set, get) => ({
  status: 'loading',
  reading: null,
  snapshot: null,
  capabilities: null,
  diagnostics: null,
  calibration: INITIAL_CALIBRATION,
  error: null,
  historyError: null,

  start: async () => {
    // Idempotent: the bootstrap calls this when the bundle loads, and the
    // dashboard calls it again on mount as a safety net. The second call must
    // not tear down the first subscription or reset the write throttle.
    if (monitoring) return;
    monitoring = true;

    // A fresh monitoring session writes its first sample immediately rather
    // than waiting out a throttle left over from the previous one.
    lastPersistedAt = 0;
    try {
      const diagnostics = await BatteryTelemetry.getDiagnostics();
      const capabilities = await BatteryTelemetry.getCapabilities();

      const stored = readSignConvention(diagnostics.model);
      const calibration: SignCalibration =
        stored === 'unknown'
          ? INITIAL_CALIBRATION
          : { convention: stored, streak: 0, suggests: stored };

      set({ diagnostics, capabilities, calibration });
      applyRetention();
      applySnapshot(await BatteryTelemetry.getSnapshot(), set, get);

      subscription?.remove();
      subscription = BatteryTelemetry.onTelemetry(next =>
        applySnapshot(next, set, get),
      );
      await BatteryTelemetry.startMonitoring(readSampleInterval());
      await restoreBackgroundMonitoring();
      set({ status: 'ready', error: null });
    } catch (e) {
      monitoring = false;
      set({ status: 'error', error: describeError(e) });
    }
  },

  /**
   * Only ever called deliberately -- never from a screen unmounting. Sampling
   * has to outlive the UI for background monitoring to mean anything.
   */
  stop: () => {
    monitoring = false;
    subscription?.remove();
    subscription = null;
    BatteryTelemetry.stopMonitoring().catch(() => {});
  },

  resetCalibration: () => {
    const model = get().diagnostics?.model;
    if (model) clearSignConvention(model);
    set({ calibration: INITIAL_CALIBRATION });
  },
}));

type Setter = (partial: Partial<BatteryStore>) => void;
type Getter = () => BatteryStore;

function applySnapshot(snapshot: NativeSnapshot, set: Setter, get: Getter) {
  const previous = get().calibration;
  const calibration = observeSign(previous, {
    currentUa: snapshot.currentUa,
    levelPercent: snapshot.levelPercent,
    status: toChargeStatus(snapshot.statusCode),
  });

  // Persist only at the moment it locks, so a reset is not immediately undone.
  if (
    calibration.convention !== 'unknown' &&
    previous.convention === 'unknown'
  ) {
    const model = get().diagnostics?.model;
    if (model) writeSignConvention(model, calibration.convention);
  }

  const reading = toReading(snapshot, calibration.convention);

  if (snapshot.timestamp - lastPersistedAt >= MIN_PERSIST_GAP_MS) {
    lastPersistedAt = snapshot.timestamp;
    try {
      insertSample(reading);
    } catch (e) {
      // §35: a storage failure must never take the live view down with it.
      set({ historyError: describeError(e) });
    }
  }

  set({
    snapshot,
    calibration,
    reading,
    status: 'ready',
  });
}

/**
 * §20: monitoring survives an app restart. The service may already be running
 * (START_STICKY), so it is only started when it is not.
 */
async function restoreBackgroundMonitoring(): Promise<void> {
  if (!readBackgroundEnabled()) return;
  try {
    if (await BatteryTelemetry.isBackgroundMonitoringActive()) return;
    await BatteryTelemetry.startBackgroundMonitoring(
      Math.max(readSampleInterval(), MIN_BACKGROUND_INTERVAL_MS),
    );
  } catch {
    // The user can retry from Settings; failing here must not block the app.
  }
}

/** §22: purge on startup; sampling keeps the window rolling from there. */
function applyRetention(): void {
  const window = RETENTION_MS[readRetention()];
  if (window === null) return;
  try {
    purgeOlderThan(Date.now() - window);
  } catch {
    // A failed purge is not worth interrupting monitoring for.
  }
}

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

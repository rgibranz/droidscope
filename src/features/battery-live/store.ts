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
  readSignConvention,
  writeSignConvention,
} from '../../core/storage/preferences';

const FOREGROUND_INTERVAL_MS = 10_000;

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

  start: () => Promise<void>;
  stop: () => void;
  resetCalibration: () => void;
}

let subscription: { remove: () => void } | null = null;

export const useBatteryStore = create<BatteryStore>((set, get) => ({
  status: 'loading',
  reading: null,
  snapshot: null,
  capabilities: null,
  diagnostics: null,
  calibration: INITIAL_CALIBRATION,
  error: null,

  start: async () => {
    try {
      const diagnostics = await BatteryTelemetry.getDiagnostics();
      const capabilities = await BatteryTelemetry.getCapabilities();

      const stored = readSignConvention(diagnostics.model);
      const calibration: SignCalibration =
        stored === 'unknown'
          ? INITIAL_CALIBRATION
          : { convention: stored, streak: 0, suggests: stored };

      set({ diagnostics, capabilities, calibration });
      applySnapshot(await BatteryTelemetry.getSnapshot(), set, get);

      subscription?.remove();
      subscription = BatteryTelemetry.onTelemetry(next =>
        applySnapshot(next, set, get),
      );
      await BatteryTelemetry.startMonitoring(FOREGROUND_INTERVAL_MS);
      set({ status: 'ready', error: null });
    } catch (e) {
      set({ status: 'error', error: describeError(e) });
    }
  },

  stop: () => {
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

  set({
    snapshot,
    calibration,
    reading: toReading(snapshot, calibration.convention),
    status: 'ready',
  });
}

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

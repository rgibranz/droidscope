import type {
  NativeCapabilities,
  NativeDiagnostics,
  NativeSnapshot,
} from '../NativeBatteryTelemetry';

/**
 * Manual mock for tests. Defaults describe the worst realistic device: one that
 * reports nothing beyond level and status, which is the case the UI most often
 * gets wrong.
 */

export const emptySnapshot: NativeSnapshot = {
  timestamp: 1_788_503_940_000,
  levelPercent: 82,
  voltageMv: null,
  currentUa: null,
  currentAvgUa: null,
  temperatureDeciC: null,
  chargeCounterUah: null,
  energyCounterNwh: null,
  cycleCount: null,
  healthCode: null,
  statusCode: 3,
  pluggedCode: 0,
  technology: null,
  present: true,
};

export const emptyCapabilities: NativeCapabilities = {
  levelPercent: true,
  voltage: false,
  temperature: false,
  currentNow: false,
  currentAverage: false,
  chargeCounter: false,
  energyCounter: false,
  cycleCount: false,
  fullChargeCapacity: false,
  designCapacity: false,
};

export const emptyDiagnostics: NativeDiagnostics = {
  manufacturer: 'TEST',
  model: 'Mock Device',
  device: 'mock',
  androidRelease: '15',
  sdkInt: 35,
  hardware: 'mock',
  sysfsReadable: false,
  sysfsNote: 'Path not present on this device',
  raw: [],
};

let snapshot = emptySnapshot;
let listener: ((s: NativeSnapshot) => void) | null = null;

export function __setSnapshot(next: NativeSnapshot) {
  snapshot = next;
}

/** Simulates a native telemetry event reaching JS. */
export function __emit(next: NativeSnapshot) {
  snapshot = next;
  listener?.(next);
}

export function __reset() {
  snapshot = emptySnapshot;
  listener = null;
}

export default {
  getSnapshot: jest.fn(async () => snapshot),
  getCapabilities: jest.fn(async () => emptyCapabilities),
  getDiagnostics: jest.fn(async () => emptyDiagnostics),
  startMonitoring: jest.fn(async () => {}),
  stopMonitoring: jest.fn(async () => {}),
  startBackgroundMonitoring: jest.fn(async () => {}),
  stopBackgroundMonitoring: jest.fn(async () => {}),
  isBackgroundMonitoringActive: jest.fn(async () => false),
  onTelemetry: jest.fn((handler: (s: NativeSnapshot) => void) => {
    listener = handler;
    return {
      remove: () => {
        listener = null;
      },
    };
  }),
};

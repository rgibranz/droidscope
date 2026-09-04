import type {CodegenTypes, TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

/**
 * Raw telemetry exactly as the device reports it.
 * null means "this device does not expose the metric" -- never a substitute
 * for a real reading. 0 is a legitimate value on many devices.
 */
export type NativeSnapshot = {
  timestamp: number;
  levelPercent: number | null;
  voltageMv: number | null;
  currentUa: number | null;
  currentAvgUa: number | null;
  temperatureDeciC: number | null;
  chargeCounterUah: number | null;
  energyCounterNwh: number | null;
  cycleCount: number | null;
  healthCode: number | null;
  statusCode: number | null;
  pluggedCode: number | null;
  technology: string | null;
  present: boolean;
};

export type NativeCapabilities = {
  levelPercent: boolean;
  voltage: boolean;
  temperature: boolean;
  currentNow: boolean;
  currentAverage: boolean;
  chargeCounter: boolean;
  energyCounter: boolean;
  cycleCount: boolean;
  fullChargeCapacity: boolean;
  designCapacity: boolean;
};

export type NativeRawEntry = {
  key: string;
  value: string;
  source: string;
};

export type NativeDiagnostics = {
  manufacturer: string;
  model: string;
  device: string;
  androidRelease: string;
  sdkInt: number;
  hardware: string;
  /** Whether an ordinary app process can read /sys/class/power_supply on this device. */
  sysfsReadable: boolean;
  sysfsNote: string;
  raw: NativeRawEntry[];
};

export interface Spec extends TurboModule {
  getSnapshot(): Promise<NativeSnapshot>;
  getCapabilities(): Promise<NativeCapabilities>;
  getDiagnostics(): Promise<NativeDiagnostics>;
  startMonitoring(intervalMs: number): Promise<void>;
  stopMonitoring(): Promise<void>;
  readonly onTelemetry: CodegenTypes.EventEmitter<NativeSnapshot>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('BatteryTelemetry');

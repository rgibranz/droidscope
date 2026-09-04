import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

/**
 * File handoff for CSV export (§32). Separate from the telemetry module because
 * sharing a file has nothing to do with reading a battery.
 *
 * The React Native Share API only carries text and URLs, so writing the file and
 * handing Android a content:// URI has to happen natively. That is the whole of
 * this module -- no extra dependency for it (§4.0.2).
 */
export interface Spec extends TurboModule {
  /** Writes the file to app cache and opens the system share sheet. */
  shareCsv(fileName: string, content: string): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('BatteryScopeFiles');

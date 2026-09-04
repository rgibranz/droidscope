import { useEffect, useState } from 'react';
import { queryAnalyticsSamples } from '../../data/history/historyRepository';
import {
  estimateTimeRemaining,
  estimateTimeToFull,
  PREFERRED_WINDOW_MS,
  type Estimate,
} from './estimate';

/**
 * Recomputed once a minute rather than on every telemetry tick: the underlying
 * window is 30 minutes long, so a fresh calculation every 10 seconds would cost
 * a database read to move the answer by nothing (§63).
 */
const RECOMPUTE_INTERVAL_MS = 60_000;

const INITIAL: Estimate = {
  kind: 'unavailable',
  reason: 'Collecting usage data…',
};

export function useEstimate(isCharging: boolean): Estimate {
  const [estimate, setEstimate] = useState<Estimate>(INITIAL);

  useEffect(() => {
    const compute = () => {
      const now = Date.now();
      try {
        const samples = queryAnalyticsSamples(now - PREFERRED_WINDOW_MS, now);
        setEstimate(
          isCharging
            ? estimateTimeToFull(samples)
            : estimateTimeRemaining(samples),
        );
      } catch {
        setEstimate({ kind: 'unavailable', reason: 'History unavailable' });
      }
    };

    compute();
    const id = setInterval(compute, RECOMPUTE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isCharging]);

  return estimate;
}

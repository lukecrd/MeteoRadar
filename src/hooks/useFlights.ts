import { useEffect, useMemo, useState } from 'react';
import { fetchHubFlights, Flight, FLIGHT_HUBS, HubFlightsResponse } from '../services/hubApi';

const CYCLE_MS = 60_000;
const PARALLEL = 2;
const RETRY_DELAY_MS = 4000;

export interface FlightsState {
  /** all hubs merged, each aircraft once */
  flights: Flight[];
  byHub: Record<string, HubFlightsResponse>;
  /** hubs answered at least once */
  loadedHubs: number;
  isLoading: boolean;
  lastCycleAt: number | null;
}

/**
 * Loads live traffic hub by hub (two at a time), so aircraft appear on the
 * globe progressively instead of after one long request, then repeats the
 * sweep every minute while the tab is visible.
 */
export function useFlights(enabled: boolean): FlightsState {
  const [byHub, setByHub] = useState<Record<string, HubFlightsResponse>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastCycleAt, setLastCycleAt] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    let first = true;
    const sweep = async () => {
      if (cancelled) return;
      // The first sweep always runs (a tab opened in the background still gets data);
      // later sweeps wait until the tab is visible again.
      if (!first && document.visibilityState !== 'visible') {
        timer = setTimeout(sweep, 5000);
        return;
      }
      first = false;
      setIsLoading(true);
      const queue = FLIGHT_HUBS.map((h) => h.id);
      const failed: string[] = [];
      const work = async () => {
        while (queue.length && !cancelled) {
          const hub = queue.shift()!;
          try {
            const data = await fetchHubFlights(hub);
            // A busy upstream answers with an error and no aircraft: retry shortly.
            if (data.error && data.flights.length === 0) failed.push(hub);
            else if (!cancelled) setByHub((prev) => ({ ...prev, [hub]: data }));
          } catch {
            failed.push(hub);
          }
        }
      };
      await Promise.all(Array.from({ length: PARALLEL }, work));
      if (failed.length && !cancelled) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        queue.push(...failed.splice(0));
        await Promise.all(Array.from({ length: PARALLEL }, work));
      }
      if (cancelled) return;
      setIsLoading(false);
      setLastCycleAt(Date.now());
      timer = setTimeout(sweep, CYCLE_MS);
    };

    sweep();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled]);

  const flights = useMemo(() => {
    const seen = new Set<string>();
    const out: Flight[] = [];
    for (const hub of FLIGHT_HUBS) {
      for (const f of byHub[hub.id]?.flights ?? []) {
        if (seen.has(f.hex)) continue;
        seen.add(f.hex);
        out.push(f);
      }
    }
    return out;
  }, [byHub]);

  return { flights, byHub, loadedHubs: Object.keys(byHub).length, isLoading, lastCycleAt };
}

import { useCallback, useEffect, useRef, useState } from 'react';

interface PolledResource<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  refresh: () => void;
}

/**
 * Fetches `load` now and every `intervalMs`. Polling pauses while the tab
 * is hidden and catches up as soon as it is visible again; a failed poll
 * keeps showing the last good data alongside the error.
 */
export function usePolledResource<T>(load: () => Promise<T>, intervalMs: number): PolledResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastRun = useRef(0);
  const alive = useRef(true);

  const run = useCallback(async () => {
    lastRun.current = Date.now();
    setIsLoading(true);
    try {
      const next = await load();
      if (!alive.current) return;
      setData(next);
      setError(null);
    } catch (err: any) {
      if (alive.current) setError(err?.message || 'Servizio non raggiungibile');
    } finally {
      if (alive.current) setIsLoading(false);
    }
  }, [load]);

  useEffect(() => {
    alive.current = true;
    run();
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible') run();
    }, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRun.current > intervalMs) run();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive.current = false;
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [run, intervalMs]);

  return { data, error, isLoading, refresh: run };
}

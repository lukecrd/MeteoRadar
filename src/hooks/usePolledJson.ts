import { useCallback, useEffect, useRef, useState } from 'react';

interface PolledState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

export interface PolledResult<T> extends PolledState<T> {
  /** Manual reload (e.g. a "Riprova" button) */
  retry: () => void;
}

const AUTO_RETRY_MS = 5_000;

/**
 * Turns low-level fetch failures into a readable Italian message. Browsers
 * report a missing/unreachable server as a bare TypeError ("Failed to
 * fetch" in Chromium, "NetworkError…" in Firefox, "Load failed" in Safari).
 */
export function describeFetchError(err: any): string {
  const msg = String(err?.message || err || '');
  if (err?.name === 'TypeError' || /failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return 'Server WorldHub non raggiungibile — controlla che npm run dev sia attivo';
  }
  const http = msg.match(/^HTTP (\d{3})/);
  if (http) return `Errore del server WorldHub (HTTP ${http[1]})`;
  return msg || 'Servizio non raggiungibile';
}

/**
 * Polls a JSON endpoint every `refreshMs` while `enabled`. Like useNewsFeed,
 * polling pauses while the browser tab is hidden and catches up on return.
 * The last good payload is kept when a refresh of the same URL fails; when
 * the URL changes (e.g. another satellite group) the old data and error are
 * cleared at once so the UI shows a clean loading state. A failed load is
 * retried automatically once after a few seconds.
 */
export function usePolledJson<T>(url: string, refreshMs: number, enabled = true): PolledResult<T> {
  const [state, setState] = useState<PolledState<T>>({ data: null, error: null, isLoading: enabled });
  const [reloadKey, setReloadKey] = useState(0);
  const lastLoad = useRef(0);
  const [lastUrl, setLastUrl] = useState(url);

  if (lastUrl !== url) {
    // Reset during render (React's "adjust state on prop change" pattern)
    // so the previous URL's data or error never flashes.
    setLastUrl(url);
    setState({ data: null, error: null, isLoading: enabled });
  }

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const ctrl = new AbortController();

    const load = async (isRetry = false) => {
      lastLoad.current = Date.now();
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as T;
        if (!cancelled) setState({ data, error: null, isLoading: false });
      } catch (err: any) {
        if (cancelled || err?.name === 'AbortError') return;
        setState((s) => ({ ...s, error: describeFetchError(err), isLoading: false }));
        if (!isRetry) retryTimer = setTimeout(() => !cancelled && load(true), AUTO_RETRY_MS);
      }
    };

    load();
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, refreshMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > refreshMs) load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      ctrl.abort();
      clearInterval(tick);
      if (retryTimer) clearTimeout(retryTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [url, refreshMs, enabled, reloadKey]);

  const retry = useCallback(() => {
    setState((s) => ({ ...s, error: null, isLoading: true }));
    setReloadKey((k) => k + 1);
  }, []);

  return { ...state, retry };
}

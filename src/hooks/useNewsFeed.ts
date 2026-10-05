import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchNews, NewsFilter, NewsItem } from '../services/newsApi';

interface NewsFeedState {
  items: NewsItem[];
  fetchedAt: number | null;
  isLoading: boolean;
  error: string | null;
  /** ids that appeared after the first successful load of this category */
  freshIds: Set<string>;
  nextRefreshAt: number | null;
  refresh: () => void;
}

/**
 * Polls /api/news for one category. Polling pauses while the tab is hidden
 * and catches up immediately when it becomes visible again.
 */
export function useNewsFeed(category: NewsFilter, refreshMs = 120_000): NewsFeedState {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);

  const knownIds = useRef<Set<string> | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(
    async (force: boolean) => {
      const seq = ++requestSeq.current;
      setIsLoading(true);
      try {
        const data = await fetchNews(category, force);
        if (seq !== requestSeq.current) return; // category changed mid-flight
        if (knownIds.current) {
          const known = knownIds.current;
          setFreshIds(new Set(data.items.filter((i) => !known.has(i.id)).map((i) => i.id)));
        }
        knownIds.current = new Set(data.items.map((i) => i.id));
        setItems(data.items);
        setFetchedAt(data.fetchedAt);
        setError(null);
      } catch (err: any) {
        if (seq !== requestSeq.current) return;
        setError(err?.message || 'Feed news non raggiungibile');
      } finally {
        if (seq === requestSeq.current) {
          setIsLoading(false);
          setNextRefreshAt(Date.now() + refreshMs);
        }
      }
    },
    [category, refreshMs]
  );

  useEffect(() => {
    knownIds.current = null;
    setFreshIds(new Set());
    load(false);

    const tick = setInterval(() => {
      if (document.visibilityState === 'visible') load(true);
    }, refreshMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
      requestSeq.current++;
    };
  }, [load, refreshMs]);

  const refresh = useCallback(() => load(true), [load]);

  return { items, fetchedAt, isLoading, error, freshIds, nextRefreshAt, refresh };
}

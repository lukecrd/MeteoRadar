import type { NewsCategory, NewsItem, NewsResponse } from '../../lib/news';

export type { NewsCategory, NewsItem, NewsResponse };
export type NewsFilter = NewsCategory | 'all';

// Lets the Capacitor/Flutter builds point at a deployed backend
// (relative /api URLs only resolve when served by server.ts or Vercel).
const API_BASE: string = ((import.meta as any).env?.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';

export const NEWS_CATEGORY_META: Record<NewsFilter, { label: string; short: string; color: string }> = {
  all: { label: 'Tutte le fonti', short: 'ALL', color: '#22d3ee' },
  meteo: { label: 'Meteo & Allerte', short: 'WX', color: '#38bdf8' },
  italia: { label: 'Italia', short: 'ITA', color: '#34d399' },
  mondo: { label: 'Mondo', short: 'WRLD', color: '#a78bfa' },
  scienza: { label: 'Scienza & Spazio', short: 'SCI', color: '#f472b6' },
  tech: { label: 'Tecnologia', short: 'TECH', color: '#fbbf24' },
  ambiente: { label: 'Clima & Ambiente', short: 'ENV', color: '#4ade80' },
};

// Short-lived client memo so the ticker, the console panel and the hub
// share one request per category instead of fetching in parallel.
const MEMO_MS = 30_000;
const memo = new Map<NewsFilter, { at: number; promise: Promise<NewsResponse> }>();

export function fetchNews(category: NewsFilter, force = false): Promise<NewsResponse> {
  const hit = memo.get(category);
  if (!force && hit && Date.now() - hit.at < MEMO_MS) return hit.promise;

  const promise = fetch(`${API_BASE}/api/news?category=${encodeURIComponent(category)}`).then(async (res) => {
    if (!res.ok) throw new Error(`Feed news non disponibile (HTTP ${res.status})`);
    return (await res.json()) as NewsResponse;
  });
  memo.set(category, { at: Date.now(), promise });
  promise.catch(() => memo.delete(category));
  return promise;
}

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return 'ora';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min fa`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h fa`;
  return `${Math.round(h / 24)} g fa`;
}

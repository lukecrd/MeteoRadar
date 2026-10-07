import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, RefreshCw, Search, SatelliteDish, WifiOff, Newspaper } from 'lucide-react';
import { useNewsFeed } from '../hooks/useNewsFeed';
import { NEWS_CATEGORY_META, NewsFilter, NewsItem, timeAgo } from '../services/newsApi';

const FILTERS: NewsFilter[] = ['all', 'meteo', 'italia', 'mondo', 'scienza', 'tech', 'ambiente'];
const REFRESH_MS = 120_000;

/** Re-renders only itself once a second, so the list doesn't. */
const SyncCountdown: React.FC<{ nextAt: number | null; fetchedAt: number | null }> = ({ nextAt, fetchedAt }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = nextAt ? Math.max(0, Math.round((nextAt - now) / 1000)) : 0;
  const pct = nextAt ? Math.min(1, left / (REFRESH_MS / 1000)) : 0;
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <div className="flex items-center gap-3">
      <svg width="30" height="30" viewBox="0 0 36 36" className="-rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--hub-line)" strokeWidth="3" />
        <circle
          cx="18" cy="18" r="15" fill="none" stroke="var(--hub-cyan)" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${pct * 94.2} 94.2`}
          style={{ transition: 'stroke-dasharray 1s linear' }}
        />
      </svg>
      <div className="leading-tight">
        <div className="hub-label">Prossimo sync</div>
        <div className="font-hud text-sm font-semibold tabular-nums">{mm}:{ss}</div>
      </div>
      {fetchedAt && (
        <div className="leading-tight hidden sm:block pl-3 border-l border-[var(--hub-line)]">
          <div className="hub-label">Ultimo aggiornamento</div>
          <div className="font-hud text-sm font-semibold">{timeAgo(fetchedAt, now)}</div>
        </div>
      )}
    </div>
  );
};

const CategoryTag: React.FC<{ item: NewsItem }> = ({ item }) => {
  const meta = NEWS_CATEGORY_META[item.category];
  return (
    <span
      className="font-hud text-xs font-bold tracking-[0.14em] px-1.5 py-0.5 rounded border"
      style={{ color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}14` }}
    >
      {meta.short}
    </span>
  );
};

const FreshBadge = () => (
  <span className="font-hud text-xs font-bold tracking-[0.14em] px-1.5 py-0.5 rounded bg-[var(--hub-cyan)] text-slate-950">
    NUOVO
  </span>
);

const StoryMeta: React.FC<{ item: NewsItem; fresh: boolean }> = ({ item, fresh }) => (
  <div className="flex items-center flex-wrap gap-2 text-xs text-[var(--hub-dim)]">
    <CategoryTag item={item} />
    {fresh && <FreshBadge />}
    <span className="font-semibold text-[var(--hub-text)] opacity-80">{item.source}</span>
    <span aria-hidden>·</span>
    <time className="font-hud" dateTime={new Date(item.publishedAt).toISOString()}>
      {timeAgo(item.publishedAt)}
    </time>
  </div>
);

/**
 * Full news feed. Layout uses container queries so it adapts to the box it
 * lives in: a wide page section or a narrow side window (`embedded`).
 */
export const NewsHub: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [filter, setFilter] = useState<NewsFilter>('all');
  const [query, setQuery] = useState('');
  const { items, fetchedAt, isLoading, error, freshIds, nextRefreshAt, refresh } = useNewsFeed(filter, REFRESH_MS);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => `${i.title} ${i.summary} ${i.source}`.toLowerCase().includes(q));
  }, [items, query]);

  // Prefer a recent story that has a summary for the lead slot.
  const leadIdx = Math.max(0, visible.slice(0, 8).findIndex((i) => i.summary));
  const lead = visible[leadIdx];
  const rest = visible.filter((_, i) => i !== leadIdx);
  const side = rest.slice(0, 4);
  const stream = rest.slice(4);
  const sourceCount = new Set(items.map((i) => i.source)).size;

  return (
    <section
      className={`@container space-y-5 ${embedded ? '' : 'hub-panel hub-panel--glow p-4 sm:p-6'}`}
      aria-labelledby={embedded ? undefined : 'news-hub-title'}
      aria-label={embedded ? 'Feed notizie' : undefined}
    >
      {/* Header (the side window supplies its own title when embedded) */}
      <div className="flex flex-col @3xl:flex-row @3xl:items-end justify-between gap-4">
        <div>
          {!embedded && (
            <>
              <div className="hub-label flex items-center gap-2">
                <span className="hub-live-dot" /> Feed in tempo reale
              </div>
              <h2 id="news-hub-title" className="font-display text-2xl @3xl:text-4xl font-bold mt-1 flex items-center gap-3">
                <SatelliteDish className="w-7 h-7 text-[var(--hub-cyan)]" />
                Notizie
              </h2>
            </>
          )}
          <p className="text-sm text-[var(--hub-dim)] mt-1">
            {items.length > 0
              ? `${items.length} notizie da ${sourceCount} testate · aggiornamento automatico ogni 2 minuti`
              : 'Aggregazione notizie da ANSA e Google News'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SyncCountdown nextAt={nextRefreshAt} fetchedAt={fetchedAt} />
          <button type="button" onClick={refresh} className="hub-icon-btn" title="Aggiorna ora" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[var(--hub-cyan)]' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col @2xl:flex-row @2xl:items-center gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 [scrollbar-width:none]" role="group" aria-label="Filtra per categoria">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className="hub-chip"
              aria-pressed={filter === f}
              style={{ ['--chip-color' as any]: NEWS_CATEGORY_META[f].color }}
              onClick={() => setFilter(f)}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: NEWS_CATEGORY_META[f].color }} />
              {NEWS_CATEGORY_META[f].label}
            </button>
          ))}
        </div>
        <label className="@2xl:ml-auto flex items-center gap-2 h-9 px-3 rounded-xl border border-[var(--hub-line)] bg-[var(--hub-panel)] focus-within:border-[var(--hub-line-strong)] @2xl:w-64">
          <Search className="w-4 h-4 text-[var(--hub-dim)] shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtra titoli e testate…"
            className="w-full bg-transparent text-sm focus:outline-none placeholder:text-[var(--hub-dim)]"
          />
        </label>
      </div>

      {/* States */}
      {error && items.length === 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-[var(--hub-red)]/40 bg-[var(--hub-red)]/10 text-sm">
          <WifiOff className="w-5 h-5 text-[var(--hub-red)] shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Collegamento al feed non riuscito</div>
            <div className="text-[var(--hub-dim)]">{error}. Riprovo automaticamente al prossimo sync.</div>
          </div>
        </div>
      )}

      {isLoading && items.length === 0 && !error && (
        <div className="grid @3xl:grid-cols-12 gap-4" aria-busy="true">
          <div className="@3xl:col-span-7 hub-panel p-6 space-y-3">
            <div className="hub-skeleton h-3 w-32" />
            <div className="hub-skeleton h-8 w-full" />
            <div className="hub-skeleton h-8 w-4/5" />
            <div className="hub-skeleton h-4 w-2/3" />
          </div>
          <div className="@3xl:col-span-5 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="hub-panel p-4 space-y-2">
                <div className="hub-skeleton h-3 w-24" />
                <div className="hub-skeleton h-4 w-full" />
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && items.length > 0 && visible.length === 0 && (
        <div className="py-10 text-center text-sm text-[var(--hub-dim)]">
          <Newspaper className="w-8 h-8 mx-auto mb-2 opacity-60" />
          Nessuna notizia corrisponde a “{query}”.
        </div>
      )}

      {lead && (
        <>
          <div className="grid @3xl:grid-cols-12 gap-4">
            {/* Lead story */}
            <a
              href={lead.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`group @3xl:col-span-7 hub-panel p-5 @3xl:p-7 flex flex-col justify-between gap-6 overflow-hidden hover:border-[var(--hub-line-strong)] transition-colors ${
                freshIds.has(lead.id) ? 'hub-fresh' : ''
              }`}
            >
              {/* Oversized outlined category code as a HUD watermark */}
              <span
                aria-hidden
                className="absolute right-4 bottom-10 font-display font-bold text-[96px] @3xl:text-[128px] leading-none pointer-events-none select-none opacity-[0.07]"
                style={{ WebkitTextStroke: `2px ${NEWS_CATEGORY_META[lead.category].color}`, color: 'transparent' }}
              >
                {NEWS_CATEGORY_META[lead.category].short}
              </span>
              <div className="relative space-y-3">
                <div className="hub-label">In evidenza</div>
                <h3 className="font-display text-xl @3xl:text-3xl font-bold leading-tight group-hover:text-[var(--hub-cyan)] transition-colors">
                  {lead.title}
                </h3>
                {lead.summary && <p className="text-sm @3xl:text-base text-[var(--hub-dim)] max-w-prose">{lead.summary}</p>}
              </div>
              <div className="relative flex items-center justify-between gap-3">
                <StoryMeta item={lead} fresh={freshIds.has(lead.id)} />
                <ArrowUpRight className="w-5 h-5 shrink-0 text-[var(--hub-cyan)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </a>

            {/* Side stack */}
            <div className="@3xl:col-span-5 flex flex-col gap-3">
              {side.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group hub-panel p-4 flex-1 flex flex-col justify-between gap-2 hover:border-[var(--hub-line-strong)] transition-colors ${
                    freshIds.has(item.id) ? 'hub-fresh' : ''
                  }`}
                >
                  <h4 className="font-semibold text-sm leading-snug group-hover:text-[var(--hub-cyan)] transition-colors line-clamp-2">
                    {item.title}
                  </h4>
                  <StoryMeta item={item} fresh={freshIds.has(item.id)} />
                </a>
              ))}
            </div>
          </div>

          {/* Stream */}
          {stream.length > 0 && (
            <div>
              <div className="hub-label mb-3 flex items-center gap-3">
                Stream continuo
                <span className="flex-1 h-px bg-[var(--hub-line)]" />
                {stream.length} elementi
              </div>
              <ol className="grid @3xl:grid-cols-2 gap-x-6">
                {stream.map((item) => (
                  <li key={item.id} className="border-t border-[var(--hub-line)]">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group grid grid-cols-[56px_1fr] gap-3 py-3 rounded-lg ${freshIds.has(item.id) ? 'hub-fresh' : ''}`}
                    >
                      <time className="font-hud text-xs text-[var(--hub-dim)] pt-0.5 tabular-nums">
                        {new Date(item.publishedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </time>
                      <div className="space-y-1.5 min-w-0">
                        <div className="text-sm font-medium leading-snug group-hover:text-[var(--hub-cyan)] transition-colors">
                          {item.title}
                        </div>
                        <StoryMeta item={item} fresh={freshIds.has(item.id)} />
                      </div>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      <p className="hub-label !tracking-[0.1em] !normal-case pt-1">
        Fonti: ANSA · Google News. I titoli rimandano agli articoli originali delle testate.
      </p>
    </section>
  );
};

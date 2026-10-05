import React from 'react';
import { ArrowRight, SatelliteDish } from 'lucide-react';
import { useNewsFeed } from '../hooks/useNewsFeed';
import { timeAgo } from '../services/newsApi';

/** Compact meteo-news column for the main console; links into the full hub. */
export const NewsFeedPanel: React.FC<{ onOpenHub: () => void }> = ({ onOpenHub }) => {
  const { items, isLoading, error } = useNewsFeed('meteo', 180_000);
  const top = items.slice(0, 6);

  return (
    <section className="hub-panel hub-panel--glow p-5 h-full flex flex-col" aria-labelledby="news-panel-title">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <div className="hub-label flex items-center gap-2">
            <span className="hub-live-dot" /> Feed meteo live
          </div>
          <h3 id="news-panel-title" className="font-display text-lg font-bold mt-0.5 flex items-center gap-2">
            <SatelliteDish className="w-4 h-4 text-[var(--hub-cyan)]" /> Notizie dal territorio
          </h3>
        </div>
        <button type="button" onClick={onOpenHub} className="hub-icon-btn shrink-0">
          Hub <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {error && top.length === 0 && <p className="text-sm text-[var(--hub-dim)]">Feed non raggiungibile al momento.</p>}

      {isLoading && top.length === 0 && !error && (
        <div className="space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="hub-skeleton h-3 w-20" />
              <div className="hub-skeleton h-4 w-full" />
            </div>
          ))}
        </div>
      )}

      <ol className="flex-1 divide-y divide-[var(--hub-line)]">
        {top.map((item) => (
          <li key={item.id}>
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="group block py-2.5">
              <div className="font-hud text-xs text-[var(--hub-dim)] mb-0.5">
                {timeAgo(item.publishedAt)} · {item.source}
              </div>
              <div className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-[var(--hub-cyan)] transition-colors">
                {item.title}
              </div>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
};

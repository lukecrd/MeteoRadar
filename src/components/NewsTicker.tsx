import React from 'react';
import { useNewsFeed } from '../hooks/useNewsFeed';
import { NEWS_CATEGORY_META, NewsFilter, timeAgo } from '../services/newsApi';

interface NewsTickerProps {
  category?: NewsFilter;
  onOpenHub: () => void;
}

/** Thin always-on band of live headlines under the header. */
export const NewsTicker: React.FC<NewsTickerProps> = ({ category = 'meteo' as NewsFilter, onOpenHub }) => {
  const { items, error } = useNewsFeed(category, 180_000);
  const headlines = items.slice(0, 14);

  if (error && headlines.length === 0) return null;

  // The track is rendered twice so the -50% translate loops seamlessly.
  const renderRun = (copy: number) =>
    headlines.map((item) => (
      <a
        key={`${copy}-${item.id}`}
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={copy === 0 ? 0 : -1}
        aria-hidden={copy === 1 || undefined}
        className="flex items-center gap-2 px-5 text-xs whitespace-nowrap hover:text-[var(--hub-cyan)] transition-colors"
      >
        <span className="text-[var(--hub-cyan)] opacity-70">◆</span>
        <span className="font-hud text-[10px] text-[var(--hub-dim)]">{timeAgo(item.publishedAt)}</span>
        <span className="font-semibold">{item.title}</span>
        <span className="font-hud text-[10px] text-[var(--hub-dim)]">/ {item.source}</span>
      </a>
    ));

  return (
    <div className="hub-ticker relative z-30 border-b border-[var(--hub-line)] bg-[var(--hub-panel-strong)] backdrop-blur-xl">
      <div className="max-w-7xl mx-auto flex items-center h-9">
        <button
          type="button"
          onClick={onOpenHub}
          className="flex items-center gap-2 h-full pl-4 sm:pl-6 lg:pl-8 pr-3 shrink-0 border-r border-[var(--hub-line)] hub-label !text-[var(--hub-text)] hover:!text-[var(--hub-cyan)]"
          title="Apri il News Hub"
        >
          <span className="hub-live-dot" />
          Live · {NEWS_CATEGORY_META[category].short}
        </button>
        <div className="hub-ticker-mask flex-1 overflow-hidden h-full flex items-center">
          {headlines.length === 0 ? (
            <div className="hub-skeleton h-3 w-2/3 ml-5" />
          ) : (
            <div className="hub-ticker-track" style={{ ['--ticker-duration' as any]: `${headlines.length * 7}s` }}>
              {renderRun(0)}
              {renderRun(1)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

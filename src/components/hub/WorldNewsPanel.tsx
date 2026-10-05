import React, { useMemo } from 'react';
import { ArrowUpRight, Globe2, X } from 'lucide-react';
import type { GeoAreaNews, GeoNewsItem, GeoRegion } from '../../services/hubApi';
import { GEO_REGION_META } from '../../services/hubApi';
import { timeAgo } from '../../services/newsApi';
import { PanelHeader } from './HubWidgets';

interface WorldNewsPanelProps {
  areas: GeoAreaNews[];
  region: GeoRegion | 'all';
  selectedArea: GeoAreaNews | null;
  isLoading: boolean;
  error: string | null;
  onSelectArea: (areaId: string) => void;
  onClearArea: () => void;
}

const MAX_STREAM = 40;

export const WorldNewsPanel: React.FC<WorldNewsPanelProps> = ({ areas, region, selectedArea, isLoading, error, onSelectArea, onClearArea }) => {
  const areaById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);

  // Without a selected area: one merged, newest-first stream for the region.
  const items: GeoNewsItem[] = useMemo(() => {
    if (selectedArea) return selectedArea.items;
    const seen = new Set<string>();
    return areas
      .filter((a) => region === 'all' || a.region === region)
      .flatMap((a) => a.items)
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .filter((i) => (seen.has(i.title) ? false : (seen.add(i.title), true)))
      .slice(0, MAX_STREAM);
  }, [areas, region, selectedArea]);

  const accent = selectedArea ? GEO_REGION_META[selectedArea.region].color : GEO_REGION_META[region].color;

  return (
    <section className="hub-panel p-4 flex flex-col flex-1 min-w-0 min-h-0" aria-label="Notizie dal mondo">
      <PanelHeader
        code={selectedArea ? `MOD-00.A // ${GEO_REGION_META[selectedArea.region].label}` : 'MOD-00.A // Feed geolocalizzato'}
        title={selectedArea ? selectedArea.name : `Notizie · ${GEO_REGION_META[region].label}`}
        icon={<Globe2 className="w-4 h-4" style={{ color: accent }} />}
        right={
          selectedArea && (
            <button type="button" className="hub-icon-btn !h-8 !min-w-8 !p-0" onClick={onClearArea} aria-label="Torna a tutte le notizie">
              <X className="w-4 h-4" />
            </button>
          )
        }
      />

      {error && items.length === 0 && <div className="text-sm text-[var(--hub-red)] py-4">{error}</div>}

      <ol className="overflow-y-auto -mx-1 px-1 space-y-1 hub-scroll min-h-0 flex-1">
        {items.length === 0 && isLoading &&
          Array.from({ length: 7 }, (_, i) => <li key={i} className="hub-skeleton h-14" />)}
        {items.length === 0 && !isLoading && !error && (
          <li className="text-sm text-[var(--hub-dim)] py-6 text-center">Nessuna notizia recente per quest'area.</li>
        )}
        {items.map((item) => {
          const area = areaById.get(item.areaId);
          const color = area ? GEO_REGION_META[area.region].color : accent;
          return (
            <li key={`${item.areaId}-${item.id}`}>
              <div className="hub-row group rounded-lg px-2 py-2 flex gap-2.5">
                <span className="w-0.5 self-stretch rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-[var(--hub-dim)] mb-0.5">
                    {!selectedArea && area && (
                      <button
                        type="button"
                        onClick={() => onSelectArea(area.id)}
                        className="font-hud font-bold tracking-[0.12em] uppercase hover:underline"
                        style={{ color }}
                        title={`Mostra ${area.name} sul globo`}
                      >
                        {area.name}
                      </button>
                    )}
                    <span className="truncate">{item.source}</span>
                    <span aria-hidden>·</span>
                    <time className="font-hud shrink-0" dateTime={new Date(item.publishedAt).toISOString()}>
                      {timeAgo(item.publishedAt)}
                    </time>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] leading-snug font-medium hover:text-[var(--hub-cyan)] transition-colors line-clamp-3"
                  >
                    {item.title}
                    <ArrowUpRight className="inline w-3 h-3 ml-0.5 opacity-0 group-hover:opacity-70 transition-opacity" />
                  </a>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

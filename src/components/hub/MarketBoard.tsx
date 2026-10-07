import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { MarketQuote } from '../../services/hubApi';
import { formatPct, formatPrice, trendColor } from '../../services/hubApi';
import { timeAgo } from '../../services/newsApi';
import { Sparkline } from './HubWidgets';

const GROUPS: { id: MarketQuote['region']; label: string }[] = [
  { id: 'europa', label: 'Europa' },
  { id: 'americhe', label: 'Americhe' },
  { id: 'asia', label: 'Asia-Pacifico' },
  { id: 'global', label: 'Valute & materie prime' },
];

interface MarketBoardProps {
  quotes: MarketQuote[];
  isLoading: boolean;
  error: string | null;
  fetchedAt: number | null;
  onRefresh: () => void;
}

export const MarketBoard: React.FC<MarketBoardProps> = ({ quotes, isLoading, error, fetchedAt, onRefresh }) => {
  const openCount = quotes.filter((q) => q.kind === 'index' && q.isOpen).length;
  const indexCount = quotes.filter((q) => q.kind === 'index').length;

  return (
    <section className="flex flex-col min-w-0" aria-label="Borse mondiali">
      <div className="flex items-center justify-between gap-2 mb-2 font-hud text-xs text-[var(--hub-dim)]">
        <span>
          <span className="text-[var(--hub-text)] font-bold">{openCount}</span>/{indexCount} piazze aperte
        </span>
        <span className="flex items-center gap-2">
          {fetchedAt ? `agg. ${timeAgo(fetchedAt)}` : '—'} · ritardo fino a 15 min
          <button type="button" className="hub-icon-btn !h-8 !min-w-8 !p-0" onClick={onRefresh} aria-label="Aggiorna mercati" disabled={isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[var(--hub-cyan)]' : ''}`} />
          </button>
        </span>
      </div>
      {error && quotes.length === 0 && <div className="text-sm text-[var(--hub-red)] py-4">{error}</div>}

      <div className="space-y-3">
        {quotes.length === 0 && !error &&
          Array.from({ length: 8 }, (_, i) => <div key={i} className="hub-skeleton h-10" />)}
        {GROUPS.map(({ id, label }) => {
          const rows = quotes.filter((q) => q.region === id);
          if (!rows.length) return null;
          return (
            <div key={id}>
              <div className="hub-label mb-1">{label}</div>
              <ul className="space-y-0.5">
                {rows.map((q) => {
                  return (
                    <li key={q.symbol}>
                      <div
                        className="hub-row w-full grid grid-cols-[minmax(0,1fr)_auto_64px] items-center gap-2 px-2 py-1.5 rounded-lg"
                        title={q.city ? `${q.name} · ${q.city}` : q.name}
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            {q.kind === 'index' && (
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: q.isOpen ? '#34d399' : 'var(--hub-line-strong)', boxShadow: q.isOpen ? '0 0 6px #34d399' : undefined }}
                                title={q.isOpen ? 'Mercato aperto' : 'Mercato chiuso'}
                              />
                            )}
                            <span className="font-hud text-xs font-bold truncate">{q.short}</span>
                          </span>
                          <span className="block text-xs text-[var(--hub-dim)] truncate">{q.name}</span>
                        </span>
                        <span className="text-right">
                          <span className="block font-hud text-xs font-semibold tabular-nums">{formatPrice(q.price)}</span>
                          <span className="block font-hud text-xs font-bold tabular-nums" style={{ color: trendColor(q.changePct) }}>
                            {formatPct(q.changePct)}
                          </span>
                        </span>
                        <Sparkline values={q.spark} width={64} height={22} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
};

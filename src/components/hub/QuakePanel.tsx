import React, { useMemo } from 'react';
import { Activity, ArrowUpRight, Waves } from 'lucide-react';
import type { Quake } from '../../services/hubApi';
import { formatNumber, quakeColor } from '../../services/hubApi';
import { timeAgo } from '../../services/newsApi';
import { PanelHeader } from './HubWidgets';

export type QuakeWindow = '24h' | '7d';
export const QUAKE_MIN_MAGS = [0, 4, 5] as const;
export type QuakeMinMag = (typeof QUAKE_MIN_MAGS)[number];

export const quakeMarkerId = (id: string) => `quake:${id}`;

/** INGV covers Italy and the central Mediterranean: a handy proxy for "Italia e dintorni". */
const isItalian = (q: Quake) => q.source === 'INGV';

interface QuakePanelProps {
  quakes: Quake[];
  window: QuakeWindow;
  minMag: QuakeMinMag;
  onWindowChange: (w: QuakeWindow) => void;
  onMinMagChange: (m: QuakeMinMag) => void;
  selectedId: string | null;
  onSelect: (q: Quake) => void;
  isLoading: boolean;
  error: string | null;
}

export const QuakePanel: React.FC<QuakePanelProps> = ({
  quakes,
  window: win,
  minMag,
  onWindowChange,
  onMinMagChange,
  selectedId,
  onSelect,
  isLoading,
  error,
}) => {
  const strongest = useMemo(() => {
    let best: Quake | null = null;
    for (const q of quakes) if (!best || q.mag > best.mag) best = q;
    return best;
  }, [quakes]);
  const italian = quakes.filter(isItalian).length;

  return (
    <section className="hub-panel p-4 flex flex-col flex-1 min-w-0 min-h-0" aria-label="Terremoti">
      <PanelHeader
        code="MOD-00.C // Sismica"
        title="Terremoti"
        icon={<Activity className="w-4 h-4 text-[#f97316]" />}
        right={
          <div className="flex gap-1" role="group" aria-label="Periodo">
            {(['24h', '7d'] as QuakeWindow[]).map((w) => (
              <button key={w} type="button" className="hub-chip !h-7 !px-2.5" aria-pressed={win === w} onClick={() => onWindowChange(w)}>
                {w === '24h' ? '24 ore' : '7 giorni'}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-xl border border-[var(--hub-line)] px-3 py-2">
          <div className="hub-label">Eventi</div>
          <div className="font-hud text-xl font-bold tabular-nums">{quakes.length}</div>
        </div>
        <div className="rounded-xl border border-[var(--hub-line)] px-3 py-2 min-w-0">
          <div className="hub-label">Più forte</div>
          <div className="font-hud text-xl font-bold tabular-nums" style={{ color: strongest ? quakeColor(strongest.mag) : undefined }}>
            {strongest ? `M${formatNumber(strongest.mag, 1)}` : '—'}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--hub-line)] px-3 py-2">
          <div className="hub-label">Italia (INGV)</div>
          <div className="font-hud text-xl font-bold tabular-nums">{italian}</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-2" role="group" aria-label="Magnitudo minima">
        <span className="hub-label mr-1">Magnitudo</span>
        {QUAKE_MIN_MAGS.map((m) => (
          <button
            key={m}
            type="button"
            className="hub-chip !h-7 !px-2.5"
            aria-pressed={minMag === m}
            style={{ ['--chip-color' as any]: m ? quakeColor(m) : undefined }}
            onClick={() => onMinMagChange(m)}
          >
            {m ? `≥ ${m}` : 'Tutte'}
          </button>
        ))}
      </div>

      {error && quakes.length === 0 && <div className="text-sm text-[var(--hub-red)] py-4">{error}</div>}

      <ol className="overflow-y-auto -mx-1 px-1 space-y-1 hub-scroll min-h-0 flex-1">
        {quakes.length === 0 && isLoading && Array.from({ length: 6 }, (_, i) => <li key={i} className="hub-skeleton h-12" />)}
        {quakes.length === 0 && !isLoading && !error && (
          <li className="text-sm text-[var(--hub-dim)] py-6 text-center">Nessun evento con questi filtri.</li>
        )}
        {quakes.map((q) => {
          const color = quakeColor(q.mag);
          const isSel = selectedId === quakeMarkerId(q.id);
          return (
            <li key={q.id}>
              <div className={`hub-row group rounded-lg px-2 py-1.5 flex items-center gap-3 ${isSel ? 'is-selected' : ''}`}>
                <button type="button" onClick={() => onSelect(q)} className="flex items-center gap-3 flex-1 min-w-0 text-left" title="Mostra sul globo">
                  <span
                    className="w-11 h-11 shrink-0 rounded-xl grid place-items-center font-hud text-sm font-bold"
                    style={{ color, background: `${color}1f`, border: `1px solid ${color}66`, boxShadow: q.mag >= 5 ? `0 0 16px -4px ${color}` : undefined }}
                  >
                    {formatNumber(q.mag, 1)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium leading-snug truncate">{q.place}</span>
                    <span className="flex items-center gap-1.5 font-hud text-[10px] text-[var(--hub-dim)]">
                      <time dateTime={new Date(q.time).toISOString()}>{timeAgo(q.time)}</time>
                      <span aria-hidden>·</span>
                      <span>prof. {formatNumber(q.depthKm, q.depthKm < 10 ? 1 : 0)} km</span>
                      <span aria-hidden>·</span>
                      <span>{q.source}</span>
                      {q.tsunami && (
                        <span className="flex items-center gap-0.5 text-[#38bdf8] font-bold" title="USGS ha pubblicato informazioni sul rischio tsunami per questo evento">
                          <Waves className="w-3 h-3" /> INFO TSUNAMI
                        </span>
                      )}
                    </span>
                  </span>
                </button>
                <a
                  href={q.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hub-icon-btn !h-7 !min-w-7 !p-0 opacity-60 group-hover:opacity-100"
                  aria-label={`Scheda ${q.source} dell'evento`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

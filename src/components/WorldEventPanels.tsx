import React, { useMemo, useState } from 'react';
import { AlertTriangle, CloudLightning, ExternalLink, Loader2, MapPin, Plane, RefreshCw, Satellite, Search, ShieldAlert } from 'lucide-react';
import type { SatelliteState } from '../hooks/useSatellites';
import { LightningStrike, WeatherAlertInfo } from '../types';
import { timeAgo } from '../services/newsApi';
import {
  DISASTER_LABEL,
  Disaster,
  Earthquake,
  FeedResponse,
  FlightsResponse,
  GDACS_LEVEL_COLOR,
  ISS_NORAD,
  SATELLITE_GROUP_META,
  SatelliteGroup,
  SatellitesResponse,
  quakeColor,
  quakeTextColor,
} from '../services/worldEventsApi';

/** Shared status line: loading, upstream error / stale copy, last update. */
export const FeedStatus: React.FC<{
  isLoading: boolean;
  error: string | null;
  feed: { fetchedAt: number; stale: boolean; error: string | null; items: unknown[] } | null;
  source: string;
  onRetry?: () => void;
  /** Shown while the first load is still running */
  loadingHint?: string;
}> = ({ isLoading, error, feed, source, onRetry, loadingHint }) => {
  const problem = error || feed?.error;
  return (
    <div className="space-y-2 mb-3">
      <div className="hub-label flex items-center gap-2 !normal-case !tracking-[0.08em]">
        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="hub-live-dot" />}
        {source}
        {feed && !isLoading && <span className="opacity-70">· aggiornato {timeAgo(feed.fetchedAt)}</span>}
      </div>
      {problem && (
        <div role="status" className="flex items-start gap-2 p-2.5 rounded-lg border border-[var(--hub-red)]/40 bg-[var(--hub-red)]/10 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 text-[var(--hub-red)] shrink-0 mt-0.5" />
          <span className="flex-1">
            {problem}
            {feed?.stale && feed.items.length > 0 ? ' — mostro gli ultimi dati disponibili.' : ''}
          </span>
          {onRetry && (
            <button type="button" onClick={onRetry} disabled={isLoading} className="hub-icon-btn !h-7 !px-2 text-xs shrink-0">
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} /> Riprova
            </button>
          )}
        </div>
      )}
      {isLoading && !feed && !problem && loadingHint && <p className="text-xs text-[var(--hub-dim)]">{loadingHint}</p>}
    </div>
  );
};

interface ItemButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}
const ItemButton: React.FC<ItemButtonProps> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`w-full text-left flex items-start gap-3 py-2.5 px-2 -mx-2 rounded-lg transition-colors hover:bg-[var(--hub-glow)] ${
      active ? 'bg-[var(--hub-glow)] ring-1 ring-[var(--hub-line-strong)]' : ''
    }`}
  >
    {children}
  </button>
);

export const QuakesList: React.FC<{
  feed: FeedResponse<Earthquake> | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  activeId: string | null;
  onFocus: (q: Earthquake) => void;
}> = ({ feed, isLoading, error, onRetry, activeId, onFocus }) => {
  const items: Earthquake[] = feed?.items ?? [];
  const strongest = items.reduce<Earthquake | null>((m, q) => (!m || q.mag > m.mag ? q : m), null);
  return (
    <div>
      <FeedStatus isLoading={isLoading} error={error} feed={feed} source="USGS + INGV · M2.5+ 24 h, M4.5+ 7 gg, Italia M2+ 7 gg" onRetry={onRetry} />
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-lg border border-[var(--hub-line)] p-2.5">
            <div className="hub-label">Eventi</div>
            <div className="font-hud text-lg font-semibold">{items.length}</div>
          </div>
          <div className="rounded-lg border border-[var(--hub-line)] p-2.5">
            <div className="hub-label">Max magnitudo</div>
            <div className="font-hud text-lg font-semibold" style={{ color: strongest ? quakeColor(strongest.mag) : undefined }}>
              {strongest ? `M ${strongest.mag.toFixed(1)}` : '—'}
            </div>
          </div>
        </div>
      )}
      {!isLoading && items.length === 0 && !error && !feed?.error && <p className="text-sm text-[var(--hub-dim)]">Nessun terremoto recente.</p>}
      <ol className="divide-y divide-[var(--hub-line)]">
        {items.slice(0, 150).map((q) => (
          <li key={q.id}>
            <ItemButton active={activeId === `q:${q.id}`} onClick={() => onFocus(q)}>
              <span
                className="font-hud text-xs font-bold w-12 shrink-0 text-center rounded py-1"
                style={{ color: quakeTextColor(q.mag), background: quakeColor(q.mag) }}
              >
                {q.mag.toFixed(1)}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-snug">{q.place}</span>
                <span className="block font-hud text-xs text-[var(--hub-dim)] mt-0.5">
                  {timeAgo(q.time)} · prof. {q.depthKm} km{q.source ? ` · ${q.source}` : ''}{q.tsunami ? ' · TSUNAMI' : ''}
                </span>
              </span>
            </ItemButton>
          </li>
        ))}
      </ol>
    </div>
  );
};

export const FlightsList: React.FC<{
  feed: FlightsResponse | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  /** Flight-number search box rendered above the stats */
  search?: React.ReactNode;
  activeId: string | null;
  onFocus: (f: FlightsResponse['items'][number]) => void;
}> = ({ feed, isLoading, error, onRetry, search, activeId, onFocus }) => {
  const items = feed?.items ?? [];
  const max = feed?.topCountries[0]?.count || 1;
  return (
    <div>
      {search && <div className="mb-4">{search}</div>}
      <FeedStatus isLoading={isLoading} error={error} feed={feed} source="OpenSky Network · ADS-B" onRetry={onRetry} />
      {feed && feed.totalAirborne > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-lg border border-[var(--hub-line)] p-2.5">
              <div className="hub-label">In volo ora</div>
              <div className="font-hud text-lg font-semibold">{feed.totalAirborne.toLocaleString('it-IT')}</div>
            </div>
            <div className="rounded-lg border border-[var(--hub-line)] p-2.5">
              <div className="hub-label">Sul globo</div>
              <div className="font-hud text-lg font-semibold">{items.length}</div>
            </div>
          </div>
          <div className="hub-label mb-2">Paese di registrazione</div>
          <ul className="space-y-1.5 mb-4">
            {feed.topCountries.map((c) => (
              <li key={c.country} className="text-xs">
                <div className="flex justify-between gap-2">
                  <span className="truncate">{c.country}</span>
                  <span className="font-hud tabular-nums">{c.count}</span>
                </div>
                <div className="h-1 rounded bg-[var(--hub-line)] mt-1">
                  <div className="h-1 rounded bg-[var(--hub-cyan)]" style={{ width: `${(c.count / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <div className="hub-label mb-1">Campione di voli</div>
        </>
      )}
      <ol className="divide-y divide-[var(--hub-line)]">
        {items.slice(0, 40).map((f) => (
          <li key={f.id}>
            <ItemButton active={activeId === `f:${f.id}`} onClick={() => onFocus(f)}>
              <Plane className="w-4 h-4 mt-0.5 shrink-0 text-[var(--hub-cyan)]" style={{ transform: `rotate(${(f.heading ?? 45) - 45}deg)` }} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold font-hud">{f.callsign}</span>
                <span className="block text-xs text-[var(--hub-dim)]">
                  {f.country}
                  {f.altitudeM != null ? ` · ${f.altitudeM.toLocaleString('it-IT')} m` : ''}
                  {f.speedKmh != null ? ` · ${f.speedKmh} km/h` : ''}
                </span>
              </span>
            </ItemButton>
          </li>
        ))}
      </ol>
    </div>
  );
};

const LOCAL_LEVEL_COLOR: Record<WeatherAlertInfo['level'], string> = {
  green: '#4ade80',
  yellow: '#facc15',
  orange: '#fb923c',
  red: '#ef4444',
};

export const AlertsList: React.FC<{
  feed: FeedResponse<Disaster> | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  activeId: string | null;
  locationName: string;
  localAlerts: WeatherAlertInfo[];
  strikes: LightningStrike[];
  onFocusDisaster: (d: Disaster) => void;
  onFocusLocal: (id: string) => void;
  onFocusStrike: (s: LightningStrike) => void;
}> = ({ feed, isLoading, error, onRetry, activeId, locationName, localAlerts, strikes, onFocusDisaster, onFocusLocal, onFocusStrike }) => {
  const items = feed?.items ?? [];
  return (
    <div className="space-y-5">
      <section aria-labelledby="alerts-local-title">
        <div id="alerts-local-title" className="hub-label mb-1 flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5" /> Meteo · {locationName}
        </div>
        {localAlerts.length === 0 ? (
          <p className="text-sm text-[var(--hub-dim)] py-1">Nessuna allerta meteo ufficiale attiva.</p>
        ) : (
          <ul>
            {localAlerts.map((a) => (
              <li key={a.id}>
                <ItemButton active={activeId === `w:${a.id}`} onClick={() => onFocusLocal(a.id)}>
                  <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" style={{ color: LOCAL_LEVEL_COLOR[a.level] }} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-snug">{a.title}</span>
                    <span className="block text-xs text-[var(--hub-dim)] line-clamp-2">{a.description}</span>
                  </span>
                </ItemButton>
              </li>
            ))}
          </ul>
        )}
        {strikes.length > 0 && (
          <ul className="mt-1">
            {strikes.slice(0, 4).map((s) => (
              <li key={s.id}>
                <ItemButton active={activeId === `l:${s.id}`} onClick={() => onFocusStrike(s)}>
                  <CloudLightning className="w-4 h-4 mt-0.5 shrink-0" style={{ color: LOCAL_LEVEL_COLOR[s.severityZone] }} />
                  <span className="text-sm">
                    Fulmine {s.type} {s.polarity} a {s.distanceKm.toFixed(1)} km
                    <span className="block font-hud text-xs text-[var(--hub-dim)]">{timeAgo(s.timestamp)}</span>
                  </span>
                </ItemButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="alerts-global-title">
        <div id="alerts-global-title" className="hub-label mb-1">Disastri nel mondo</div>
        <FeedStatus isLoading={isLoading} error={error} feed={feed} source="GDACS · ONU / Commissione UE" onRetry={onRetry} />
        {!isLoading && items.length === 0 && !error && !feed?.error && <p className="text-sm text-[var(--hub-dim)]">Nessun evento in corso.</p>}
        <ol className="divide-y divide-[var(--hub-line)]">
          {items.map((d) => (
            <li key={d.id}>
              <ItemButton active={activeId === `d:${d.id}`} onClick={() => onFocusDisaster(d)}>
                <span
                  className="font-hud text-xs font-bold w-10 shrink-0 text-center rounded py-1"
                  style={{ color: '#0b1220', background: GDACS_LEVEL_COLOR[d.alertLevel] ?? '#94a3b8' }}
                >
                  {d.type}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-snug">{d.name}</span>
                  <span className="block font-hud text-xs text-[var(--hub-dim)] mt-0.5">
                    {DISASTER_LABEL[d.type] ?? d.type} · allerta {d.alertLevel.toLowerCase()}
                    {d.to ? ` · agg. ${timeAgo(Math.min(d.to, Date.now()))}` : ''}
                  </span>
                </span>
              </ItemButton>
              {activeId === `d:${d.id}` && d.url && (
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--hub-cyan)] mb-2 ml-12">
                  Rapporto GDACS <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
};

export const SatellitesList: React.FC<{
  feed: SatellitesResponse | null;
  isLoading: boolean;
  error: string | null;
  states: SatelliteState[];
  group: SatelliteGroup;
  onGroupChange: (g: SatelliteGroup) => void;
  onRetry?: () => void;
  activeId: string | null;
  onFocus: (s: SatelliteState) => void;
}> = ({ feed, isLoading, error, states, group, onGroupChange, onRetry, activeId, onFocus }) => {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const list = q ? states.filter((s) => s.name.toLowerCase().includes(q) || String(s.norad).includes(q)) : states;
    // ISS first, then the selected one, then alphabetical.
    return [...list].sort((a, b) => Number(b.norad === ISS_NORAD) - Number(a.norad === ISS_NORAD) || a.name.localeCompare(b.name));
  }, [states, q]);
  const shown = filtered.slice(0, 60);
  const active = activeId?.startsWith('s:') ? states.find((s) => `s:${s.norad}` === activeId) : null;
  const visible = active && !shown.includes(active) ? [active, ...shown] : shown;

  return (
    <div>
      <label className="block mb-3">
        <span className="hub-label">Gruppo CelesTrak</span>
        <select
          value={group}
          onChange={(e) => onGroupChange(e.target.value as SatelliteGroup)}
          className="mt-1 w-full h-9 px-2 rounded-lg border border-[var(--hub-line)] bg-[var(--hub-panel-strong)] text-sm"
        >
          {SATELLITE_GROUP_META.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
      </label>
      <FeedStatus isLoading={isLoading} error={error} feed={feed} source="CelesTrak GP · SGP4 live"
        onRetry={onRetry}
        loadingHint="Download dei TLE da CelesTrak: il primo caricamento di un gruppo può richiedere fino a 25 s."
      />
      {feed && feed.total > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-lg border border-[var(--hub-line)] p-2.5">
            <div className="hub-label">Nel gruppo</div>
            <div className="font-hud text-lg font-semibold">{feed.total.toLocaleString('it-IT')}</div>
          </div>
          <div className="rounded-lg border border-[var(--hub-line)] p-2.5">
            <div className="hub-label">Sul globo</div>
            <div className="font-hud text-lg font-semibold">{states.length.toLocaleString('it-IT')}</div>
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 h-9 px-3 mb-2 rounded-lg border border-[var(--hub-line)] bg-[var(--hub-panel)] focus-within:border-[var(--hub-line-strong)]">
        <Search className="w-4 h-4 text-[var(--hub-dim)] shrink-0" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nome o NORAD…"
          aria-label="Filtra satelliti"
          className="w-full bg-transparent text-sm focus:outline-none placeholder:text-[var(--hub-dim)]"
        />
      </label>
      {filtered.length > shown.length && (
        <p className="hub-label !normal-case !tracking-[0.06em] mb-1">
          {shown.length} di {filtered.length.toLocaleString('it-IT')} · affina la ricerca
        </p>
      )}
      {!isLoading && states.length > 0 && filtered.length === 0 && <p className="text-sm text-[var(--hub-dim)]">Nessun satellite corrisponde.</p>}
      <ol className="divide-y divide-[var(--hub-line)]">
        {visible.map((s) => (
          <li key={s.norad}>
            <ItemButton active={activeId === `s:${s.norad}`} onClick={() => onFocus(s)}>
              <Satellite className="w-4 h-4 mt-0.5 shrink-0" style={{ color: s.norad === ISS_NORAD ? 'var(--hub-amber)' : 'var(--hub-violet)' }} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-snug truncate">{s.name}</span>
                <span className="block font-hud text-xs text-[var(--hub-dim)] mt-0.5 tabular-nums">
                  NORAD {s.norad} · {Math.round(s.altKm).toLocaleString('it-IT')} km · {s.speedKms.toFixed(2)} km/s
                </span>
                <span className="block font-hud text-xs text-[var(--hub-dim)] tabular-nums">
                  {s.lat.toFixed(2)}°, {s.lon.toFixed(2)}°
                </span>
              </span>
            </ItemButton>
          </li>
        ))}
      </ol>
    </div>
  );
};

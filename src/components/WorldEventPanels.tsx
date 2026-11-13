import React, { useMemo, useState } from 'react';
import { AlertTriangle, CloudLightning, ExternalLink, Flame, Loader2, MapPin, Mountain, Plane, RefreshCw, Satellite, Search, ShieldAlert } from 'lucide-react';
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
  VOLCANO_ALERT_COLOR,
  Volcano,
  quakeColor,
  quakeTextColor,
} from '../services/worldEventsApi';
import { classifyFlight } from '../services/flightClassifier';

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
      <div className="hub-label flex items-center gap-2">
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

/** Headline figures for a feed: plain label/value pairs, no boxes. */
const Stats: React.FC<{ items: { label: string; value: React.ReactNode }[] }> = ({ items }) => (
  <dl className="flex gap-8 mb-4">
    {items.map((s) => (
      <div key={s.label}>
        <dt className="hub-label">{s.label}</dt>
        <dd className="text-2xl font-semibold tabular-nums leading-tight">
          {s.value}
        </dd>
      </div>
    ))}
  </dl>
);

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
        <Stats
          items={[
            { label: 'Eventi', value: items.length },
            // No scale colour here: the deep reds fail contrast on the dark panel.
            { label: 'Magnitudo massima', value: strongest ? strongest.mag.toFixed(1) : '—' },
          ]}
        />
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
  filteredItems?: FlightsResponse['items'];
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  /** Flight-number search box and filters rendered above the stats */
  search?: React.ReactNode;
  activeId: string | null;
  onFocus: (f: FlightsResponse['items'][number]) => void;
}> = ({ feed, filteredItems, isLoading, error, onRetry, search, activeId, onFocus }) => {
  const rawItems = feed?.items ?? [];
  const items = filteredItems ?? rawItems;
  const max = feed?.topCountries[0]?.count || 1;
  return (
    <div>
      {search && <div className="mb-4">{search}</div>}
      <FeedStatus isLoading={isLoading} error={error} feed={feed} source={feed?.source && feed.source !== 'OpenSky Network' ? `${feed.source} · ADS-B, principali spazi aerei` : 'OpenSky Network · ADS-B'} onRetry={onRetry} />
      {feed && feed.totalAirborne > 0 && (
        <>
          <Stats
            items={[
              { label: 'In volo ora', value: feed.totalAirborne.toLocaleString('it-IT') },
              { label: filteredItems && filteredItems.length !== rawItems.length ? 'Filtrati sul globo' : 'Sul globo', value: items.length },
            ]}
          />
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
          <div className="hub-label mb-1">
            Voli attivi ({items.length})
          </div>
        </>
      )}
      {items.length === 0 && !isLoading && (
        <p className="text-xs text-[var(--hub-dim)] py-2">
          Nessun volo corrisponde ai filtri di quota, compagnia o tipo aeromobile selezionati.
        </p>
      )}
      <ol className="divide-y divide-[var(--hub-line)]">
        {items.slice(0, 50).map((f) => {
          const meta = classifyFlight(f);
          return (
            <li key={f.id}>
              <ItemButton active={activeId === `f:${f.id}`} onClick={() => onFocus(f)}>
                <Plane className="w-4 h-4 mt-0.5 shrink-0 text-[var(--hub-cyan)]" style={{ transform: `rotate(${(f.heading ?? 45) - 45}deg)` }} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold font-hud">{f.callsign}</span>
                    {meta.airlineName && (
                      <span className="text-xs font-medium text-[var(--hub-text)]">· {meta.airlineName}</span>
                    )}
                  </span>
                  <span className="block text-xs text-[var(--hub-dim)]">
                    {meta.aircraftLabel} · {meta.categoryLabel}
                    {f.country ? ` · ${f.country}` : ''}
                    {f.altitudeM != null ? ` · ${f.altitudeM.toLocaleString('it-IT')} m` : ''}
                    {f.speedKmh != null ? ` · ${f.speedKmh} km/h` : ''}
                  </span>
                </span>
              </ItemButton>
            </li>
          );
        })}
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
        <Stats
          items={[
            { label: 'Nel gruppo', value: feed.total.toLocaleString('it-IT') },
            { label: 'Sul globo', value: states.length.toLocaleString('it-IT') },
          ]}
        />
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
        <p className="hub-label mb-1">
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

const VOLCANO_STATUS_LABEL: Record<Volcano['status'], string> = {
  erupting: 'ERUZIONE ATTIVA',
  unrest: 'AGITAZIONE',
  advisory: 'SORVEGLIANZA',
  normal: 'QUIESCENZA',
};

type VolcanoFilter = 'all' | 'italia' | 'erupting' | 'swarm';

export const VolcanoesList: React.FC<{
  feed: FeedResponse<Volcano> | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  activeId: string | null;
  onFocus: (v: Volcano) => void;
}> = ({ feed, isLoading, error, onRetry, activeId, onFocus }) => {
  const [filter, setFilter] = useState<VolcanoFilter>('all');
  const allItems = feed?.items ?? [];

  const items = useMemo(() => {
    if (filter === 'italia') return allItems.filter((v) => v.country === 'Italia');
    if (filter === 'erupting') return allItems.filter((v) => v.status === 'erupting');
    if (filter === 'swarm') return allItems.filter((v) => v.seismicCount7d > 0);
    return allItems;
  }, [allItems, filter]);

  const eruptingCount = allItems.filter((v) => v.status === 'erupting').length;
  const totalSwarmQuakes = allItems.reduce((acc, v) => acc + v.seismicCount7d, 0);

  const selectedVolcano = useMemo(() => {
    if (activeId?.startsWith('v:')) {
      const id = activeId.slice(2);
      const found = allItems.find((v) => v.id === id);
      if (found) return found;
    }
    return items[0] ?? allItems[0] ?? null;
  }, [activeId, items, allItems]);

  return (
    <div className="space-y-3">
      <FeedStatus
        isLoading={isLoading}
        error={error}
        feed={feed}
        source="INGV + USGS + Smithsonian GVP · Sismi 38 km"
        onRetry={onRetry}
      />

      {allItems.length > 0 && (
        <dl className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg border border-[var(--hub-line)] bg-[var(--hub-panel)]">
            <dt className="hub-label !text-[10px]">Monitorati</dt>
            <dd className="text-lg font-bold font-hud tabular-nums">{allItems.length}</dd>
          </div>
          <div className="p-2 rounded-lg border border-[var(--hub-line)] bg-[var(--hub-panel)]">
            <dt className="hub-label !text-[10px]">In eruzione</dt>
            <dd className="text-lg font-bold font-hud tabular-nums text-[#ff6b2b]">{eruptingCount}</dd>
          </div>
          <div className="p-2 rounded-lg border border-[var(--hub-line)] bg-[var(--hub-panel)]">
            <dt className="hub-label !text-[10px]">Sismi cratere</dt>
            <dd className="text-lg font-bold font-hud tabular-nums text-[#facc15]">{totalSwarmQuakes}</dd>
          </div>
        </dl>
      )}

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1" role="group" aria-label="Filtra vulcani">
        {([
          { id: 'all', label: 'Tutti' },
          { id: 'italia', label: 'Italia (INGV)' },
          { id: 'erupting', label: 'In Eruzione' },
          { id: 'swarm', label: 'Con Sciame' },
        ] as const).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            aria-pressed={filter === t.id}
            style={{ ['--chip-color' as any]: '#ff5722' }}
            className="hub-chip !h-7 !px-2.5 !text-xs"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 3D Isometric Volcanic Edifice & Magma Conduit Cross-Section */}
      {selectedVolcano && (
        <div className="p-2.5 rounded-xl border border-[#ff5722]/35 bg-black/35 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-hud uppercase tracking-wider text-[#ff6b2b] flex items-center gap-1">
                <Flame className="w-3 h-3 shrink-0" /> Spaccato 3D Condotto & Sismicità
              </div>
              <div className="text-xs font-bold truncate">{selectedVolcano.name} · {selectedVolcano.region}</div>
            </div>
            <span
              className="font-hud text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
              style={{
                background: `${VOLCANO_ALERT_COLOR[selectedVolcano.alertColor]}25`,
                color: VOLCANO_ALERT_COLOR[selectedVolcano.alertColor],
                border: `1px solid ${VOLCANO_ALERT_COLOR[selectedVolcano.alertColor]}66`,
              }}
            >
              {VOLCANO_STATUS_LABEL[selectedVolcano.status]}
            </span>
          </div>

          <svg viewBox="0 0 260 118" className="w-full h-auto rounded-lg bg-slate-950/75 border border-white/10">
            <defs>
              <linearGradient id="volc-cone-3d" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#475569" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient id="volc-magma" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#ff2a55" />
                <stop offset="60%" stopColor="#ff6b2b" />
                <stop offset="100%" stopColor="#facc15" />
              </linearGradient>
              <radialGradient id="volc-chamber" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ff3b5c" stopOpacity="0.9" />
                <stop offset="60%" stopColor="#ff6b2b" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#ff6b2b" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Isometric Crustal Base Plane (0 km sea level) */}
            <polygon
              points="18,74 130,54 242,74 130,94"
              fill="rgba(30,41,59,0.55)"
              stroke="rgba(148,163,184,0.35)"
              strokeWidth="1"
            />
            {/* Deep Lithosphere Plane (-10 km) */}
            <polygon
              points="18,98 130,78 242,98 130,116"
              fill="rgba(255,59,92,0.12)"
              stroke="rgba(255,107,43,0.4)"
              strokeWidth="1"
            />

            {/* 3D Volcanic Cone Left & Right Isometric Faces */}
            <polygon
              points="55,74 118,28 130,31 130,84"
              fill="url(#volc-cone-3d)"
              stroke="rgba(148,163,184,0.4)"
              strokeWidth="0.8"
            />
            <polygon
              points="205,74 142,28 130,31 130,84"
              fill="rgba(15,23,42,0.9)"
              stroke="rgba(148,163,184,0.3)"
              strokeWidth="0.8"
            />

            {/* Deep Magma Chamber + Vertical Conduit */}
            <ellipse cx="130" cy="98" rx="34" ry="11" fill="url(#volc-chamber)" />
            <path
              d="M126,98 L128,29 L132,29 L134,98 Z"
              fill="url(#volc-magma)"
              opacity={selectedVolcano.status === 'erupting' ? 0.95 : 0.6}
            />

            {/* Crater Rim 3D Ellipse */}
            <ellipse
              cx="130"
              cy="28"
              rx="12"
              ry="3.8"
              fill={selectedVolcano.status === 'erupting' ? '#ff5722' : '#334155'}
              stroke={VOLCANO_ALERT_COLOR[selectedVolcano.alertColor]}
              strokeWidth="1.2"
            />

            {/* Plume / Fumarole above Crater */}
            {selectedVolcano.status === 'erupting' ? (
              <g>
                <circle cx="130" cy="18" r="7" fill="rgba(255,107,43,0.45)" />
                <circle cx="124" cy="11" r="9" fill="rgba(148,163,184,0.35)" />
                <circle cx="137" cy="9" r="8" fill="rgba(255,59,92,0.32)" />
              </g>
            ) : (
              <g>
                <circle cx="130" cy="19" r="5" fill="rgba(226,232,240,0.22)" />
                <circle cx="135" cy="12" r="6" fill="rgba(226,232,240,0.14)" />
              </g>
            )}

            {/* Plot real nearby earthquakes inside the 3D crustal block */}
            {selectedVolcano.nearbyQuakes.map((q, idx) => {
              const offsetX = ((idx % 2 === 0 ? -1 : 1) * (8 + idx * 7));
              const qx = Math.max(40, Math.min(220, 130 + offsetX));
              const qy = Math.min(110, Math.max(48, 66 + Math.min(30, q.depthKm * 2.2)));
              return (
                <g key={q.id}>
                  <circle cx={qx} cy={qy} r={Math.max(2.5, q.mag * 1.3)} fill="#facc15" stroke="#fff" strokeWidth="0.6" />
                  <circle cx={qx} cy={qy} r={Math.max(5, q.mag * 2.4)} fill="none" stroke="#facc15" strokeWidth="0.6" opacity="0.55" />
                </g>
              );
            })}

            {/* Labels */}
            <text x="10" y="16" fill="#e2e8f0" fontSize="8.5" fontWeight="700">
              Quota: {selectedVolcano.elevationM >= 0 ? `${selectedVolcano.elevationM} m` : `${selectedVolcano.elevationM} m (sottomarino)`}
            </text>
            <text x="10" y="27" fill="#94a3b8" fontSize="7.5">
              Magma: {selectedVolcano.magmaType}
            </text>
            <text x="250" y="16" textAnchor="end" fill="#facc15" fontSize="8.5" fontWeight="700">
              {selectedVolcano.seismicCount7d} sismi (raggio 38 km)
            </text>
            <text x="250" y="27" textAnchor="end" fill="#94a3b8" fontSize="7.5">
              {selectedVolcano.maxMag7d != null ? `Max M ${selectedVolcano.maxMag7d.toFixed(1)}` : 'Nessuno sciame > M2'}
            </text>
          </svg>

          <p className="text-[11px] text-[var(--hub-dim)] leading-snug">{selectedVolcano.activitySummary}</p>

          <div className="flex items-center justify-between gap-2 text-[11px] pt-1 border-t border-white/10">
            <span className="text-[var(--hub-dim)] truncate">Ente: <strong className="text-[var(--hub-text)]">{selectedVolcano.agency}</strong></span>
            <a
              href={selectedVolcano.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#ff6b2b] hover:underline shrink-0 font-semibold"
            >
              Bollettino <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Volcanoes list */}
      <ol className="divide-y divide-[var(--hub-line)]">
        {items.map((v) => {
          const color = VOLCANO_ALERT_COLOR[v.alertColor];
          return (
            <li key={v.id}>
              <ItemButton active={activeId === `v:${v.id}`} onClick={() => onFocus(v)}>
                <span
                  className="font-hud text-[10px] font-bold px-1.5 py-1 rounded shrink-0 mt-0.5 text-center min-w-[44px]"
                  style={{ color: '#080c14', background: color }}
                >
                  {v.elevationM >= 0 ? `${v.elevationM}m` : `${v.elevationM}m`}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-semibold leading-snug truncate flex items-center gap-1">
                      <Mountain className="w-3.5 h-3.5 shrink-0" style={{ color }} />
                      {v.name}
                    </span>
                    {v.seismicCount7d > 0 && (
                      <span className="font-hud text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 shrink-0">
                        {v.seismicCount7d} sismi
                      </span>
                    )}
                  </span>
                  <span className="block font-hud text-[11px] text-[var(--hub-dim)] mt-0.5 truncate">
                    {v.country} · {v.type} · {VOLCANO_STATUS_LABEL[v.status]}
                  </span>
                </span>
              </ItemButton>
            </li>
          );
        })}
      </ol>
    </div>
  );
};


import React, { useMemo } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Globe2, Loader2, Pin, Plane, PlaneLanding, PlaneTakeoff, Search, TriangleAlert, X } from 'lucide-react';
import type { Flight, FlightInfo } from '../../services/hubApi';
import { FLIGHT_HUBS, flightColor, formatNumber, haversineKm } from '../../services/hubApi';
import { PanelHeader } from './HubWidgets';
import { ALT_BANDS, FLIGHT_SHOW_MODES, FlightFilters, FlightShowMode, matchesFilters, toggleIn } from './flightFilters';

export const flightMarkerId = (hex: string) => `flt:${hex}`;

const MAX_ROWS = 150;

/** Transponder codes reserved for emergencies. */
const SQUAWK_ALERT: Record<string, string> = {
  '7500': 'Interferenza illecita (7500)',
  '7600': 'Avaria radio (7600)',
  '7700': 'Emergenza (7700)',
};

const fl = (ft: number) => `FL${String(Math.round(ft / 100)).padStart(3, '0')}`;

interface FlightPanelProps {
  flights: Flight[];
  loadedHubs: number;
  isLoading: boolean;
  filters: FlightFilters;
  onFiltersChange: (f: FlightFilters) => void;
  mode: FlightShowMode;
  onModeChange: (m: FlightShowMode) => void;
  /** aircraft (hex) the user picked for the "Solo scelti" view */
  pinned: string[];
  onTogglePin: (hex: string) => void;
  onClearPins: () => void;
  /** how many aircraft the globe currently draws */
  shownOnGlobe: number;
  selected: Flight | null;
  info: FlightInfo | null;
  infoLoading: boolean;
  infoError: string | null;
  onSelect: (f: Flight) => void;
  onClear: () => void;
}

const Stat: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode }> = ({ label, value, sub }) => (
  <div className="rounded-lg border border-[var(--hub-line)] px-2.5 py-1.5 min-w-0">
    <div className="hub-label !text-xs">{label}</div>
    <div className="font-hud text-sm font-bold tabular-nums truncate">{value}</div>
    {sub && <div className="font-hud text-xs text-[var(--hub-dim)] truncate">{sub}</div>}
  </div>
);

const FlightDetail: React.FC<{ f: Flight; info: FlightInfo | null; loading: boolean; error: string | null; onClear: () => void }> = ({
  f,
  info,
  loading,
  error,
  onClear,
}) => {
  const color = flightColor(f.alt);
  const o = info?.origin;
  const d = info?.destination;
  const total = o && d ? haversineKm(o, d) : null;
  const flown = o ? haversineKm(o, f) : null;
  const left = d ? haversineKm(f, d) : null;
  const progress = total && flown != null && left != null ? Math.min(1, Math.max(0, flown / (flown + left))) : null;
  const emergency = f.sqk ? SQUAWK_ALERT[f.sqk] : undefined;
  const ac = info?.aircraft;

  return (
    <div className="rounded-xl border p-3 mb-3 space-y-3" style={{ borderColor: `${color}66`, background: `${color}0d` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display text-xl font-bold tracking-wide" style={{ color }}>{f.cs}</div>
          <div className="text-xs text-[var(--hub-dim)] truncate">
            {info?.airline ? `${info.airline.name}${info.airline.iata ? ` · ${info.airline.iata}` : ''}` : loading ? 'Ricerca compagnia…' : 'Compagnia non disponibile'}
          </div>
        </div>
        <button type="button" className="hub-icon-btn !h-7 !min-w-7 !p-0" onClick={onClear} aria-label="Chiudi dettagli volo">
          <X className="w-4 h-4" />
        </button>
      </div>

      {emergency && (
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold text-white bg-[#dc2626]">
          <TriangleAlert className="w-4 h-4" /> {emergency}
        </div>
      )}

      {/* Route */}
      {loading && !info ? (
        <div className="flex items-center gap-2 text-xs text-[var(--hub-dim)]">
          <Loader2 className="w-4 h-4 animate-spin" /> Recupero rotta…
        </div>
      ) : o && d ? (
        <div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1 hub-label"><PlaneTakeoff className="w-3 h-3" /> Partenza</div>
              <div className="font-hud text-lg font-bold">{o.iata ?? o.icao}</div>
              <div className="text-xs text-[var(--hub-dim)] truncate" title={o.name}>{o.city || o.name}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--hub-dim)]" />
            <div className="min-w-0 text-right">
              <div className="flex items-center gap-1 justify-end hub-label">Arrivo <PlaneLanding className="w-3 h-3" /></div>
              <div className="font-hud text-lg font-bold">{d.iata ?? d.icao}</div>
              <div className="text-xs text-[var(--hub-dim)] truncate" title={d.name}>{d.city || d.name}</div>
            </div>
          </div>
          {progress != null && (
            <div className="mt-2">
              <div className="h-1.5 rounded-full bg-[var(--hub-line)] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: color, boxShadow: `0 0 10px ${color}` }} />
              </div>
              <div className="flex justify-between font-hud text-xs text-[var(--hub-dim)] mt-1">
                <span>{formatNumber(flown!, 0)} km percorsi</span>
                <span>{formatNumber(left!, 0)} km all'arrivo</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-[var(--hub-dim)]">{error ?? 'Rotta non presente nel database pubblico per questo codice volo.'}</div>
      )}

      {/* Live telemetry */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        <Stat label="Quota" value={fl(f.alt)} sub={`${formatNumber(f.alt * 0.3048, 0)} m`} />
        <Stat label="Velocità" value={f.gs != null ? `${formatNumber(f.gs * 1.852, 0)} km/h` : '—'} sub={f.gs != null ? `${formatNumber(f.gs, 0)} kt` : undefined} />
        <Stat
          label="Variometro"
          value={
            f.vr == null || Math.abs(f.vr) < 200 ? (
              'Livellato'
            ) : (
              <span className="inline-flex items-center gap-0.5">
                {f.vr > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {f.vr > 0 ? 'Salita' : 'Discesa'}
              </span>
            )
          }
          sub={f.vr != null ? `${f.vr > 0 ? '+' : ''}${formatNumber(f.vr, 0)} ft/min` : undefined}
        />
        <Stat label="Rotta" value={f.trk != null ? `${formatNumber(f.trk, 0)}°` : '—'} sub={f.sqk ? `squawk ${f.sqk}` : undefined} />
      </div>

      {/* Aircraft */}
      <div className="flex gap-3 items-center">
        {ac?.photo && (
          <img src={ac.photo} alt={`Foto ${ac.registration}`} className="w-24 h-16 object-cover rounded-lg border border-[var(--hub-line)] shrink-0" loading="lazy" referrerPolicy="no-referrer" />
        )}
        <div className="min-w-0 text-xs space-y-0.5">
          <div className="font-semibold truncate">
            {ac ? `${ac.manufacturer} ${ac.type}`.trim() : f.type ?? 'Aeromobile'}
            {(ac?.icaoType || f.type) && <span className="font-hud text-xs text-[var(--hub-dim)] ml-1.5">{ac?.icaoType || f.type}</span>}
          </div>
          <div className="text-[var(--hub-dim)] truncate">
            Marche <span className="font-hud text-[var(--hub-text)]">{ac?.registration || f.reg || '—'}</span>
            <span className="font-hud ml-2">ICAO {f.hex.toUpperCase()}</span>
          </div>
          {ac?.owner && <div className="text-[var(--hub-dim)] truncate">Operatore: {ac.owner}{ac.ownerCountry ? ` (${ac.ownerCountry})` : ''}</div>}
        </div>
      </div>
      <p className="text-xs text-[var(--hub-dim)] leading-snug">
        Rotta prevista dal database pubblico adsbdb: per voli charter o con codici riutilizzati può non corrispondere al volo reale.
      </p>
    </div>
  );
};

export const FlightPanel: React.FC<FlightPanelProps> = ({
  flights,
  loadedHubs,
  isLoading,
  filters,
  onFiltersChange,
  mode,
  onModeChange,
  pinned,
  onTogglePin,
  onClearPins,
  shownOnGlobe,
  selected,
  info,
  infoLoading,
  infoError,
  onSelect,
  onClear,
}) => {
  const rows = useMemo(
    () => flights.filter((f) => matchesFilters(f, filters)).sort((a, b) => a.cs.localeCompare(b.cs)),
    [flights, filters]
  );
  const pinnedSet = useMemo(() => new Set(pinned), [pinned]);
  const set = (patch: Partial<FlightFilters>) => onFiltersChange({ ...filters, ...patch });

  return (
    <section className="hub-panel p-4 flex flex-col flex-1 min-w-0 min-h-0" aria-label="Traffico aereo">
      <PanelHeader
        code="MOD-00.D // ADS-B live"
        title="Traffico aereo"
        icon={<Plane className="w-4 h-4 text-[#38bdf8]" />}
        right={
          <div className="text-right font-hud text-xs text-[var(--hub-dim)] leading-tight">
            <div>
              <span className="text-[var(--hub-text)] font-bold text-sm">{formatNumber(flights.length, 0)}</span> aerei
            </div>
            <div className="flex items-center gap-1 justify-end">
              {isLoading && <Loader2 className="w-3 h-3 animate-spin text-[var(--hub-cyan)]" />}
              zone {loadedHubs}/{FLIGHT_HUBS.length}
            </div>
          </div>
        }
      />

      {selected && <FlightDetail f={selected} info={info} loading={infoLoading} error={infoError} onClear={onClear} />}

      {/* What the globe draws */}
      <div className="rounded-xl border border-[var(--hub-line)] p-2 mb-2 space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap" role="radiogroup" aria-label="Voli mostrati sul globo">
          <span className="hub-label flex items-center gap-1 mr-1">
            <Globe2 className="w-3 h-3" /> Sul globo
          </span>
          {FLIGHT_SHOW_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              aria-pressed={mode === m.id}
              className="hub-chip !h-7 !px-2.5"
              onClick={() => onModeChange(m.id)}
            >
              {m.label}
              {m.id === 'pinned' && pinned.length > 0 && <span className="opacity-70">{pinned.length}</span>}
            </button>
          ))}
          <span className="font-hud text-xs text-[var(--hub-dim)] ml-auto">{formatNumber(shownOnGlobe, 0)} visibili</span>
        </div>
        {mode === 'pinned' && pinned.length === 0 && (
          <p className="text-xs text-[var(--hub-dim)]">Usa la puntina accanto a ogni volo per sceglierlo.</p>
        )}
        {pinned.length > 0 && (
          <button type="button" onClick={onClearPins} className="text-xs text-[var(--hub-dim)] hover:text-[var(--hub-text)] underline">
            Rimuovi tutti i voli scelti ({pinned.length})
          </button>
        )}
      </div>

      {/* Filters (apply to the list and to the "Filtrati" globe view) */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-1.5" role="group" aria-label="Zone radar">
        <button type="button" className="hub-chip !h-7 !px-2.5" aria-pressed={filters.hubs.length === 0} onClick={() => set({ hubs: [] })}>
          Tutte le zone
        </button>
        {FLIGHT_HUBS.map((h) => (
          <button
            key={h.id}
            type="button"
            className="hub-chip !h-7 !px-2.5"
            aria-pressed={filters.hubs.includes(h.id)}
            onClick={() => set({ hubs: toggleIn(filters.hubs, h.id) })}
          >
            {h.name}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2" role="group" aria-label="Fasce di quota">
        <button type="button" className="hub-chip !h-7 !px-2.5" aria-pressed={filters.bands.length === 0} onClick={() => set({ bands: [] })}>
          Ogni quota
        </button>
        {ALT_BANDS.map((b) => (
          <button
            key={b.id}
            type="button"
            className="hub-chip !h-7 !px-2.5"
            title={b.hint}
            aria-pressed={filters.bands.includes(b.id)}
            style={{ ['--chip-color' as any]: b.color }}
            onClick={() => set({ bands: toggleIn(filters.bands, b.id) })}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: b.color }} />
            {b.label}
          </button>
        ))}
      </div>

      <label className="relative mb-2 block">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--hub-dim)]" />
        <input
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder="Cerca volo, marche o modello (es. AZA, ITY, A320)"
          className="w-full h-8 pl-8 pr-2 rounded-lg bg-transparent border border-[var(--hub-line)] text-xs font-hud focus:outline-none focus:border-[var(--hub-line-strong)]"
          aria-label="Cerca volo"
        />
      </label>

      <div className="grid grid-cols-[24px_minmax(0,1fr)_52px_64px_72px] gap-2 px-2 hub-label !text-xs mb-1">
        <span className="sr-only">Scegli</span>
        <span>Volo · {formatNumber(rows.length, 0)}</span>
        <span>Tipo</span>
        <span className="text-right">Quota</span>
        <span className="text-right">Velocità</span>
      </div>
      <ul className="overflow-y-auto -mx-1 px-1 hub-scroll min-h-0 flex-1">
        {flights.length === 0 && Array.from({ length: 8 }, (_, i) => <li key={i} className="hub-skeleton h-8 mb-1" />)}
        {flights.length > 0 && rows.length === 0 && <li className="text-sm text-[var(--hub-dim)] py-6 text-center">Nessun volo con questi filtri.</li>}
        {rows.slice(0, MAX_ROWS).map((f) => {
          const isSel = selected?.hex === f.hex;
          const isPinned = pinnedSet.has(f.hex);
          const emergency = f.sqk && SQUAWK_ALERT[f.sqk];
          return (
            <li key={f.hex} className={`hub-row grid grid-cols-[24px_minmax(0,1fr)] gap-2 items-center rounded-lg pl-2 ${isSel ? 'is-selected' : ''}`}>
              <button
                type="button"
                onClick={() => onTogglePin(f.hex)}
                className="grid place-items-center h-7 rounded-md hover:bg-[var(--hub-line)]"
                aria-pressed={isPinned}
                aria-label={isPinned ? `Togli ${f.cs} dai voli scelti` : `Scegli ${f.cs} per il globo`}
                title={isPinned ? 'Togli dai voli scelti' : 'Scegli questo volo'}
              >
                <Pin className={`w-3.5 h-3.5 ${isPinned ? 'text-[var(--hub-cyan)] fill-current' : 'opacity-30'}`} />
              </button>
              <button
                type="button"
                onClick={() => onSelect(f)}
                className="grid grid-cols-[minmax(0,1fr)_52px_64px_72px] items-center gap-2 pr-2 py-1 text-left"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: flightColor(f.alt) }} />
                  <span className="font-hud text-xs font-bold truncate">{f.cs}</span>
                  {emergency && <TriangleAlert className="w-3 h-3 text-[#dc2626] shrink-0" aria-label={emergency} />}
                </span>
                <span className="font-hud text-xs text-[var(--hub-dim)] truncate">{f.type ?? '—'}</span>
                <span className="font-hud text-xs text-right tabular-nums">{fl(f.alt)}</span>
                <span className="font-hud text-xs text-right tabular-nums">{f.gs != null ? `${formatNumber(f.gs * 1.852, 0)} km/h` : '—'}</span>
              </button>
            </li>
          );
        })}
        {rows.length > MAX_ROWS && (
          <li className="hub-label text-center py-2">+ altri {rows.length - MAX_ROWS} · restringi zone o quota, o cerca</li>
        )}
      </ul>
    </section>
  );
};

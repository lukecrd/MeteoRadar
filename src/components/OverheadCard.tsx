import React, { useMemo, useState } from 'react';
import { Compass, Eye, Filter, Layers, Plane, RotateCcw, Satellite } from 'lucide-react';
import { LocationInfo } from '../types';
import { usePolledJson } from '../hooks/usePolledJson';
import { distanceKm } from '../alerts/personalAlerts';
import { bearingDeg, compassIt, satellitePasses } from '../services/overhead';
import {
  Flight,
  FlightDetail,
  FlightsResponse,
  ISS_NORAD,
  SatellitesResponse,
  WORLD_ENDPOINTS,
} from '../services/worldEventsApi';
import { classifyFlight, FLIGHT_TYPE_FILTERS, FlightTypeCategory } from '../services/flightClassifier';
import { useFlightTracker } from '../hooks/useFlightTracker';
import { FlightCard, FlightSearch } from './FlightCard';

const FLIGHTS_REFRESH_MS = 30_000;
const TLE_REFRESH_MS = 2 * 60 * 60_000;
const MAX_FLIGHTS = 20;
const MAX_PASSES = 6;

type OverheadAltFilter = 'all' | 'low' | 'mid' | 'high';

const ALT_FILTER_OPTIONS: Array<{ id: OverheadAltFilter; label: string }> = [
  { id: 'all', label: 'Tutte le quote' },
  { id: 'low', label: 'Bassa (<3 km)' },
  { id: 'mid', label: 'Media (3–8,5 km)' },
  { id: 'high', label: 'Crociera (>8,5 km)' },
];

const RADIUS_OPTIONS = [
  { km: 30, nm: 16, label: '30 km' },
  { km: 75, nm: 42, label: '75 km' },
  { km: 150, nm: 82, label: '150 km' },
];

const timeIt = (ms: number) => new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const dayIt = (ms: number) => {
  const d = new Date(ms);
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Oggi';
  if (d.toDateString() === tomorrow.toDateString()) return 'Domani';
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
};

function seedFromAreaFlight(f: Flight): FlightDetail {
  const now = Date.now();
  return {
    icao24: f.id,
    callsign: f.callsign,
    country: f.country || null,
    lat: f.lat,
    lon: f.lon,
    baroAltM: f.altitudeM,
    geoAltM: null,
    onGround: false,
    speedMs: f.speedKmh != null ? f.speedKmh / 3.6 : null,
    trackDeg: f.heading,
    verticalRateMs: null,
    squawk: null,
    lastContact: now,
    positionTime: now,
    registration: null,
    aircraftType: f.aircraftType ?? null,
    source: 'opensky',
  };
}

/**
 * 3D Isometric Holographic Airspace Radar Dome:
 * Projects nearby aircraft onto a tilted 3D ground radar plane
 * and extrudes vertical 3D altitude pillars proportional to each aircraft's real barometric altitude.
 */
const Airspace3DRadarDome: React.FC<{
  flights: Array<Flight & { km: number; bearing: number; dir: string; meta: ReturnType<typeof classifyFlight> }>;
  radiusKm: number;
  selectedId: string | null;
  onSelectFlight: (f: Flight) => void;
  locationName: string;
}> = ({ flights, radiusKm, selectedId, onSelectFlight, locationName }) => {
  const cx = 270;
  const cy = 205;
  const rx = 182;
  const ry = 72;
  const maxAltM = 12500;
  const maxPillarPx = 102;

  return (
    <div className="hub-3d-subcard p-4 sm:p-5 overflow-hidden relative bg-slate-950/90 text-slate-100">
      {/* 3D Holographic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 relative z-10">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-display text-xs sm:text-sm font-bold tracking-wide text-white truncate">
            CUPOLA RADAR 3D · PROIEZIONE VOLUMETRICA QUOTA
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-hud text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" /> &lt;3 km
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" /> 3–8,5 km
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" /> &gt;8,5 km (Crociera)
          </span>
        </div>
      </div>

      <div className="w-full overflow-hidden">
        <svg
          viewBox="0 0 540 305"
          className="w-full h-auto max-h-80 select-none block"
          role="img"
          aria-label={`Cupola radar 3D spazio aereo sopra ${locationName}`}
        >
          <defs>
            <radialGradient id="domeFloorGlow" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="rgba(34, 211, 238, 0.24)" />
              <stop offset="60%" stopColor="rgba(14, 116, 144, 0.08)" />
              <stop offset="100%" stopColor="rgba(2, 6, 23, 0)" />
            </radialGradient>
            <linearGradient id="domeShellGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(56, 189, 248, 0.14)" />
              <stop offset="100%" stopColor="rgba(56, 189, 248, 0.0)" />
            </linearGradient>
          </defs>

          {/* Upper 3D Celestial Dome Wireframe Arch */}
          <path
            d={`M ${cx - rx} ${cy} A ${rx} 142 0 0 1 ${cx + rx} ${cy}`}
            fill="url(#domeShellGrad)"
            stroke="rgba(56, 189, 248, 0.22)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <path
            d={`M ${cx - rx * 0.66} ${cy} A ${rx * 0.66} 98 0 0 1 ${cx + rx * 0.66} ${cy}`}
            fill="none"
            stroke="rgba(56, 189, 248, 0.12)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />

          {/* Altitude Reference Scale on Left */}
          <g className="font-hud text-[10px] fill-slate-400">
            <line x1="48" y1={cy} x2="48" y2={cy - maxPillarPx} stroke="rgba(148, 163, 184, 0.3)" strokeWidth="1" />
            <line x1="44" y1={cy - maxPillarPx} x2="52" y2={cy - maxPillarPx} stroke="rgba(148, 163, 184, 0.5)" strokeWidth="1" />
            <text x="40" y={cy - maxPillarPx + 3} textAnchor="end">12 km</text>
            <line x1="44" y1={cy - maxPillarPx * 0.5} x2="52" y2={cy - maxPillarPx * 0.5} stroke="rgba(148, 163, 184, 0.4)" strokeWidth="1" />
            <text x="40" y={cy - maxPillarPx * 0.5 + 3} textAnchor="end">6 km</text>
            <text x="40" y={cy + 3} textAnchor="end">Suolo</text>
          </g>

          {/* Tilted 3D Radar Ground Plane */}
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#domeFloorGlow)" stroke="rgba(34, 211, 238, 0.45)" strokeWidth="1.4" />
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx * 0.66}
            ry={ry * 0.66}
            fill="none"
            stroke="rgba(34, 211, 238, 0.25)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx * 0.33}
            ry={ry * 0.33}
            fill="none"
            stroke="rgba(34, 211, 238, 0.2)"
            strokeWidth="1"
            strokeDasharray="2 3"
          />

          {/* 3D Ground Axes (N-S, E-W) */}
          <line x1={cx - rx} y1={cy} x2={cx + rx} y2={cy} stroke="rgba(56, 189, 248, 0.2)" strokeWidth="1" />
          <line x1={cx} y1={cy - ry} x2={cx} y2={cy + ry} stroke="rgba(56, 189, 248, 0.2)" strokeWidth="1" />

          {/* Cardinal Labels on 3D Rim */}
          <text x={cx} y={cy - ry - 7} textAnchor="middle" className="fill-cyan-300 font-hud text-[11px] font-bold">
            NORD
          </text>
          <text x={cx} y={cy + ry + 16} textAnchor="middle" className="fill-slate-400 font-hud text-[10px] font-semibold">
            SUD ({radiusKm} km)
          </text>
          <text x={cx + rx + 10} y={cy + 3} textAnchor="start" className="fill-slate-400 font-hud text-[10px] font-semibold">
            EST
          </text>
          <text x={cx - rx - 10} y={cy + 3} textAnchor="end" className="fill-slate-400 font-hud text-[10px] font-semibold">
            OVEST
          </text>

          {/* Observer Center Beacon */}
          <ellipse cx={cx} cy={cy} rx="6" ry="3" fill="#22d3ee" />
          <circle cx={cx} cy={cy} r="2.5" fill="#ffffff" />

          {/* 3D Aircraft Altitude Pillars & Volumetric Markers */}
          {flights.slice(0, 20).map((f, idx) => {
            const normDist = Math.min(0.94, Math.max(0.06, f.km / radiusKm));
            const rad = ((f.bearing - 90) * Math.PI) / 180;
            const gx = cx + Math.cos(rad) * rx * normDist;
            const gy = cy + Math.sin(rad) * ry * normDist;

            const altM = Math.max(250, f.altitudeM ?? 1500);
            const pillarH = Math.min(maxPillarPx, Math.max(10, (altM / maxAltM) * maxPillarPx));
            const topY = gy - pillarH;

            const color = altM < 3000 ? '#34d399' : altM <= 8500 ? '#22d3ee' : '#a78bfa';
            const isSelected = selectedId === f.id;
            const alignRight = gx > cx + 70;
            const showLabel = isSelected || idx < 8;

            return (
              <g
                key={f.id}
                onClick={() => onSelectFlight(f)}
                className="cursor-pointer group"
                role="button"
                tabIndex={0}
                aria-label={`Volo ${f.callsign} a ${Math.round(f.km)} km, quota ${altM} metri`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectFlight(f);
                  }
                }}
              >
                {/* Ground shadow footprint on radar floor */}
                <ellipse
                  cx={gx}
                  cy={gy}
                  rx={isSelected ? 6 : 3.5}
                  ry={isSelected ? 3 : 1.8}
                  fill={color}
                  opacity={isSelected ? 0.75 : 0.35}
                />

                {/* 3D Vertical Altitude Pillar */}
                <line
                  x1={gx}
                  y1={gy}
                  x2={gx}
                  y2={topY}
                  stroke={color}
                  strokeWidth={isSelected ? 2.4 : 1.3}
                  strokeDasharray={isSelected ? undefined : '2 2'}
                  opacity={isSelected ? 1 : 0.75}
                />

                {/* Selected Target 3D Halo */}
                {isSelected && (
                  <circle
                    cx={gx}
                    cy={topY}
                    r="10"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                  />
                )}

                {/* 3D Aircraft Node at Altitude */}
                <circle
                  cx={gx}
                  cy={topY}
                  r={isSelected ? 5.5 : 4}
                  fill={color}
                  stroke="#020617"
                  strokeWidth="1.2"
                />

                {/* Callsign HUD Tag in 3D space (flipped inward near right edge so it never overflows) */}
                <text
                  x={alignRight ? gx - 7 : gx + 7}
                  y={topY + 3}
                  textAnchor={alignRight ? 'end' : 'start'}
                  className={`font-hud text-[9.5px] font-bold transition-opacity ${
                    isSelected
                      ? 'fill-white opacity-100'
                      : showLabel
                        ? 'fill-slate-200 opacity-85 group-hover:opacity-100'
                        : 'fill-slate-200 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {f.callsign}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-400 font-hud pt-2 mt-1 border-t border-slate-800/80">
        <span className="truncate">Centro cupola: {locationName} · Raggio attivo {radiusKm} km</span>
        <span className="text-slate-400">Clicca un pilastro 3D per aprire la telemetria del volo</span>
      </div>
    </div>
  );
};

/**
 * Dedicated "Voli & ISS" view: 3D isometric radar dome, aircraft within configurable radius
 * with Altitude, Airline, and Aircraft Type filters, global flight search, live
 * aircraft telemetry card, and upcoming ISS passes.
 */
export const OverheadCard: React.FC<{ location: LocationInfo }> = ({ location }) => {
  const { latitude: lat, longitude: lon } = location;

  const [radiusIdx, setRadiusIdx] = useState<number>(1); // default 75 km for richer regional traffic
  const activeRadius = RADIUS_OPTIONS[radiusIdx];

  const [altFilter, setAltFilter] = useState<OverheadAltFilter>('all');
  const [typeFilter, setTypeFilter] = useState<FlightTypeCategory>('all');
  const [airlineFilter, setAirlineFilter] = useState<string>('all');

  // Selected aircraft for live inspection
  const [selectedFlight, setSelectedFlight] = useState<{ icao24: string; seed: FlightDetail | null } | null>(null);
  const tracker = useFlightTracker(selectedFlight?.icao24 ?? null, selectedFlight?.seed ?? null);

  const flights = usePolledJson<FlightsResponse>(
    WORLD_ENDPOINTS.flightsArea(lat.toFixed(2), lon.toFixed(2), activeRadius.nm),
    FLIGHTS_REFRESH_MS
  );
  const stations = usePolledJson<SatellitesResponse>(WORLD_ENDPOINTS.satellites('stations'), TLE_REFRESH_MS);

  // Enrich all flights within radius with distance, bearing, compass direction, airline & aircraft type classification
  const allNearby = useMemo(() => {
    return (flights.data?.items ?? [])
      .map((f) => {
        const km = distanceKm(lat, lon, f.lat, f.lon);
        const bearing = bearingDeg(lat, lon, f.lat, f.lon);
        const dir = compassIt(bearing);
        const meta = classifyFlight(f);
        return { ...f, km, bearing, dir, meta };
      })
      .filter((f) => f.km <= activeRadius.km)
      .sort((a, b) => a.km - b.km);
  }, [flights.data, lat, lon, activeRadius.km]);

  // Distinct airlines detected in current airspace
  const detectedAirlines = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of allNearby) {
      if (f.meta.airlineName) {
        counts.set(f.meta.airlineName, (counts.get(f.meta.airlineName) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [allNearby]);

  // Apply Altitude, Airline, and Aircraft Type filters
  const filteredNearby = useMemo(() => {
    return allNearby.filter((f) => {
      if (altFilter !== 'all') {
        const altM = f.altitudeM ?? 0;
        if (altFilter === 'low' && altM >= 3000) return false;
        if (altFilter === 'mid' && (altM < 3000 || altM > 8500)) return false;
        if (altFilter === 'high' && altM <= 8500) return false;
      }
      if (typeFilter !== 'all' && f.meta.category !== typeFilter) {
        return false;
      }
      if (airlineFilter !== 'all' && f.meta.airlineName !== airlineFilter) {
        return false;
      }
      return true;
    });
  }, [allNearby, altFilter, typeFilter, airlineFilter]);

  const hasActiveFilters = altFilter !== 'all' || typeFilter !== 'all' || airlineFilter !== 'all';

  const resetFilters = () => {
    setAltFilter('all');
    setTypeFilter('all');
    setAirlineFilter('all');
  };

  const iss = stations.data?.items.find((t) => t.norad === ISS_NORAD);
  const passes = useMemo(() => {
    if (!iss) return [];
    const now = Date.now();
    return satellitePasses(iss.line1, iss.line2, lat, lon, now, 36)
      .filter((p) => p.endMs > now)
      .slice(0, MAX_PASSES);
  }, [iss, lat, lon]);

  return (
    <div className="space-y-6">
      {/* Main Airspace & Radar Card — wrapped inside hub-module so :first-child styles the full panel cleanly */}
      <div className="hub-module">
        <section className="hub-panel p-4 sm:p-6 space-y-5 overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--hub-line)] pb-4">
            <div className="min-w-0">
              <div className="hub-label flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-[var(--hub-cyan)] shrink-0" />
                <span className="truncate">Radar Spazio Aereo 3D & Orbita · {location.name}</span>
              </div>
              <h2 className="font-display text-lg sm:text-xl font-bold mt-0.5">
                Traffico Aereo Sopra di Te & Passaggi ISS
              </h2>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
              {/* Global Flight Search by callsign / flight number */}
              <div className="w-full sm:w-64 lg:w-72 min-w-0">
                <FlightSearch
                  compact
                  onSelect={(detail) => setSelectedFlight({ icao24: detail.icao24, seed: detail })}
                />
              </div>

              {/* Scan Radius Selector */}
              <div className="flex items-center gap-1.5 flex-wrap shrink-0" role="group" aria-label="Raggio radar aereo">
                <span className="text-xs text-[var(--hub-dim)] mr-1">Raggio:</span>
                {RADIUS_OPTIONS.map((opt, idx) => (
                  <button
                    key={opt.km}
                    type="button"
                    onClick={() => setRadiusIdx(idx)}
                    aria-pressed={radiusIdx === idx}
                    className="hub-chip !h-8 !px-3 text-xs font-hud"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Flight Filter Toolbar: Altitude, Aircraft Type, Airline */}
          <div className="hub-3d-subcard p-3.5 sm:p-4 space-y-3 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="hub-label flex items-center gap-1.5 min-w-0">
                <Filter className="w-3.5 h-3.5 text-[var(--hub-cyan)] shrink-0" />
                <span>Filtri Volo (Altitudine · Tipo Aeromobile · Compagnia)</span>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="hub-chip !h-7 !px-2.5 text-xs shrink-0"
                >
                  <RotateCcw className="w-3 h-3" /> Azzera filtri
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* 1. Altitude Band Filter */}
              <div className="min-w-0">
                <div className="text-xs text-[var(--hub-dim)] mb-1.5 font-medium">Fascia di Altitudine</div>
                <div className="flex flex-wrap gap-1.5">
                  {ALT_FILTER_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAltFilter(opt.id)}
                      aria-pressed={altFilter === opt.id}
                      className="hub-chip !h-7 !px-2.5 !text-xs"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Aircraft Type / Category Filter */}
              <div className="min-w-0">
                <div className="text-xs text-[var(--hub-dim)] mb-1.5 font-medium">Tipo Aeromobile</div>
                <div className="flex flex-wrap gap-1.5">
                  {FLIGHT_TYPE_FILTERS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTypeFilter(opt.id)}
                      aria-pressed={typeFilter === opt.id}
                      className="hub-chip !h-7 !px-2.5 !text-xs"
                    >
                      {opt.shortLabel}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Airline Filter */}
              <div className="min-w-0">
                <label htmlFor="overhead-airline-select" className="block text-xs text-[var(--hub-dim)] mb-1.5 font-medium truncate">
                  Compagnia Aerea ({detectedAirlines.length} rilevate)
                </label>
                <select
                  id="overhead-airline-select"
                  value={airlineFilter}
                  onChange={(e) => setAirlineFilter(e.target.value)}
                  className="w-full max-w-full h-8 px-2.5 rounded-lg border border-[var(--hub-line)] bg-[var(--hub-panel-strong)] text-xs truncate focus:outline-none focus:border-[var(--hub-line-strong)]"
                >
                  <option value="all">Tutte le compagnie ({allNearby.length} voli)</option>
                  {detectedAirlines.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name} ({a.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 3D Isometric Holographic Airspace Radar Dome */}
          <Airspace3DRadarDome
            flights={filteredNearby}
            radiusKm={activeRadius.km}
            selectedId={selectedFlight?.icao24 ?? null}
            onSelectFlight={(f) => setSelectedFlight({ icao24: f.id, seed: seedFromAreaFlight(f) })}
            locationName={location.name}
          />

          {/* Content Grid: Aircraft List + Selected Flight Live Telemetry Card */}
          <div className={`grid grid-cols-1 ${selectedFlight ? 'xl:grid-cols-3' : ''} gap-5 items-start`}>
            <div className={`min-w-0 ${selectedFlight ? 'xl:col-span-2' : ''}`}>
              <div className="hub-label flex flex-wrap items-center justify-between gap-2 mb-3">
                <span className="flex items-center gap-2 min-w-0">
                  <Plane className="w-3.5 h-3.5 text-[var(--hub-cyan)] shrink-0" />
                  <span>Aerei entro {activeRadius.km} km ({filteredNearby.length} di {allNearby.length})</span>
                </span>
                <span className="font-hud text-[11px] text-[var(--hub-dim)]">
                  Clicca un volo per aprire la telemetria live · Aggiornamento 30s
                </span>
              </div>

              {flights.error && !flights.data ? (
                <p className="text-xs text-[var(--hub-dim)]">{flights.error}</p>
              ) : flights.isLoading && !flights.data ? (
                <p className="text-xs text-[var(--hub-dim)]">Scansione transponder ADS-B in corso…</p>
              ) : allNearby.length === 0 ? (
                <p className="text-xs text-[var(--hub-dim)]">
                  Nessun aereo rilevato entro {activeRadius.km} km in questo momento. Prova ad ampliare il raggio a 75 o 150 km.
                </p>
              ) : filteredNearby.length === 0 ? (
                <p className="text-xs text-[var(--hub-dim)]">
                  Nessun volo corrisponde ai filtri selezionati ({allNearby.length} aerei presenti nel raggio di {activeRadius.km} km).
                </p>
              ) : (
                <ul className="divide-y divide-[var(--hub-line)] border-t border-b border-[var(--hub-line)]">
                  {filteredNearby.slice(0, MAX_FLIGHTS).map((f) => {
                    const isSelected = selectedFlight?.icao24 === f.id;
                    return (
                      <li key={f.id} className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setSelectedFlight({ icao24: f.id, seed: seedFromAreaFlight(f) })}
                          aria-pressed={isSelected}
                          className={`w-full text-left py-2.5 px-3 my-0.5 rounded-xl transition-colors hover:bg-[var(--hub-glow)] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 text-sm tabular-nums min-w-0 ${
                            isSelected ? 'bg-[var(--hub-glow)] ring-1 ring-[var(--hub-line-strong)]' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <Plane
                              className="w-4 h-4 text-[var(--hub-cyan)] shrink-0"
                              style={{ transform: `rotate(${(f.heading ?? 45) - 45}deg)` }}
                            />
                            <div className="min-w-0 flex-1 flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                              <span className="font-hud font-bold shrink-0">{f.callsign}</span>
                              {f.meta.airlineName && (
                                <span className="text-xs font-medium text-[var(--hub-text)] truncate max-w-[14rem]">
                                  · {f.meta.airlineName}
                                </span>
                              )}
                              <span className="text-xs text-[var(--hub-dim)] truncate">
                                · {f.meta.aircraftLabel} · {f.meta.categoryLabel}
                              </span>
                            </div>
                          </div>

                          <div className="text-xs text-[var(--hub-dim)] font-hud sm:text-right pl-6 sm:pl-0 shrink-0">
                            {f.altitudeM != null && f.altitudeM > 0
                              ? `${f.altitudeM.toLocaleString('it-IT')} m (${Math.round(f.altitudeM / 0.3048).toLocaleString('it-IT')} ft) · `
                              : 'Bassa quota · '}
                            {f.speedKmh != null ? `${f.speedKmh} km/h · ` : ''}
                            <strong className="text-[var(--hub-text)]">{Math.round(f.km)} km</strong> a {f.dir}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                  {filteredNearby.length > MAX_FLIGHTS && (
                    <li className="py-2 px-3 text-xs text-[var(--hub-dim)]">
                      + altri {filteredNearby.length - MAX_FLIGHTS} voli filtrati nello spazio aereo selezionato
                    </li>
                  )}
                </ul>
              )}
            </div>

            {/* Live Flight Detail Inspector */}
            {selectedFlight && (
              <div className="xl:col-span-1 min-w-0 w-full">
                <FlightCard
                  flight={tracker.flight}
                  position={tracker.position}
                  status={tracker.status}
                  error={tracker.error}
                  info={tracker.info}
                  infoLoading={tracker.infoLoading}
                  following={false}
                  onFollow={() => {
                    window.location.hash = '#/mondo';
                  }}
                  onStopFollow={() => {}}
                  onClose={() => setSelectedFlight(null)}
                />
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ISS Passes Dedicated Module — wrapped inside hub-module so :first-child styles the full panel cleanly */}
      <div className="hub-module">
        <section className="hub-panel p-4 sm:p-6 space-y-4 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hub-line)] pb-3">
            <div className="min-w-0">
              <div className="hub-label flex items-center gap-2">
                <Satellite className="w-4 h-4 text-[var(--hub-amber)] shrink-0" />
                <span className="truncate">Orbita Stazione Spaziale Internazionale (ISS) · {location.name}</span>
              </div>
              <h3 className="font-display text-base sm:text-lg font-bold mt-0.5">
                Prossimi passaggi sopra l’orizzonte locale (36 ore)
              </h3>
            </div>
            <span className="text-xs font-hud text-[var(--hub-dim)] flex items-center gap-1.5 shrink-0">
              <Compass className="w-3.5 h-3.5 text-[var(--hub-cyan)]" /> Propagazione orbitale SGP4
            </span>
          </div>

          {stations.error && !stations.data ? (
            <p className="text-xs text-[var(--hub-dim)]">{stations.error}</p>
          ) : !iss ? (
            <p className="text-xs text-[var(--hub-dim)]">
              {stations.isLoading ? 'Calcolo effemeridi orbitali SGP4 in corso…' : 'Orbita della ISS non disponibile.'}
            </p>
          ) : passes.length === 0 ? (
            <p className="text-xs text-[var(--hub-dim)]">Nessun passaggio sopra 10° nelle prossime 36 ore.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {passes.map((p) => (
                <div key={p.startMs} className="hub-3d-subcard p-4 flex flex-col justify-between gap-2.5 min-w-0 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="font-hud text-base font-bold tabular-nums">
                      {dayIt(p.startMs)} · {timeIt(p.startMs)}
                    </span>
                    {p.visible ? (
                      <span className="text-xs font-bold text-[var(--hub-amber)]">Visibile a occhio nudo</span>
                    ) : (
                      <span className="text-xs text-[var(--hub-dim)]">Diurno / In ombra</span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--hub-dim)] font-hud leading-relaxed break-words">
                    Traiettoria: da <strong className="text-[var(--hub-text)]">{compassIt(p.startAzimuthDeg)}</strong> ({Math.round(p.startAzimuthDeg)}°) a{' '}
                    <strong className="text-[var(--hub-text)]">{compassIt(p.endAzimuthDeg)}</strong> ({Math.round(p.endAzimuthDeg)}°)
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs pt-2 border-t border-[var(--hub-line)]">
                    <span className="text-[var(--hub-dim)] truncate">Culmine sull’orizzonte</span>
                    <span className="font-hud font-bold text-[var(--hub-cyan)] shrink-0">{Math.round(p.maxElevationDeg)}°</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-[var(--hub-dim)] leading-relaxed">
            Visibile = cielo buio e stazione illuminata dal Sole: un punto luminoso che attraversa il cielo in pochi minuti.
          </p>
        </section>
      </div>
    </div>
  );
};

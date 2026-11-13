import React, { useEffect, useMemo, useState } from 'react';
import { Waves, Compass, Thermometer, Wind, Anchor, Navigation, RefreshCw, Activity } from 'lucide-react';
import { LocationInfo } from '../types';
import { getWindDirectionLabel } from '../services/weatherApi';

interface MarineSwellCardProps {
  location: LocationInfo;
  windSpeed: number;
  windDirection: number;
  isDark: boolean;
}

interface SeaSector {
  id: string;
  name: string;
  basin: string;
  lat: number;
  lon: number;
}

const SEA_SECTORS: SeaSector[] = [
  { id: 'ligure', name: 'Genova · Mar Ligure', basin: 'Mar Ligure', lat: 44.36, lon: 8.91 },
  { id: 'tirreno-nord', name: 'Livorno · Alto Tirreno', basin: 'Alto Tirreno', lat: 43.53, lon: 10.25 },
  { id: 'tirreno-centro', name: 'Lido di Ostia · Tirreno Centrale', basin: 'Tirreno Centrale', lat: 41.71, lon: 12.27 },
  { id: 'tirreno-sud', name: 'Golfo di Napoli · Capri', basin: 'Tirreno Meridionale', lat: 40.62, lon: 14.22 },
  { id: 'adriatico-nord', name: 'Venezia / Rimini · Alto Adriatico', basin: 'Alto Adriatico', lat: 44.12, lon: 12.66 },
  { id: 'adriatico-centro', name: 'Ancona / Pescara · Medio Adriatico', basin: 'Medio Adriatico', lat: 43.65, lon: 13.58 },
  { id: 'adriatico-sud', name: 'Bari / Otranto · Basso Adriatico', basin: 'Basso Adriatico', lat: 41.18, lon: 16.92 },
  { id: 'ionio', name: 'Catania / Taranto · Mar Ionio', basin: 'Mar Ionio', lat: 37.49, lon: 15.16 },
  { id: 'sicilia', name: 'Canale di Sicilia · Palermo', basin: 'Mar di Sicilia', lat: 38.18, lon: 13.38 },
  { id: 'sardegna', name: 'Cagliari / Alghero · Sardegna', basin: 'Mar di Sardegna', lat: 39.15, lon: 9.16 },
];

interface MarineTelemetry {
  stationLabel: string;
  distanceKm: number;
  isLocalCoast: boolean;
  waveHeight: number;
  waveDirection: number;
  wavePeriod: number;
  swellHeight: number;
  swellDirection: number;
  swellPeriod: number;
  windWaveHeight: number;
  windWaveDirection: number;
  windWavePeriod: number;
  seaSurfaceTemp: number;
  hourly: Array<{
    hourLabel: string;
    waveHeight: number;
    swellHeight: number;
    period: number;
    sst: number;
  }>;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Scala Douglas dello stato del mare (WMO) */
export function getDouglasScale(waveM: number): {
  degree: number;
  label: string;
  color: string;
  badgeClass: string;
  description: string;
} {
  if (waveM < 0.1) {
    return {
      degree: 0,
      label: 'Calmo (Olio)',
      color: '#34d399',
      badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/35',
      description: 'Superficie marina speculare senza increspature.',
    };
  }
  if (waveM <= 0.5) {
    return {
      degree: 2,
      label: 'Poco Mosso',
      color: '#2dd4bf',
      badgeClass: 'bg-teal-500/15 text-teal-400 border-teal-500/35',
      description: 'Onde corte e ben definite, ottime condizioni per navigazione e diporto.',
    };
  }
  if (waveM <= 1.25) {
    return {
      degree: 3,
      label: 'Mosso',
      color: '#38bdf8',
      badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/35',
      description: 'Onde lunghe con prime creste schiumose (pecorelle). Ideale per vela e surf.',
    };
  }
  if (waveM <= 2.5) {
    return {
      degree: 4,
      label: 'Molto Mosso',
      color: '#facc15',
      badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/35',
      description: 'Moto ondoso marcato con frangenti frequenti. Cautela per piccole imbarcazioni.',
    };
  }
  if (waveM <= 4.0) {
    return {
      degree: 5,
      label: 'Agitato',
      color: '#fb923c',
      badgeClass: 'bg-orange-500/15 text-orange-400 border-orange-500/35',
      description: 'Onde alte fino a 4 m con spruzzi e creste frangenti estese. Sconsigliata l’uscita.',
    };
  }
  return {
    degree: 6,
    label: 'Molto Agitato / Grosso',
    color: '#f43f5e',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/35',
    description: 'Mareggiata severa in corso con onde imponenti. Pericolo per la navigazione.',
  };
}

async function queryMarinePoint(lat: number, lon: number): Promise<any | null> {
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wave_direction,wave_period,wind_wave_height,wind_wave_direction,wind_wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,sea_surface_temperature&hourly=wave_height,wave_period,swell_wave_height,sea_surface_temperature&forecast_days=2&cell_selection=sea&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  if (json?.current?.wave_height == null) return null;
  return json;
}

export const MarineSwellCard: React.FC<MarineSwellCardProps> = ({
  location,
  windSpeed,
  windDirection,
}) => {
  const [selectedSectorId, setSelectedSectorId] = useState<string>('auto');
  const [data, setData] = useState<MarineTelemetry | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    async function load() {
      try {
        let json: any = null;
        let stationLabel = `${location.name} (Costa locale)`;
        let distanceKm = 0;
        let isLocalCoast = true;

        if (selectedSectorId === 'auto') {
          // 1. Try exact coordinates first
          json = await queryMarinePoint(location.latitude, location.longitude);
          if (!json) {
            // 2. Snap to closest Italian coastal buoy
            const sorted = [...SEA_SECTORS]
              .map((s) => ({
                sector: s,
                dist: haversineKm(location.latitude, location.longitude, s.lat, s.lon),
              }))
              .sort((a, b) => a.dist - b.dist);

            for (const candidate of sorted.slice(0, 3)) {
              const res = await queryMarinePoint(candidate.sector.lat, candidate.sector.lon);
              if (res) {
                json = res;
                stationLabel = candidate.sector.name;
                distanceKm = Math.round(candidate.dist);
                isLocalCoast = false;
                break;
              }
            }
          }
        } else {
          const sector = SEA_SECTORS.find((s) => s.id === selectedSectorId) ?? SEA_SECTORS[2];
          json = await queryMarinePoint(sector.lat, sector.lon);
          stationLabel = sector.name;
          distanceKm = Math.round(haversineKm(location.latitude, location.longitude, sector.lat, sector.lon));
          isLocalCoast = distanceKm < 18;
        }

        if (cancelled || !json) {
          if (!cancelled) setIsLoading(false);
          return;
        }

        const c = json.current;
        const h = json.hourly;
        const round2 = (v: unknown, fb = 0) =>
          typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : fb;
        const round1 = (v: unknown, fb = 0) =>
          typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : fb;

        const hourlyItems: MarineTelemetry['hourly'] = [];
        if (h && Array.isArray(h.time)) {
          const currentHourISO = new Date(Date.now() + (json.utc_offset_seconds ?? 0) * 1000)
            .toISOString()
            .slice(0, 13);
          let startIdx = h.time.findIndex((t: string) => t.startsWith(currentHourISO));
          if (startIdx === -1) startIdx = 0;
          for (let i = startIdx; i < Math.min(startIdx + 24, h.time.length); i++) {
            const dt = new Date(h.time[i]);
            hourlyItems.push({
              hourLabel: `${dt.getHours().toString().padStart(2, '0')}:00`,
              waveHeight: round2(h.wave_height?.[i], 0.4),
              swellHeight: round2(h.swell_wave_height?.[i], 0.2),
              period: round1(h.wave_period?.[i], 5),
              sst: round1(h.sea_surface_temperature?.[i], 18),
            });
          }
        }

        if (!cancelled) {
          setData({
            stationLabel,
            distanceKm,
            isLocalCoast,
            waveHeight: round2(c.wave_height, 0.5),
            waveDirection: Math.round(c.wave_direction ?? 220),
            wavePeriod: round1(c.wave_period, 5.5),
            swellHeight: round2(c.swell_wave_height, 0.3),
            swellDirection: Math.round(c.swell_wave_direction ?? 210),
            swellPeriod: round1(c.swell_wave_period, 6.2),
            windWaveHeight: round2(c.wind_wave_height, 0.3),
            windWaveDirection: Math.round(c.wind_wave_direction ?? windDirection),
            windWavePeriod: round1(c.wind_wave_period, 4.2),
            seaSurfaceTemp: round1(c.sea_surface_temperature, 18.5),
            hourly: hourlyItems,
          });
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('Marine API error:', err);
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [location.latitude, location.longitude, location.name, selectedSectorId, windDirection, reloadTick]);

  const douglas = useMemo(() => getDouglasScale(data?.waveHeight ?? 0.5), [data?.waveHeight]);

  // Maritime Suitability Scores
  const activities = useMemo(() => {
    const w = data?.waveHeight ?? 0.5;
    const p = data?.wavePeriod ?? 5;
    const sst = data?.seaSurfaceTemp ?? 18;

    const sailing =
      w <= 1.4 && windSpeed >= 8 && windSpeed <= 38
        ? { status: 'Ottimale', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/15' }
        : w <= 2.4
        ? { status: 'Cautela', color: 'text-amber-400 border-amber-500/30 bg-amber-500/15' }
        : { status: 'Sconsigliato', color: 'text-rose-400 border-rose-500/30 bg-rose-500/15' };

    const surf =
      w >= 0.7 && w <= 3.2 && p >= 5.5
        ? { status: 'Swell Attivo', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/15' }
        : w >= 0.35
        ? { status: 'Onda Piccola', color: 'text-amber-400 border-amber-500/30 bg-amber-500/15' }
        : { status: 'Piatto', color: 'text-slate-400 border-slate-500/30 bg-slate-500/15' };

    const swim =
      w <= 0.8 && sst >= 19
        ? { status: 'Favorevole', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/15' }
        : w <= 1.3
        ? { status: 'Acqua Fresca / Mosso', color: 'text-amber-400 border-amber-500/30 bg-amber-500/15' }
        : { status: 'Bandiera Rossa', color: 'text-rose-400 border-rose-500/30 bg-rose-500/15' };

    return { sailing, surf, swim };
  }, [data, windSpeed]);

  // Build 3D Isometric Wave Crest Paths based on waveHeight and wavePeriod
  const waveCrestPaths = useMemo(() => {
    const h = Math.min(4.5, Math.max(0.15, data?.waveHeight ?? 0.6));
    const amp = 4 + (h / 4.5) * 20;
    const freq = Math.max(1.6, Math.min(4.2, 18 / Math.max(3.5, data?.wavePeriod ?? 6)));

    const buildLayer = (yBase: number, phase: number, xOffset: number) => {
      const pts: string[] = [];
      const steps = 36;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = 28 + xOffset + t * 240;
        const y =
          yBase -
          t * 18 +
          Math.sin(t * Math.PI * 2 * freq + phase) * amp * (0.75 + 0.25 * Math.sin(t * Math.PI));
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      return pts;
    };

    return {
      front: buildLayer(96, 0, 0),
      mid: buildLayer(78, 1.3, 18),
      back: buildLayer(60, 2.6, 36),
    };
  }, [data?.waveHeight, data?.wavePeriod]);

  return (
    <div className="hub-panel p-5 sm:p-7 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--hub-line)] pb-4">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-2xl grid place-items-center shrink-0 bg-cyan-500/15 border border-cyan-400/35 text-cyan-400 shadow-lg shadow-cyan-500/10">
            <Waves className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <span className="hub-label flex items-center gap-1.5">
                <span className="hub-live-dot" /> Open-Meteo Marine · Boe & Modello Spettrale
              </span>
              {data && (
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${douglas.badgeClass}`}>
                  Scala Douglas {douglas.degree} · {douglas.label}
                </span>
              )}
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-bold mt-0.5 truncate">
              Stato del Mare & Swell 3D · {data?.stationLabel ?? location.name}
            </h3>
            {data && !data.isLocalCoast && (
              <p className="text-xs text-[var(--hub-dim)] mt-0.5">
                Località interna ({location.name}) → collegato automaticamente alla boa marina più vicina a <strong>{data.distanceKm} km</strong>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {data && (
            <div className="flex items-center gap-4 mr-1">
              <div className="text-right">
                <div className="hub-label">Altezza Onda</div>
                <div className="font-hud text-2xl font-bold tabular-nums text-cyan-400">
                  {data.waveHeight.toFixed(2)} <span className="text-xs font-normal text-[var(--hub-dim)]">m</span>
                </div>
              </div>
              <div className="h-9 w-px bg-[var(--hub-line)]" />
              <div className="text-right">
                <div className="hub-label">Temp. Acqua (SST)</div>
                <div className="font-hud text-2xl font-bold tabular-nums text-amber-400">
                  {data.seaSurfaceTemp.toFixed(1)} <span className="text-xs font-normal text-[var(--hub-dim)]">°C</span>
                </div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setReloadTick((t) => t + 1)}
            className="hub-icon-btn"
            title="Aggiorna telemetria marina"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sea Basin Selector Chips */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Seleziona bacino marino">
        <button
          type="button"
          onClick={() => setSelectedSectorId('auto')}
          aria-pressed={selectedSectorId === 'auto'}
          style={{ ['--chip-color' as any]: '#00f2fe' }}
          className="hub-chip !h-8 !px-3 text-xs"
        >
          <Navigation className="w-3.5 h-3.5 text-cyan-400" />
          Costa più vicina ({location.name})
        </button>
        {SEA_SECTORS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelectedSectorId(s.id)}
            aria-pressed={selectedSectorId === s.id}
            style={{ ['--chip-color' as any]: '#38bdf8' }}
            className="hub-chip !h-8 !px-3 text-xs"
          >
            {s.basin}
          </button>
        ))}
      </div>

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left 7 Cols: 3D Isometric Ocean Wave & Swell Block + 24h Trend */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-4">
            <div className="hub-3d-subcard p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="hub-label flex items-center gap-1.5">
                  <Waves className="w-3.5 h-3.5 text-cyan-400" />
                  Idrodinamica 3D · Onda Significativa, Swell & Vento Vivo
                </span>
                <span className="font-hud text-xs text-cyan-400 font-semibold">
                  Periodo Primario: {data.wavePeriod.toFixed(1)} s · Lunghezza ~{Math.round(1.56 * data.wavePeriod ** 2)} m
                </span>
              </div>

              {/* 3D Isometric Ocean Block SVG */}
              <svg viewBox="0 0 340 168" className="w-full h-auto rounded-xl bg-slate-950/80 border border-cyan-500/25">
                <defs>
                  <linearGradient id="ocean-front-3d" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00f2fe" stopOpacity="0.55" />
                    <stop offset="55%" stopColor="#0284c7" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#082f49" stopOpacity="0.92" />
                  </linearGradient>
                  <linearGradient id="ocean-side-3d" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#0369a1" stopOpacity="0.65" />
                    <stop offset="100%" stopColor="#020617" stopOpacity="0.95" />
                  </linearGradient>
                </defs>

                {/* Seabed / Bathymetric Base Plane */}
                <polygon
                  points="28,138 64,114 304,114 268,138"
                  fill="rgba(8,47,73,0.45)"
                  stroke="rgba(56,189,248,0.3)"
                  strokeWidth="1"
                />

                {/* Back Wave Ribbon */}
                <polyline
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.6"
                  strokeOpacity="0.45"
                  points={waveCrestPaths.back.join(' ')}
                />

                {/* Mid Swell Ribbon */}
                <polyline
                  fill="none"
                  stroke="#00ff87"
                  strokeWidth="2"
                  strokeOpacity="0.65"
                  points={waveCrestPaths.mid.join(' ')}
                />

                {/* Front 3D Extruded Water Volume */}
                <polygon
                  points={`28,138 ${waveCrestPaths.front.join(' ')} 268,138`}
                  fill="url(#ocean-front-3d)"
                  stroke="#00f2fe"
                  strokeWidth="2.2"
                />

                {/* Right Isometric Side Wall of Water Volume */}
                <polygon
                  points={`268,${waveCrestPaths.front[waveCrestPaths.front.length - 1].split(',')[1]} 304,${waveCrestPaths.back[waveCrestPaths.back.length - 1].split(',')[1]} 304,114 268,138`}
                  fill="url(#ocean-side-3d)"
                  stroke="rgba(56,189,248,0.45)"
                  strokeWidth="1"
                />

                {/* Telemetry Callouts inside 3D SVG */}
                <text x="14" y="20" fill="#00f2fe" fontSize="9.5" fontWeight="700">
                  ONDA TOTALE: {data.waveHeight.toFixed(2)} m ({data.wavePeriod.toFixed(1)} s · {data.waveDirection}°)
                </text>
                <text x="14" y="33" fill="#00ff87" fontSize="8.5" fontWeight="600">
                  SWELL (ONDA LUNGA): {data.swellHeight.toFixed(2)} m ({data.swellPeriod.toFixed(1)} s · {data.swellDirection}°)
                </text>
                <text x="326" y="20" textAnchor="end" fill="#facc15" fontSize="9" fontWeight="700">
                  SST: {data.seaSurfaceTemp.toFixed(1)}°C
                </text>
                <text x="326" y="33" textAnchor="end" fill="#cbd5e1" fontSize="8">
                  Onda Vento: {data.windWaveHeight.toFixed(2)} m
                </text>
              </svg>

              <p className="text-xs text-[var(--hub-dim)] leading-relaxed">{douglas.description}</p>
            </div>

            {/* 24-Hour Wave & Swell Forecast Strip */}
            <div className="hub-3d-subcard p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="hub-label">Evoluzione Oraria Moto Ondoso (Prossime 12h)</span>
                <span className="text-xs font-hud text-[var(--hub-dim)]">Onda (m) · Periodo (s)</span>
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 pt-1">
                {data.hourly.slice(0, 12).map((h, i) => {
                  const barH = Math.min(100, Math.max(12, (h.waveHeight / 3.5) * 100));
                  return (
                    <div
                      key={`${h.hourLabel}-${i}`}
                      className="flex flex-col items-center justify-between p-1.5 rounded-lg bg-slate-900/60 border border-white/5 text-center"
                    >
                      <span className="font-hud text-[10px] text-[var(--hub-dim)]">{h.hourLabel.slice(0, 2)}h</span>
                      <div className="h-12 w-2.5 rounded-full bg-slate-800 flex items-end overflow-hidden my-1">
                        <div
                          className="w-full rounded-full bg-gradient-to-t from-sky-500 to-cyan-300"
                          style={{ height: `${barH}%` }}
                        />
                      </div>
                      <span className="font-hud text-[11px] font-bold text-cyan-300">{h.waveHeight.toFixed(1)}</span>
                      <span className="font-hud text-[9px] text-[var(--hub-dim)]">{h.period.toFixed(0)}s</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right 5 Cols: 3D Vector Compass (Wave vs Swell vs Wind) & Breakdown Cards */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            {/* 3D Nautical Vector Rose */}
            <div className="hub-3d-subcard p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4">
              <svg viewBox="0 0 140 140" className="w-32 h-32 shrink-0">
                {/* Outer 3D Ring */}
                <circle cx="70" cy="70" r="60" fill="rgba(2,6,23,0.8)" stroke="rgba(56,189,248,0.35)" strokeWidth="1.5" />
                <circle cx="70" cy="70" r="42" fill="none" stroke="rgba(148,163,184,0.2)" strokeDasharray="3 3" />
                <text x="70" y="20" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="700">N</text>
                <text x="122" y="73" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="700">E</text>
                <text x="70" y="126" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="700">S</text>
                <text x="18" y="73" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="700">O</text>

                {/* Swell Vector (#00ff87) */}
                <g transform={`rotate(${data.swellDirection} 70 70)`}>
                  <line x1="70" y1="70" x2="70" y2="26" stroke="#00ff87" strokeWidth="2.5" strokeLinecap="round" />
                  <polygon points="70,20 65,30 75,30" fill="#00ff87" />
                </g>

                {/* Primary Wave Vector (#00f2fe) */}
                <g transform={`rotate(${data.waveDirection} 70 70)`}>
                  <line x1="70" y1="70" x2="70" y2="22" stroke="#00f2fe" strokeWidth="3" strokeLinecap="round" />
                  <polygon points="70,15 64,27 76,27" fill="#00f2fe" />
                </g>

                <circle cx="70" cy="70" r="5" fill="#f8fafc" />
              </svg>

              <div className="space-y-2.5 flex-1 min-w-0 text-xs w-full">
                <div className="font-bold text-sm flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
                  Rosa Nautica 3D Vettoriale
                </div>
                <div className="p-2 rounded-lg bg-slate-900/65 border border-cyan-500/25 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#00f2fe]" />
                    Onda Totale
                  </span>
                  <strong className="font-hud">{data.waveDirection}° · {getWindDirectionLabel(data.waveDirection).split(' ')[0]}</strong>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/65 border border-emerald-500/25 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#00ff87]" />
                    Swell Lungo
                  </span>
                  <strong className="font-hud">{data.swellDirection}° · {data.swellPeriod.toFixed(1)} s</strong>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/65 border border-white/10 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Wind className="w-3.5 h-3.5 text-amber-400" />
                    Onda di Vento
                  </span>
                  <strong className="font-hud">{data.windWaveHeight.toFixed(2)} m · {data.windWavePeriod.toFixed(1)} s</strong>
                </div>
              </div>
            </div>

            {/* 3 Maritime Activity Suitability Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="hub-3d-subcard p-3 flex flex-col justify-between gap-1.5">
                <span className="hub-label flex items-center gap-1">
                  <Anchor className="w-3.5 h-3.5 text-cyan-400" /> Diporto & Vela
                </span>
                <span className={`text-xs font-bold px-2 py-1 rounded-lg border text-center ${activities.sailing.color}`}>
                  {activities.sailing.status}
                </span>
              </div>
              <div className="hub-3d-subcard p-3 flex flex-col justify-between gap-1.5">
                <span className="hub-label flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" /> Surf & Swell
                </span>
                <span className={`text-xs font-bold px-2 py-1 rounded-lg border text-center ${activities.surf.color}`}>
                  {activities.surf.status}
                </span>
              </div>
              <div className="hub-3d-subcard p-3 flex flex-col justify-between gap-1.5">
                <span className="hub-label flex items-center gap-1">
                  <Thermometer className="w-3.5 h-3.5 text-amber-400" /> Balneazione
                </span>
                <span className={`text-xs font-bold px-2 py-1 rounded-lg border text-center ${activities.swim.color}`}>
                  {activities.swim.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

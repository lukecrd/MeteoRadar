import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Flame, Newspaper, Orbit, Plane } from 'lucide-react';
import { usePolledResource } from '../../hooks/usePolledResource';
import { useFlights } from '../../hooks/useFlights';
import {
  fetchFlightInfo,
  fetchGeoNews,
  fetchMarkets,
  fetchQuakes,
  Flight,
  FLIGHT_HUBS,
  FLIGHT_RADIUS_KM,
  FlightInfo,
  flightColor,
  formatNumber,
  formatPct,
  formatPrice,
  GEO_REGION_META,
  GeoRegion,
  Quake,
  quakeColor,
  trendColor,
} from '../../services/hubApi';
import { timeAgo } from '../../services/newsApi';
import { HubGlobe3D, GlobeFlight, GlobeMarker, GlobeRoute } from './HubGlobe3D';
import { CryptoDeck } from './CryptoDeck';
import { MarketBoard } from './MarketBoard';
import { WorldNewsPanel } from './WorldNewsPanel';
import { QuakePanel, QuakeMinMag, quakeMarkerId, QuakeWindow } from './QuakePanel';
import { FlightPanel, flightMarkerId } from './FlightPanel';
import { WorldClocks } from './HubWidgets';
import { EMPTY_FILTERS, FlightFilters, FlightShowMode, matchesFilters } from './flightFilters';
import { FLIGHT_ALT_SCALE } from '../../theme/colorScales';

const NEWS_REFRESH_MS = 5 * 60_000;
const MARKETS_REFRESH_MS = 60_000;
const QUAKES_REFRESH_MS = 2 * 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** keeps the globe light: the strongest N quakes of the current filter */
const MAX_QUAKE_MARKERS = 250;

const REGIONS: (GeoRegion | 'all')[] = ['all', 'europa', 'americhe', 'mena', 'asia'];
const REGION_FOCUS: Record<GeoRegion, { lat: number; lon: number }> = {
  europa: { lat: 48, lon: 14 },
  americhe: { lat: 12, lon: -78 },
  mena: { lat: 18, lon: 32 },
  asia: { lat: 18, lon: 118 },
};

// Stock markets live only in their side panel: on the globe they hid the rest.
type Layer = 'news' | 'quakes';
const LAYERS: { id: Layer; label: string; color: string; icon: React.ElementType }[] = [
  { id: 'news', label: 'Notizie', color: '#22d3ee', icon: Newspaper },
  { id: 'quakes', label: 'Terremoti', color: '#f97316', icon: Activity },
];
const PREFS_KEY = 'globalhub_prefs_v2';

interface HubPrefs {
  layers: Record<Layer, boolean>;
  flightMode: FlightShowMode;
  flightFilters: FlightFilters;
  pinned: string[];
}

const DEFAULT_PREFS: HubPrefs = { layers: { news: true, quakes: true }, flightMode: 'all', flightFilters: EMPTY_FILTERS, pinned: [] };

function loadPrefs(): HubPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null');
    if (!saved || typeof saved !== 'object') return DEFAULT_PREFS;
    return {
      layers: { ...DEFAULT_PREFS.layers, ...saved.layers },
      flightMode: ['none', 'all', 'filtered', 'pinned'].includes(saved.flightMode) ? saved.flightMode : 'all',
      flightFilters: { ...EMPTY_FILTERS, ...saved.flightFilters },
      pinned: Array.isArray(saved.pinned) ? saved.pinned.filter((x: unknown) => typeof x === 'string').slice(0, 200) : [],
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

const newsMarkerId = (areaId: string) => `news:${areaId}`;
const fl = (ft: number) => `FL${String(Math.round(ft / 100)).padStart(3, '0')}`;

export const GlobalHub: React.FC = () => {
  const news = usePolledResource(fetchGeoNews, NEWS_REFRESH_MS);
  const markets = usePolledResource(fetchMarkets, MARKETS_REFRESH_MS);
  const quakesRes = usePolledResource(fetchQuakes, QUAKES_REFRESH_MS);
  const air = useFlights(true);

  const [region, setRegion] = useState<GeoRegion | 'all'>('all');
  const [prefs, setPrefs] = useState<HubPrefs>(loadPrefs);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lon: number } | null>(null);
  const [quakeWindow, setQuakeWindow] = useState<QuakeWindow>('24h');
  const [quakeMinMag, setQuakeMinMag] = useState<QuakeMinMag>(0);

  const { layers, flightMode, flightFilters, pinned } = prefs;
  const areas = news.data?.areas ?? [];
  const quotes = markets.data?.quotes ?? [];

  const updatePrefs = (patch: Partial<HubPrefs>) =>
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        // Private mode: the choice still works for this visit.
      }
      return next;
    });
  const toggleLayer = (id: Layer) => updatePrefs({ layers: { ...layers, [id]: !layers[id] } });
  // The "Voli" chip remembers which flight view to come back to.
  const [lastFlightMode, setLastFlightMode] = useState<FlightShowMode>(flightMode === 'none' ? 'all' : flightMode);
  const setFlightMode = (m: FlightShowMode) => {
    if (m !== 'none') setLastFlightMode(m);
    updatePrefs({ flightMode: m });
  };
  const togglePin = (hex: string) =>
    updatePrefs({ pinned: pinned.includes(hex) ? pinned.filter((p) => p !== hex) : [...pinned, hex] });

  // ---- Earthquakes ----
  const quakes = useMemo(() => {
    const since = Date.now() - (quakeWindow === '24h' ? DAY_MS : 7 * DAY_MS);
    return (quakesRes.data?.quakes ?? []).filter((q) => q.time >= since && q.mag >= quakeMinMag);
  }, [quakesRes.data, quakeWindow, quakeMinMag]);

  // ---- Flights ----
  const selectedHex = selectedId?.startsWith('flt:') ? selectedId.slice(4) : null;
  const liveSelected = selectedHex ? air.flights.find((f) => f.hex === selectedHex) ?? null : null;
  // Keep showing an aircraft that just left the sampled airspace.
  const [lastSelected, setLastSelected] = useState<Flight | null>(null);
  useEffect(() => {
    if (liveSelected) setLastSelected(liveSelected);
    else if (!selectedHex) setLastSelected(null);
  }, [liveSelected, selectedHex]);
  const selectedFlight = liveSelected ?? (lastSelected?.hex === selectedHex ? lastSelected : null);

  const [flightInfo, setFlightInfo] = useState<FlightInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const infoKey = selectedFlight ? `${selectedFlight.cs}|${selectedFlight.hex}` : null;
  useEffect(() => {
    setFlightInfo(null);
    setInfoError(null);
    if (!infoKey) return;
    const [cs, hex] = infoKey.split('|');
    let cancelled = false;
    setInfoLoading(true);
    fetchFlightInfo(cs, hex)
      .then((info) => !cancelled && setFlightInfo(info))
      .catch((err) => !cancelled && setInfoError(err?.message || 'Dettagli volo non disponibili'))
      .finally(() => !cancelled && setInfoLoading(false));
    return () => {
      cancelled = true;
    };
  }, [infoKey]);

  // ---- Globe layers ----
  const markers: GlobeMarker[] = useMemo(() => {
    const out: GlobeMarker[] = [];
    if (layers.news) {
      const maxRecent = Math.max(1, ...areas.map((a) => a.recentCount));
      for (const a of areas) {
        if (!a.items.length) continue;
        out.push({
          id: newsMarkerId(a.id),
          kind: 'news',
          lat: a.lat,
          lon: a.lon,
          label: a.name,
          sublabel: `${a.items.length} notizie · ${a.recentCount} nelle ultime 6 h`,
          color: GEO_REGION_META[a.region].color,
          heat: a.recentCount / maxRecent,
          dimmed: region !== 'all' && a.region !== region,
        });
      }
    }
    if (layers.quakes) {
      const strongest = [...quakes].sort((a, b) => b.mag - a.mag).slice(0, MAX_QUAKE_MARKERS);
      for (const q of strongest) {
        out.push({
          id: quakeMarkerId(q.id),
          kind: 'quake',
          lat: q.lat,
          lon: q.lon,
          label: `M${formatNumber(q.mag, 1)} · ${q.place}`,
          sublabel: `${timeAgo(q.time)} · profondità ${formatNumber(q.depthKm, 0)} km · ${q.source}`,
          color: quakeColor(q.mag),
          heat: Math.min(1, Math.max(0, (q.mag - 2) / 5)),
        });
      }
    }
    // Airports of the selected flight's route.
    if (flightInfo && selectedFlight) {
      for (const [ap, role] of [
        [flightInfo.origin, 'Partenza'],
        [flightInfo.destination, 'Arrivo'],
      ] as const) {
        if (!ap) continue;
        out.push({
          id: `apt:${role}:${ap.icao}`,
          kind: 'airport',
          lat: ap.lat,
          lon: ap.lon,
          label: `${ap.iata ?? ap.icao} · ${ap.city || ap.name}`,
          sublabel: `${role} · ${ap.name}`,
          color: '#f8fafc',
          heat: 0,
        });
      }
    }
    return out;
  }, [areas, quakes, region, layers, flightInfo, selectedFlight?.hex]);

  const globeFlights: GlobeFlight[] = useMemo(() => {
    const pinnedSet = new Set(pinned);
    if (flightMode === 'none') return [];
    const visible = air.flights.filter(
      (f) =>
        // The selected aircraft stays visible in every view except "Nessuno".
        f.hex === selectedHex ||
        (flightMode === 'all' ||
          (flightMode === 'filtered' && matchesFilters(f, flightFilters)) ||
          (flightMode === 'pinned' && pinnedSet.has(f.hex)))
    );
    return visible.map((f) => ({
      id: flightMarkerId(f.hex),
      lat: f.lat,
      lon: f.lon,
      trk: f.trk,
      gs: f.gs,
      alt: f.alt,
      color: flightColor(f.alt),
      label: f.cs,
      sublabel: [f.type, fl(f.alt), f.gs != null ? `${formatNumber(f.gs * 1.852, 0)} km/h` : null].filter(Boolean).join(' · '),
    }));
  }, [air.flights, flightMode, flightFilters, pinned, selectedHex]);

  const route: GlobeRoute | null =
    selectedFlight && flightInfo?.origin && flightInfo.destination
      ? {
          from: flightInfo.origin,
          to: flightInfo.destination,
          via: { lat: selectedFlight.lat, lon: selectedFlight.lon },
          color: flightColor(selectedFlight.alt),
        }
      : null;

  // Radar zones are only drawn while filtering by zone, to keep the map clean.
  const coverage = useMemo(
    () =>
      flightMode === 'filtered' && flightFilters.hubs.length
        ? FLIGHT_HUBS.filter((h) => flightFilters.hubs.includes(h.id)).map((h) => ({ lat: h.lat, lon: h.lon, radiusKm: FLIGHT_RADIUS_KM }))
        : [],
    [flightMode, flightFilters.hubs]
  );

  // ---- Selection ----
  const select = (id: string | null, at?: { lat: number; lon: number }) => {
    setSelectedId(id);
    if (at) setFocus({ lat: at.lat, lon: at.lon });
  };

  /** Clicks on the globe arrive as ids only. */
  const selectById = (id: string) => {
    const m = markers.find((mm) => mm.id === id);
    if (m) return select(id, m);
    const f = air.flights.find((ff) => flightMarkerId(ff.hex) === id);
    if (f) return select(id, f);
  };

  const selectedArea = selectedId?.startsWith('news:') ? areas.find((a) => newsMarkerId(a.id) === selectedId) ?? null : null;

  const selectQuake = (q: Quake) => {
    if (!layers.quakes) toggleLayer('quakes');
    select(quakeMarkerId(q.id), q);
  };

  const selectFlight = (f: Flight) => select(flightMarkerId(f.hex), f);

  const hotspots = useMemo(
    () =>
      [...areas]
        .filter((a) => region === 'all' || a.region === region)
        .sort((a, b) => b.recentCount - a.recentCount)
        .slice(0, 3),
    [areas, region]
  );

  const sp500 = quotes.find((q) => q.symbol === '^GSPC');
  const mib = quotes.find((q) => q.symbol === 'FTSEMIB.MI');
  const totalStories = areas.reduce((n, a) => n + a.items.length, 0);
  const quakes24h = (quakesRes.data?.quakes ?? []).filter((q) => q.time > Date.now() - DAY_MS);
  const strongest24h = quakes24h.reduce<Quake | null>((m, q) => (!m || q.mag > m.mag ? q : m), null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="hub-panel hub-panel--glow p-4 sm:p-5 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="hub-label flex items-center gap-2">
            <span className="hub-live-dot" /> Centro di comando globale
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-1 flex items-center gap-3">
            <Orbit className="w-8 h-8 text-[var(--hub-cyan)]" />
            Mondo
          </h2>
          <p className="text-sm text-[var(--hub-dim)] mt-1">
            {totalStories > 0 ? `${totalStories} notizie da ${areas.length} aree` : 'Notizie geolocalizzate'}
            {quakes24h.length > 0 && (
              <>
                {' · '}
                {quakes24h.length} terremoti in 24 h
                {strongest24h && (
                  <>
                    {' '}(max <span className="inline-block w-2 h-2 rounded-full align-middle" style={{ background: quakeColor(strongest24h.mag) }} aria-hidden="true" /> M{formatNumber(strongest24h.mag, 1)})
                  </>
                )}
              </>
            )}
            {air.flights.length > 0 && ` · ${formatNumber(air.flights.length, 0)} aerei in volo`}
            {mib && (
              <>
                {' · '}MIB <span style={{ color: trendColor(mib.changePct) }}>{formatPct(mib.changePct)}</span>
              </>
            )}
            {sp500 && (
              <>
                {' · '}S&P <span style={{ color: trendColor(sp500.changePct) }}>{formatPct(sp500.changePct)}</span>
              </>
            )}
          </p>
        </div>
        <WorldClocks />
      </section>

      <CryptoDeck />

      {/* Region filter (news) + globe layers */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
        <div className="flex gap-2 overflow-x-auto pb-1" role="toolbar" aria-label="Filtra notizie per area geografica">
          {REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              className="hub-chip"
              aria-pressed={region === r}
              style={{ ['--chip-color' as any]: GEO_REGION_META[r].color }}
              onClick={() => {
                setRegion(r);
                setSelectedId(null);
                if (r !== 'all') setFocus(REGION_FOCUS[r]);
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: GEO_REGION_META[r].color }} />
              {GEO_REGION_META[r].label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Livelli del globo">
          <span className="hub-label self-center shrink-0">Livelli</span>
          {LAYERS.map(({ id, label, color, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className="hub-chip"
              aria-pressed={layers[id]}
              style={{ ['--chip-color' as any]: color }}
              onClick={() => toggleLayer(id)}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: layers[id] ? color : undefined }} />
              {label}
            </button>
          ))}
          <button
            type="button"
            className="hub-chip"
            aria-pressed={flightMode !== 'none'}
            style={{ ['--chip-color' as any]: '#38bdf8' }}
            onClick={() => setFlightMode(flightMode === 'none' ? lastFlightMode : 'none')}
            title="Scegli quali voli mostrare dal pannello Traffico aereo"
          >
            <Plane className="w-3.5 h-3.5" style={{ color: flightMode !== 'none' ? '#38bdf8' : undefined }} />
            Voli
            {flightMode !== 'none' && <span className="opacity-70">{formatNumber(globeFlights.length, 0)}</span>}
          </button>
        </div>
      </div>

      {/* News | Globe | Markets */}
      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)_330px] gap-4 xl:h-[680px]">
        <div className="order-2 xl:order-1 h-[480px] xl:h-auto min-h-0 flex">
          <WorldNewsPanel
            areas={areas}
            region={region}
            selectedArea={selectedArea}
            isLoading={news.isLoading}
            error={news.error}
            onSelectArea={(id) => {
              const a = areas.find((x) => x.id === id);
              select(newsMarkerId(id), a);
            }}
            onClearArea={() => setSelectedId(null)}
          />
        </div>

        <div className="order-1 xl:order-2 hub-panel overflow-hidden relative h-[420px] sm:h-[520px] xl:h-auto hub-globe-stage">
          <HubGlobe3D
            markers={markers}
            flights={globeFlights}
            route={route}
            coverage={coverage}
            selectedId={selectedId}
            onSelect={selectById}
            focus={focus}
          />

          {/* Hotspots */}
          {layers.news && (
            <div className="absolute left-3 top-3 z-10 space-y-1.5 pointer-events-none max-w-[60%]">
              <div className="hub-label flex items-center gap-1.5">
                <Flame className="w-3 h-3 text-[var(--hub-red)]" /> Hotspot ultime 6 h
              </div>
              {hotspots.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => select(newsMarkerId(a.id), a)}
                  className="pointer-events-auto hub-chip !h-7 !text-xs"
                  aria-pressed={selectedId === newsMarkerId(a.id)}
                  style={{ ['--chip-color' as any]: GEO_REGION_META[a.region].color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: GEO_REGION_META[a.region].color }} />
                  {a.name} <span className="opacity-70">{a.recentCount}</span>
                </button>
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="absolute left-3 bottom-3 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 font-hud text-xs text-[var(--hub-dim)] pointer-events-none max-w-[80%]">
            {layers.news && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--hub-cyan)] shadow-[0_0_6px_var(--hub-cyan)]" /> Notizie
              </span>
            )}
            {layers.quakes && (
              <span className="flex items-center gap-1.5">
                Terremoti
                {[3, 4, 5, 6].map((m) => (
                  <span key={m} className="flex items-center gap-0.5">
                    <span className="rounded-full" style={{ background: quakeColor(m), width: 4 + (m - 2) * 2, height: 4 + (m - 2) * 2 }} />M{m}
                  </span>
                ))}
              </span>
            )}
            {globeFlights.length > 0 && (
              <span className="flex items-center gap-1.5">
                <Plane className="w-3 h-3" /> Voli
                {FLIGHT_ALT_SCALE.map((b) => (
                  <span key={b.label} className="flex items-center gap-0.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: b.color }} />{b.label}
                  </span>
                ))}
              </span>
            )}
            <span className="hidden sm:inline">Trascina per ruotare · tocca un punto</span>
          </div>
        </div>

        <div className="order-3 h-[520px] xl:h-auto min-h-0 flex">
          <MarketBoard
            quotes={quotes}
            isLoading={markets.isLoading}
            error={markets.error}
            fetchedAt={markets.data?.fetchedAt ?? null}
            onRefresh={markets.refresh}
          />
        </div>
      </div>

      {/* Earthquakes | Air traffic */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 xl:h-[640px]">
        <div className="h-[560px] xl:h-auto min-h-0 flex">
          <QuakePanel
            quakes={quakes}
            window={quakeWindow}
            minMag={quakeMinMag}
            onWindowChange={setQuakeWindow}
            onMinMagChange={setQuakeMinMag}
            selectedId={selectedId}
            onSelect={selectQuake}
            isLoading={quakesRes.isLoading}
            error={quakesRes.error}
          />
        </div>
        <div className="h-[640px] xl:h-auto min-h-0 flex">
          <FlightPanel
            flights={air.flights}
            loadedHubs={air.loadedHubs}
            isLoading={air.isLoading}
            filters={flightFilters}
            onFiltersChange={(next) => {
              // Picking a single new zone turns the globe towards it.
              const added = next.hubs.find((id) => !flightFilters.hubs.includes(id));
              const h = FLIGHT_HUBS.find((x) => x.id === added);
              if (h) setFocus({ lat: h.lat, lon: h.lon });
              updatePrefs({ flightFilters: next, flightMode: flightMode === 'all' && next !== flightFilters ? 'filtered' : flightMode });
            }}
            mode={flightMode}
            onModeChange={setFlightMode}
            pinned={pinned}
            onTogglePin={togglePin}
            onClearPins={() => updatePrefs({ pinned: [] })}
            shownOnGlobe={globeFlights.length}
            selected={selectedFlight}
            info={flightInfo}
            infoLoading={infoLoading}
            infoError={infoError}
            onSelect={selectFlight}
            onClear={() => setSelectedId(null)}
          />
        </div>
      </div>

      <p className="hub-label text-center !normal-case !tracking-normal opacity-70">
        Fonti: Google News (notizie) · Yahoo Finance (borse, dati non ufficiali con possibile ritardo) · Binance / CoinGecko (crypto) ·
        USGS e INGV (terremoti) · adsb.fi / adsb.lol (traffico aereo ADS-B) e adsbdb (rotte). Solo a scopo informativo.
      </p>
    </div>
  );
};

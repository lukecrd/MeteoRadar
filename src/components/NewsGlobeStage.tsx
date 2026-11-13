import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Activity, Bitcoin, CandlestickChart, Crosshair, Flame, Newspaper, Plane, Satellite, ShieldAlert, Square, X, LucideIcon } from 'lucide-react';
import { LightningStrike, LocationInfo, WeatherAlertInfo } from '../types';
import { timeAgo } from '../services/newsApi';
import {
  DISASTER_LABEL,
  Disaster,
  Earthquake,
  FeedResponse,
  FlightDetail,
  FlightsResponse,
  GDACS_LEVEL_COLOR,
  ISS_NORAD,
  LAYER_META,
  SatelliteGroup,
  VOLCANO_ALERT_COLOR,
  Volcano,
  WORLD_ENDPOINTS,
  WorldLayer,
  ALT_BANDS,
  AltBand,
  altBandOf,
  flightColor,
  quakeColor,
} from '../services/worldEventsApi';
import { fetchGeoNews, fetchMarkets, GEO_REGION_META } from '../services/hubApi';
import { usePolledResource } from '../hooks/usePolledResource';
import { MarketBoard } from './hub/MarketBoard';
import { CryptoDeck } from './hub/CryptoDeck';
import { WorldNewsPanel } from './hub/WorldNewsPanel';
import { usePolledJson } from '../hooks/usePolledJson';
import { orbitTrack, useSatellites } from '../hooks/useSatellites';
import { destinationPoint, greatCircle, useFlightTracker } from '../hooks/useFlightTracker';
import { WorldEventGlobe, GlobeFocus, GlobeMarker, GlobePath } from './WorldEventGlobe';
import { FlightCard, FlightSearch } from './FlightCard';
import { NewsHub } from './NewsHub';
import { AlertsList, FlightsList, QuakesList, SatellitesList, VolcanoesList } from './WorldEventPanels';
import { classifyFlight, FLIGHT_TYPE_FILTERS, FlightTypeCategory } from '../services/flightClassifier';

type Side = 'left' | 'right';
type WindowId = 'news' | 'flights' | 'satellites' | 'markets' | 'quakes' | 'volcanoes' | 'alerts' | 'crypto';

interface WindowDef {
  id: WindowId;
  side: Side;
  title: string;
  icon: LucideIcon;
  /** Globe layer this window controls, if any */
  layer?: WorldLayer;
}

// Any number of windows can be open at once; each side stacks its open
// windows vertically and the page grows / scrolls instead of hiding them.
const WINDOWS: WindowDef[] = [
  { id: 'news', side: 'left', title: 'Notizie', icon: Newspaper, layer: 'news' },
  { id: 'flights', side: 'left', title: 'Voli', icon: Plane, layer: 'flights' },
  { id: 'satellites', side: 'left', title: 'Satelliti', icon: Satellite, layer: 'satellites' },
  { id: 'markets', side: 'left', title: 'Mercati', icon: CandlestickChart },
  { id: 'quakes', side: 'right', title: 'Terremoti', icon: Activity, layer: 'quakes' },
  { id: 'volcanoes', side: 'right', title: 'Vulcani', icon: Flame, layer: 'volcanoes' },
  { id: 'alerts', side: 'right', title: 'Allerte', icon: ShieldAlert, layer: 'alerts' },
  { id: 'crypto', side: 'right', title: 'Cripto', icon: Bitcoin },
];

const GEO_NEWS_REFRESH_MS = 5 * 60_000;
const MARKETS_REFRESH_MS = 60_000;

/** Markets poll only while their window is mounted (open). */
const MarketsWindow: React.FC = () => {
  const markets = usePolledResource(fetchMarkets, MARKETS_REFRESH_MS);
  return (
    <MarketBoard
      quotes={markets.data?.quotes ?? []}
      isLoading={markets.isLoading}
      error={markets.error}
      fetchedAt={markets.data?.fetchedAt ?? null}
      onRefresh={markets.refresh}
    />
  );
};

/** Altitude-band, Aircraft-type, and Airline filter for the flight layer. */
const FlightFilterBar: React.FC<{
  bands: AltBand[];
  onToggle: (b: AltBand) => void;
  typeFilter: FlightTypeCategory;
  onTypeChange: (t: FlightTypeCategory) => void;
  airlineFilter: string;
  onAirlineChange: (a: string) => void;
  airlines: Array<{ name: string; count: number }>;
  query: string;
  onQuery: (q: string) => void;
  onReset: () => void;
}> = ({
  bands,
  onToggle,
  typeFilter,
  onTypeChange,
  airlineFilter,
  onAirlineChange,
  airlines,
  query,
  onQuery,
  onReset,
}) => {
  const hasFilters = bands.length > 0 || typeFilter !== 'all' || airlineFilter !== 'all' || query.trim().length > 0;
  return (
    <div className="space-y-2.5 p-2.5 rounded-xl border border-[var(--hub-line)] bg-[var(--hub-panel)]">
      <div className="flex items-center justify-between gap-2">
        <div className="hub-label">Quota (filtro sul globo)</div>
        {hasFilters && (
          <button type="button" onClick={onReset} className="text-[11px] text-[var(--hub-cyan)] hover:underline">
            Azzera filtri
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtra per quota">
        {ALT_BANDS.map((b) => (
          <button
            key={b.id}
            type="button"
            className="hub-chip !h-7 text-xs"
            aria-pressed={bands.length === 0 || bands.includes(b.id)}
            onClick={() => onToggle(b.id)}
            title={b.hint}
            style={{ ['--chip-color' as any]: b.color }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: b.color }} />
            {b.label}
          </button>
        ))}
      </div>

      <div>
        <div className="hub-label mb-1">Tipo Aeromobile</div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtra per tipo aeromobile">
          {FLIGHT_TYPE_FILTERS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTypeChange(t.id)}
              aria-pressed={typeFilter === t.id}
              className="hub-chip !h-7 text-xs"
            >
              {t.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="globe-airline-select" className="hub-label block mb-1">
          Compagnia Aerea
        </label>
        <select
          id="globe-airline-select"
          value={airlineFilter}
          onChange={(e) => onAirlineChange(e.target.value)}
          className="w-full h-8 px-2.5 rounded-lg border border-[var(--hub-line)] bg-[var(--hub-panel-strong)] text-xs focus:outline-none focus:border-[var(--hub-line-strong)]"
        >
          <option value="all">Tutte le compagnie ({airlines.length} attive)</option>
          {airlines.map((a) => (
            <option key={a.name} value={a.name}>
              {a.name} ({a.count})
            </option>
          ))}
        </select>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Filtra per nominativo, modello, compagnia o Paese…"
        aria-label="Filtra i voli mostrati"
        className="w-full h-8 px-3 rounded-lg border border-[var(--hub-line)] bg-[var(--hub-panel-strong)] text-xs focus:outline-none focus:border-[var(--hub-line-strong)] placeholder:text-[var(--hub-dim)]"
      />
    </div>
  );
};

const LOCAL_LEVEL_COLOR: Record<WeatherAlertInfo['level'], string> = {
  green: '#4ade80',
  yellow: '#facc15',
  orange: '#fb923c',
  red: '#ef4444',
};

const REFRESH = { quakes: 90_000, volcanoes: 90_000, flights: 60_000, areaFlights: 20_000, disasters: 5 * 60_000 };
// From this zoom (view ~2000 km across) the globe also loads every aircraft around
// its centre; the global feed alone is a 300-plane sample with little local traffic.
const AREA_FLIGHTS_MIN_ZOOM = 6;
const ISS_COLOR = '#facc15';
const TRACK_REFRESH_MS = 60_000;
const TRACKED_FLIGHT_COLOR = '#ffffff';

type SampleFlight = FlightsResponse['items'][number];

/** Minimal FlightDetail from a sampled marker, until /live answers. */
function seedFromSample(f: SampleFlight): FlightDetail {
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
    aircraftType: null,
    source: 'opensky',
  };
}

const MOBILE_QUERY = '(max-width: 767px)';
const MIN_STAGE_PX = 360;
const CLOSED: Record<WindowId, boolean> = {
  news: false,
  flights: false,
  satellites: false,
  markets: false,
  quakes: false,
  volcanoes: false,
  alerts: false,
  crypto: false,
};

function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const on = () => setMatch(mql.matches);
    on();
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, [query]);
  return match;
}

/**
 * Height of the full-bleed stage: from its top edge (under the app header)
 * to the bottom of the viewport, minus the fixed bottom nav on phones, so the
 * globe fills the screen and the page itself never scrolls.
 */
function useStageHeight(sectionRef: React.RefObject<HTMLElement | null>): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = sectionRef.current;
      if (!el) return;
      const bottomNav = [...document.querySelectorAll<HTMLElement>('nav[aria-label="Sezioni principali"]')]
        .filter((n) => getComputedStyle(n).position === 'fixed' && n.offsetHeight > 0)
        .reduce((h, n) => Math.max(h, n.offsetHeight), 0);
      const top = el.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.round(Math.max(MIN_STAGE_PX, window.innerHeight - top - bottomNav)));
    };
    measure();
    // The header above can change height (fonts, wrap, banners); body keeps
    // min-h-screen so its size alone misses that: watch the header too.
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    const header = document.getElementById('main-app-header');
    if (header) ro.observe(header);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [sectionRef]);
  return height;
}

interface NewsGlobeStageProps {
  isDark: boolean;
  location: LocationInfo;
  alerts: WeatherAlertInfo[];
  strikes: LightningStrike[];
}

interface WindowPanelProps {
  def: WindowDef;
  onClose: () => void;
  /** Size + entrance animation: side drawer on desktop, bottom sheet on phones */
  className: string;
  children: React.ReactNode;
}

/** One compact translucent HUD window: header (close) and a scrollable body. Layer visibility lives in the legend. */
const WindowPanel: React.FC<WindowPanelProps> = ({ def, onClose, className, children }) => {
  const { id, title, icon: Icon, layer } = def;
  const accent = layer ? LAYER_META[layer].color : '#38bdf8';
  return (
    <section
      id={`worldhub-window-${id}`}
      aria-label={title}
      style={{ ['--wh-accent' as any]: accent }}
      className={`wh-glass-window flex flex-col shrink-0 ${className}`}
    >
      <header className="flex items-center justify-between gap-2 pl-3 pr-1.5 py-1.5 border-b border-[var(--hub-line)] shrink-0">
        <h2 className="font-display text-sm font-semibold flex items-center gap-1.5 min-w-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: accent }} />
          <span className="truncate">{title}</span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="hub-icon-btn !h-7 !w-7 !min-w-7 !p-0 !border-transparent !bg-transparent hover:!bg-white/10 !shadow-none"
          aria-label={`Chiudi ${title}`}
          title="Chiudi"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </header>
      <div className="hub-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 text-xs">{children}</div>
    </section>
  );
};

interface LegendProps {
  open: Record<WindowId, boolean>;
  layers: Record<WorldLayer, boolean>;
  counts: Record<WorldLayer, number>;
  onToggleWindow: (id: WindowId) => void;
  onToggleLayer: (layer: WorldLayer) => void;
}

/**
 * The map legend is the control: the swatch shows/hides a layer on the globe,
 * the name opens its window. Windows without a layer (markets, crypto) follow a divider.
 */
const Legend: React.FC<LegendProps> = ({ open, layers, counts, onToggleWindow, onToggleLayer }) => {
  const item = (def: WindowDef) => {
    const isOpen = open[def.id];
    const name = (
      <button
        type="button"
        className="wh-legend__name"
        onClick={() => onToggleWindow(def.id)}
        aria-controls={`worldhub-window-${def.id}`}
        aria-expanded={isOpen}
      >
        {def.title}
        {def.layer && <span className="wh-legend__count">{counts[def.layer].toLocaleString('it-IT')}</span>}
      </button>
    );
    if (!def.layer) {
      return (
        <div key={def.id} className={`wh-legend__item wh-legend__item--plain ${isOpen ? 'is-open' : ''}`}>
          {name}
        </div>
      );
    }
    const layer = def.layer;
    const label = LAYER_META[layer].label;
    return (
      <div key={def.id} className={`wh-legend__item ${isOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className="wh-legend__swatch"
          aria-pressed={layers[layer]}
          aria-label={`${label} sul globo`}
          title={layers[layer] ? `Nascondi ${label} dal globo` : `Mostra ${label} sul globo`}
          onClick={() => onToggleLayer(layer)}
          style={{ ['--dot' as any]: LAYER_META[layer].color }}
        >
          <span />
        </button>
        {name}
      </div>
    );
  };
  return (
    <nav aria-label="Legenda e finestre del mappamondo" className="wh-legend">
      {WINDOWS.filter((w) => w.layer).map(item)}
      <span className="wh-legend__sep" aria-hidden />
      {WINDOWS.filter((w) => !w.layer).map(item)}
    </nav>
  );
};

/**
 * WorldHub home: a centred real-time globe (earthquakes, flights, alerts,
 * satellites) with the news feed and every event category in toggleable side
 * windows. Each event window also shows/hides its layer on the globe.
 */
export const NewsGlobeStage: React.FC<NewsGlobeStageProps> = ({ isDark, location, alerts, strikes }) => {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  // Phones start with the globe clear; desktop opens one drawer per side.
  const [open, setOpen] = useState<Record<WindowId, boolean>>(() =>
    typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches ? CLOSED : { ...CLOSED, news: true, quakes: true }
  );
  const [layers, setLayers] = useState<Record<WorldLayer, boolean>>({
    news: true,
    quakes: true,
    volcanoes: true,
    flights: true,
    alerts: true,
    satellites: true,
  });
  const [newsTab, setNewsTab] = useState<'italia' | 'mondo'>('italia');
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [altBands, setAltBands] = useState<AltBand[]>([]);
  const [flightTypeFilter, setFlightTypeFilter] = useState<FlightTypeCategory>('all');
  const [flightAirlineFilter, setFlightAirlineFilter] = useState<string>('all');
  const [flightQuery, setFlightQuery] = useState('');
  const [satGroup, setSatGroup] = useState<SatelliteGroup>('stations');
  const [focus, setFocus] = useState<GlobeFocus | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageHeight = useStageHeight(sectionRef);

  // Selected aircraft (popup) and follow mode.
  const [selectedFlight, setSelectedFlight] = useState<{ icao24: string; seed: FlightDetail | null } | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [following, setFollowing] = useState(false);
  const tracker = useFlightTracker(selectedFlight?.icao24 ?? null, selectedFlight?.seed ?? null);
  const trackedId = selectedFlight ? `f:${selectedFlight.icao24}` : null;

  // Only poll a source while its layer is shown or its window is open.
  const quakes = usePolledJson<FeedResponse<Earthquake>>(WORLD_ENDPOINTS.earthquakes, REFRESH.quakes, layers.quakes || open.quakes);
  const volcanoes = usePolledJson<FeedResponse<Volcano>>(WORLD_ENDPOINTS.volcanoes, REFRESH.volcanoes, layers.volcanoes || open.volcanoes);
  const flights = usePolledJson<FlightsResponse>(WORLD_ENDPOINTS.flights, REFRESH.flights, layers.flights || open.flights);
  // Only the derived URL is state, so the auto-rotating globe re-renders the
  // stage just when the area to load actually changes.
  const [areaUrl, setAreaUrl] = useState<string | null>(null);
  const onGlobeView = useCallback(({ lat, lon, zoom }: { lat: number; lon: number; zoom: number }) => {
    if (zoom < AREA_FLIGHTS_MIN_ZOOM) return setAreaUrl(null);
    // Visible half-width in NM, rounded up to a power of two (max 250, the adsb.fi
    // limit) and the centre snapped to a quarter of it, so small moves do not refetch.
    const radius = Math.min(250, 2 ** Math.ceil(Math.log2((1.12 * 3440) / zoom)));
    const step = Math.max(0.05, radius / 240);
    const snap = (v: number) => (Math.round(v / step) * step).toFixed(2);
    setAreaUrl(WORLD_ENDPOINTS.flightsArea(snap(lat), snap(lon), radius));
  }, []);
  const areaFlights = usePolledJson<FlightsResponse>(areaUrl ?? '', REFRESH.areaFlights, !!areaUrl && (layers.flights || open.flights));
  const flightItems = useMemo(() => {
    const byId = new Map((flights.data?.items ?? []).map((f) => [f.id, f]));
    if (areaUrl) for (const f of areaFlights.data?.items ?? []) byId.set(f.id, f);
    return [...byId.values()];
  }, [flights.data, areaFlights.data, areaUrl]);

  const detectedAirlines = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of flightItems) {
      const meta = classifyFlight(f);
      if (meta.airlineName) {
        counts.set(meta.airlineName, (counts.get(meta.airlineName) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([name, count]) => ({ name, count }));
  }, [flightItems]);

  const filteredFlightItems = useMemo(() => {
    const q = flightQuery.trim().toUpperCase();
    return flightItems.filter((f) => {
      const altFt = (f.altitudeM ?? 0) / 0.3048;
      if (altBands.length && !altBands.includes(altBandOf(altFt))) return false;
      const meta = classifyFlight(f);
      if (flightTypeFilter !== 'all' && meta.category !== flightTypeFilter) return false;
      if (flightAirlineFilter !== 'all' && meta.airlineName !== flightAirlineFilter) return false;
      if (q) {
        const matchCallsign = f.callsign.toUpperCase().includes(q);
        const matchCountry = f.country.toUpperCase().includes(q);
        const matchAirline = (meta.airlineName || '').toUpperCase().includes(q);
        const matchAircraft = meta.aircraftLabel.toUpperCase().includes(q);
        if (!matchCallsign && !matchCountry && !matchAirline && !matchAircraft) return false;
      }
      return true;
    });
  }, [flightItems, altBands, flightTypeFilter, flightAirlineFilter, flightQuery]);

  const disasters = usePolledJson<FeedResponse<Disaster>>(WORLD_ENDPOINTS.disasters, REFRESH.disasters, layers.alerts || open.alerts);
  const sats = useSatellites(satGroup, layers.satellites || open.satellites);
  const geo = usePolledResource(fetchGeoNews, GEO_NEWS_REFRESH_MS);
  const areas = geo.data?.areas ?? [];
  const selectedArea = selectedAreaId ? areas.find((a) => a.id === selectedAreaId) ?? null : null;

  // Phones show one bottom sheet at a time; desktop drawers stack per side.
  const toggleWindow = (id: WindowId) => setOpen((prev) => ({ ...(isMobile ? CLOSED : prev), [id]: !prev[id] }));
  const showWindow = (id: WindowId) => setOpen((prev) => ({ ...(isMobile ? CLOSED : prev), [id]: true }));
  const toggleLayer = (layer: WorldLayer) => setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));

  /* ---------- Surface markers ---------- */
  const markers = useMemo<GlobeMarker[]>(() => {
    const out: GlobeMarker[] = [];
    if (layers.news) {
      for (const a of areas) {
        if (a.items.length === 0) continue;
        out.push({
          id: `n:${a.id}`,
          layer: 'news',
          lat: a.lat,
          lon: a.lon,
          color: GEO_REGION_META[a.region].color,
          size: Math.min(16, 6 + a.recentCount * 1.2),
          title: `${a.name}: ${a.items[0].title}`,
          detail: `${a.items.length} notizie · ${a.recentCount} nelle ultime 6 h`,
        });
      }
    }
    if (layers.flights) {
      for (const f of filteredFlightItems) {
        if (trackedId === `f:${f.id}`) continue; // drawn live below
        const altFt = (f.altitudeM ?? 0) / 0.3048;
        const meta = classifyFlight(f);
        out.push({
          id: `f:${f.id}`,
          layer: 'flights',
          lat: f.lat,
          lon: f.lon,
          color: flightColor(altFt),
          size: 3.5,
          title: `Volo ${f.callsign}${meta.airlineName ? ` · ${meta.airlineName}` : ''}`,
          detail: [meta.aircraftLabel, f.country, f.altitudeM != null ? `${f.altitudeM.toLocaleString('it-IT')} m` : null, f.speedKmh != null ? `${f.speedKmh} km/h` : null]
            .filter(Boolean)
            .join(' · '),
        });
      }
    }
    if (layers.quakes) {
      // Oldest first so the most recent quakes draw on top.
      for (const q of [...(quakes.data?.items ?? [])].reverse()) {
        out.push({
          id: `q:${q.id}`,
          layer: 'quakes',
          lat: q.lat,
          lon: q.lon,
          color: quakeColor(q.mag),
          size: Math.min(22, Math.max(5, 5 + (q.mag - 2.5) * 3.4)),
          title: `M ${q.mag.toFixed(1)} · ${q.place}`,
          detail: `${timeAgo(q.time)} · profondità ${q.depthKm} km`,
        });
      }
    }
    if (layers.volcanoes) {
      for (const v of volcanoes.data?.items ?? []) {
        const baseSize = v.alertColor === 'red' ? 14.5 : v.alertColor === 'orange' ? 12.5 : v.alertColor === 'yellow' ? 10 : 8.5;
        const size = Math.min(18, baseSize + Math.min(3.5, v.seismicCount7d * 0.4));
        out.push({
          id: `v:${v.id}`,
          layer: 'volcanoes',
          lat: v.lat,
          lon: v.lon,
          color: VOLCANO_ALERT_COLOR[v.alertColor],
          size,
          title: `Vulcano ${v.name} (${v.country})`,
          detail: `${v.type} · ${v.elevationM} m · ${v.seismicCount7d > 0 ? `${v.seismicCount7d} sismi vicini` : v.lastEruption}`,
        });
      }
    }
    if (layers.alerts) {
      for (const d of disasters.data?.items ?? []) {
        out.push({
          id: `d:${d.id}`,
          layer: 'alerts',
          lat: d.lat,
          lon: d.lon,
          color: GDACS_LEVEL_COLOR[d.alertLevel] ?? '#94a3b8',
          size: d.alertLevel === 'Red' ? 14 : d.alertLevel === 'Orange' ? 11 : 8,
          title: `${DISASTER_LABEL[d.type] ?? d.type}: ${d.name}`,
          detail: `GDACS · allerta ${d.alertLevel.toLowerCase()}${d.country ? ` · ${d.country}` : ''}`,
        });
      }
      for (const s of strikes) {
        out.push({
          id: `l:${s.id}`,
          layer: 'alerts',
          lat: s.latitude,
          lon: s.longitude,
          color: LOCAL_LEVEL_COLOR[s.severityZone],
          size: 7,
          title: `Fulmine ${s.type} ${s.polarity} · ${s.distanceKm.toFixed(1)} km`,
          detail: `${location.name} · ${timeAgo(s.timestamp)}`,
        });
      }
      for (const a of alerts) {
        out.push({
          id: `w:${a.id}`,
          layer: 'alerts',
          lat: location.latitude,
          lon: location.longitude,
          color: LOCAL_LEVEL_COLOR[a.level],
          size: 12,
          title: a.title,
          detail: `${location.name} · ${a.issuer}`,
        });
      }
    }
    // The selected / followed aircraft is always drawn (even when not in the
    // 300-aircraft sample or with the Voli layer hidden), at its dead-reckoned position.
    if (selectedFlight && tracker.position) {
      const f = tracker.flight;
      out.push({
        id: `f:${selectedFlight.icao24}`,
        layer: 'flights',
        lat: tracker.position.lat,
        lon: tracker.position.lon,
        color: TRACKED_FLIGHT_COLOR,
        size: 8,
        title: `Volo ${f?.callsign ?? selectedFlight.icao24.toUpperCase()}`,
        detail: [f?.country, f?.baroAltM != null ? `${Math.round(f.baroAltM).toLocaleString('it-IT')} m` : null, f?.speedMs != null ? `${Math.round(f.speedMs * 3.6)} km/h` : null]
          .filter(Boolean)
          .join(' · '),
      });
    }
    return out;
  }, [layers, areas, filteredFlightItems, quakes.data, volcanoes.data, disasters.data, strikes, alerts, location, selectedFlight, tracker.position, tracker.flight, trackedId]);

  /* ---------- Satellites (re-propagated every second) ---------- */
  const orbitals = useMemo<GlobeMarker[]>(() => {
    if (!layers.satellites) return [];
    const dense = sats.states.length > 400;
    return sats.states.map((s) => {
      const iss = s.norad === ISS_NORAD;
      return {
        id: `s:${s.norad}`,
        layer: 'satellites' as const,
        lat: s.lat,
        lon: s.lon,
        altKm: s.altKm,
        color: iss ? ISS_COLOR : LAYER_META.satellites.color,
        size: iss ? 10 : dense ? 3 : 5.5,
        title: iss ? `${s.name} · Stazione Spaziale Internazionale` : s.name,
        detail: `NORAD ${s.norad} · ${Math.round(s.altKm).toLocaleString('it-IT')} km · ${s.speedKms.toFixed(2)} km/s`,
      };
    });
  }, [layers.satellites, sats.states]);

  // Orbit of the selected satellite, or of the ISS when nothing is selected.
  const selectedNorad = highlightId?.startsWith('s:') ? Number(highlightId.slice(2)) : sats.satrecByNorad.has(ISS_NORAD) ? ISS_NORAD : null;
  const [trackEpoch, setTrackEpoch] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTrackEpoch(Date.now()), TRACK_REFRESH_MS);
    return () => clearInterval(id);
  }, []);
  const track = useMemo(() => {
    if (!layers.satellites || selectedNorad == null) return null;
    const satrec = sats.satrecByNorad.get(selectedNorad);
    return satrec ? orbitTrack(satrec, new Date(trackEpoch)) : null;
  }, [layers.satellites, selectedNorad, sats.satrecByNorad, trackEpoch]);

  const focusOn = useCallback(
    (id: string, layer: WorldLayer, lat: number, lon: number) => {
      setLayers((prev) => (prev[layer] ? prev : { ...prev, [layer]: true }));
      setHighlightId(id);
      setFocus({ lat, lon, seq: Date.now() });
      // Phones: the sheet covers the lower globe, so close it to reveal the focused point.
      if (isMobile) setOpen(CLOSED);
    },
    [isMobile]
  );

  /** Open the popup for an aircraft (from globe, list or search). */
  const openFlight = useCallback(
    (seed: FlightDetail) => {
      setSelectedFlight((prev) => {
        if (prev?.icao24 === seed.icao24) return prev;
        setFollowing(false);
        return { icao24: seed.icao24, seed };
      });
      setCardOpen(true);
      setHighlightId(`f:${seed.icao24}`);
      setFocus({ lat: seed.lat, lon: seed.lon, seq: Date.now() });
    },
    []
  );

  const stopFollowing = useCallback(() => setFollowing(false), []);
  const closeCard = useCallback(() => {
    setCardOpen(false);
    // Keep the aircraft selected only while it is being followed.
    if (!following) {
      setSelectedFlight(null);
      setHighlightId((h) => (h?.startsWith('f:') ? null : h));
    }
  }, [following]);

  const sampleById = useMemo(() => new Map(flightItems.map((f) => [f.id, f])), [flightItems]);

  const onMarkerSelect = useCallback(
    (m: GlobeMarker) => {
      if (m.layer === 'flights') {
        const icao = m.id.slice(2);
        if (selectedFlight?.icao24 === icao) {
          setCardOpen(true);
          return;
        }
        const sample = sampleById.get(icao);
        if (sample) return openFlight(seedFromSample(sample));
      }
      if (m.layer === 'news') {
        // Area marker: show that area's headlines in the Notizie window.
        showWindow('news');
        setNewsTab('mondo');
        setSelectedAreaId(m.id.slice(2));
      }
      if (m.layer === 'volcanoes') {
        showWindow('volcanoes');
      }
      setHighlightId(m.id);
      setFocus({ lat: m.lat, lon: m.lon, seq: Date.now() });
    },
    [sampleById, openFlight, selectedFlight, isMobile]
  );

  // Esc closes the flight popup.
  useEffect(() => {
    if (!cardOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCard();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cardOpen, closeCard]);

  /* ---------- Paths: satellite orbit + flight route / trail / heading ---------- */
  const paths = useMemo<GlobePath[]>(() => {
    const out: GlobePath[] = [];
    if (track) out.push({ id: 'orbit', points: track, color: selectedNorad === ISS_NORAD ? ISS_COLOR : LAYER_META.satellites.color, opacity: 0.7 });
    const pos = tracker.position;
    if (selectedFlight && pos) {
      const route = tracker.info?.route;
      if (route?.origin) out.push({ id: 'route-done', points: greatCircle(route.origin, pos, 48), color: '#94a3b8', opacity: 0.45 });
      if (route?.destination) out.push({ id: 'route-next', points: greatCircle(pos, route.destination, 64), color: '#38bdf8', opacity: 0.8 });
      if (tracker.trail.length > 1) out.push({ id: 'trail', points: [...tracker.trail, pos], color: TRACKED_FLIGHT_COLOR, opacity: 0.95 });
      const hdg = tracker.flight?.trackDeg;
      if (hdg != null && !tracker.flight?.onGround) {
        out.push({ id: 'heading', points: greatCircle(pos, destinationPoint(pos, hdg, 250), 8), color: '#f8fafc', opacity: 0.9 });
      }
    }
    return out;
  }, [track, selectedNorad, selectedFlight, tracker.position, tracker.info, tracker.trail, tracker.flight]);

  const counts: Record<WorldLayer, number> = {
    news: areas.filter((a) => a.items.length > 0).length,
    quakes: quakes.data?.items.length ?? 0,
    volcanoes: volcanoes.data?.items.length ?? 0,
    flights: flights.data?.totalAirborne ?? 0,
    alerts: (disasters.data?.items.length ?? 0) + alerts.length + strikes.length,
    satellites: sats.states.length,
  };

  const renderWindowBody = (id: WindowId) => {
    switch (id) {
      case 'news':
        return (
          <div className="space-y-4">
            <div role="tablist" aria-label="Fonte notizie" className="grid grid-cols-2 gap-1 p-1 rounded-xl border border-[var(--hub-line)]">
              {(['italia', 'mondo'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={newsTab === t}
                  onClick={() => setNewsTab(t)}
                  className={`h-8 rounded-lg text-sm font-semibold transition-colors ${
                    newsTab === t ? 'bg-[var(--hub-glow)] text-[var(--hub-text)]' : 'text-[var(--hub-dim)] hover:text-[var(--hub-text)]'
                  }`}
                >
                  {t === 'italia' ? 'Ultime notizie' : 'Dal mondo'}
                </button>
              ))}
            </div>
            {newsTab === 'italia' ? (
              <NewsHub embedded />
            ) : (
              <WorldNewsPanel
                areas={areas}
                region="all"
                selectedArea={selectedArea}
                isLoading={geo.isLoading}
                error={geo.error}
                onSelectArea={(id) => {
                  const a = areas.find((x) => x.id === id);
                  setSelectedAreaId(id);
                  if (a) focusOn(`n:${a.id}`, 'news', a.lat, a.lon);
                }}
                onClearArea={() => setSelectedAreaId(null)}
              />
            )}
          </div>
        );
      case 'markets':
        return <MarketsWindow />;
      case 'crypto':
        return <CryptoDeck />;
      case 'quakes':
        return (
          <QuakesList
            feed={quakes.data}
            isLoading={quakes.isLoading}
            error={quakes.error}
            onRetry={quakes.retry}
            activeId={highlightId}
            onFocus={(q) => focusOn(`q:${q.id}`, 'quakes', q.lat, q.lon)}
          />
        );
      case 'volcanoes':
        return (
          <VolcanoesList
            feed={volcanoes.data}
            isLoading={volcanoes.isLoading}
            error={volcanoes.error}
            onRetry={volcanoes.retry}
            activeId={highlightId}
            onFocus={(v) => focusOn(`v:${v.id}`, 'volcanoes', v.lat, v.lon)}
          />
        );
      case 'flights':
        return (
          <FlightsList
            feed={flights.data}
            filteredItems={filteredFlightItems}
            isLoading={flights.isLoading}
            error={flights.error}
            onRetry={flights.retry}
            search={
              <div className="space-y-3">
                <FlightSearch onSelect={openFlight} />
                <FlightFilterBar
                  bands={altBands}
                  onToggle={(b) => setAltBands((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]))}
                  typeFilter={flightTypeFilter}
                  onTypeChange={setFlightTypeFilter}
                  airlineFilter={flightAirlineFilter}
                  onAirlineChange={setFlightAirlineFilter}
                  airlines={detectedAirlines}
                  query={flightQuery}
                  onQuery={setFlightQuery}
                  onReset={() => {
                    setAltBands([]);
                    setFlightTypeFilter('all');
                    setFlightAirlineFilter('all');
                    setFlightQuery('');
                  }}
                />
              </div>
            }
            activeId={highlightId}
            onFocus={(f) => openFlight(seedFromSample(f))}
          />
        );
      case 'satellites':
        return (
          <SatellitesList
            feed={sats.feed.data}
            isLoading={sats.feed.isLoading}
            error={sats.feed.error}
            onRetry={sats.feed.retry}
            states={sats.states}
            group={satGroup}
            onGroupChange={(g) => {
              setSatGroup(g);
              if (highlightId?.startsWith('s:')) setHighlightId(null);
            }}
            activeId={highlightId}
            onFocus={(s) => focusOn(`s:${s.norad}`, 'satellites', s.lat, s.lon)}
          />
        );
      case 'alerts':
        return (
          <AlertsList
            feed={disasters.data}
            isLoading={disasters.isLoading}
            error={disasters.error}
            onRetry={disasters.retry}
            activeId={highlightId}
            locationName={location.name}
            localAlerts={alerts}
            strikes={strikes}
            onFocusDisaster={(d) => focusOn(`d:${d.id}`, 'alerts', d.lat, d.lon)}
            onFocusLocal={(id) => focusOn(`w:${id}`, 'alerts', location.latitude, location.longitude)}
            onFocusStrike={(s) => focusOn(`l:${s.id}`, 'alerts', s.latitude, s.longitude)}
          />
        );
    }
  };

  const renderWindow = (def: WindowDef) => (
    <WindowPanel
      key={def.id}
      def={def}
      onClose={() => setOpen((prev) => ({ ...prev, [def.id]: false }))}
      className={
        isMobile
          ? 'max-h-[40dvh] animate-tab-enter'
          : `max-h-[min(48vh,380px)] ${def.side === 'left' ? 'animate-drawer-left' : 'animate-drawer-right'}`
      }
    >
      {renderWindowBody(def.id)}
    </WindowPanel>
  );

  const legend = <Legend open={open} layers={layers} counts={counts} onToggleWindow={toggleWindow} onToggleLayer={toggleLayer} />;

  const flightCard = (
    <FlightCard
      flight={tracker.flight}
      position={tracker.position}
      status={tracker.status}
      error={tracker.error}
      info={tracker.info}
      infoLoading={tracker.infoLoading}
      following={following}
      onFollow={() => setFollowing(true)}
      onStopFollow={stopFollowing}
      onClose={closeCard}
    />
  );
  const showCard = cardOpen && !!selectedFlight;

  // Full-bleed globe; every control floats above it.
  // Phones: ends above the window tab row so the globe's zoom buttons stay reachable.
  const globe = (
    <div className={`hub-globe-stage absolute inset-x-0 top-0 ${isMobile ? 'bottom-14' : 'bottom-0'}`}>
      <WorldEventGlobe
        isDark /* the stage is always dark (deep space) in both app themes */
        markers={markers}
        orbitals={orbitals}
        paths={paths}
        focus={focus}
        follow={following && tracker.position ? tracker.position : null}
        followKey={following && selectedFlight ? selectedFlight.icao24 : null}
        highlightId={highlightId}
        onMarkerSelect={onMarkerSelect}
        onViewChange={onGlobeView}
        onEmptyClick={() => {
          if (cardOpen) closeCard();
          if (isMobile) setOpen(CLOSED);
        }}
      />
    </div>
  );

  const followBadge = following && selectedFlight && (
    <div className="wh-glass-window !rounded-full flex items-center gap-2 pl-3 pr-1 py-1 text-xs max-w-full pointer-events-auto">
      <Crosshair className="w-3.5 h-3.5 shrink-0" style={{ color: TRACKED_FLIGHT_COLOR }} />
      <span className="truncate">
        Stai seguendo <strong>{tracker.flight?.callsign ?? selectedFlight.icao24.toUpperCase()}</strong>
        {tracker.status === 'lost' && <span className="text-[var(--hub-red)]"> · segnale perso</span>}
      </span>
      {!cardOpen && (
        <button type="button" className="hub-icon-btn !h-7 !px-2 text-xs" onClick={() => setCardOpen(true)}>
          <Plane className="w-3 h-3" /> Dettagli
        </button>
      )}
      <button type="button" className="hub-icon-btn !h-7 !px-2 text-xs" onClick={stopFollowing} aria-label="Smetti di seguire">
        <Square className="w-3 h-3" /> Stop
      </button>
    </div>
  );

  if (isMobile) {
    // Phones: globe fills the screen; the legend
    // sits above the bottom nav and opens a single compact translucent bottom sheet.
    const openDef = WINDOWS.find((w) => open[w.id]);
    return (
      <section
        ref={sectionRef}
        className="worldhub-stage on-dark relative z-10 w-full overflow-hidden bg-black"
        style={{ height: stageHeight ?? '70vh' }}
        aria-label="Mappamondo eventi in tempo reale"
      >
        {globe}
        <div className="absolute inset-x-2 bottom-2 z-30 max-h-[calc(100%-1rem)] flex flex-col gap-2 pointer-events-none">
          {followBadge && <div className="self-center max-w-full">{followBadge}</div>}
          {showCard ? (
            <div className="pointer-events-auto max-h-[42dvh] flex flex-col min-h-0 animate-tab-enter">{flightCard}</div>
          ) : (
            openDef && <div className="pointer-events-auto flex flex-col min-h-0">{renderWindow(openDef)}</div>
          )}
          <div className="pointer-events-auto flex">{legend}</div>
        </div>
      </section>
    );
  }

  // Tablet / desktop: the legend sits bottom centre; compact translucent windows
  // slide in from their side as a slim drawer column over the globe.
  const drawer = (side: Side) => {
    const defs = WINDOWS.filter((w) => w.side === side);
    const openDefs = defs.filter((w) => open[w.id]);
    const card = side === 'left' && showCard && <div className="flex flex-col min-h-0 max-h-[min(48vh,380px)] shrink-0 animate-drawer-left">{flightCard}</div>;
    return (
      <div
        // Ends above the legend row; the right one leaves the globe's zoom buttons uncovered.
        className={`absolute top-3 bottom-[4.25rem] z-30 flex items-start pointer-events-none ${side === 'left' ? 'left-3' : 'right-14'}`}
      >
        {(card || openDefs.length > 0) && (
          <div className="pointer-events-auto hub-scroll max-h-full overflow-y-auto overscroll-contain flex flex-col gap-2.5 w-[min(295px,24vw)] min-w-[235px] pb-1">
            {card}
            {openDefs.map(renderWindow)}
          </div>
        )}
      </div>
    );
  };

  return (
    <section
      ref={sectionRef}
      className="worldhub-stage on-dark relative z-10 w-full overflow-hidden bg-black"
      style={{ height: stageHeight ?? '80vh' }}
      aria-label="Mappamondo eventi in tempo reale"
    >
      {globe}
      {/* Follow badge: top centre, between the drawers. Flight search lives in the Voli window. */}
      {followBadge && <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 max-w-[min(560px,calc(100%-8rem))]">{followBadge}</div>}
      {/* Clear of the globe's zoom buttons (bottom right). */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 max-w-[calc(100%-7rem)] flex">{legend}</div>
      {drawer('left')}
      {drawer('right')}
    </section>
  );
};

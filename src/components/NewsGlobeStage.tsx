import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Activity, Bitcoin, CandlestickChart, Crosshair, Eye, EyeOff, Newspaper, Plane, Satellite, ShieldAlert, Square, X, LucideIcon } from 'lucide-react';
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
import { AlertsList, FlightsList, QuakesList, SatellitesList } from './WorldEventPanels';

type Side = 'left' | 'right';
type WindowId = 'news' | 'flights' | 'satellites' | 'markets' | 'quakes' | 'alerts' | 'crypto';

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

/** Altitude-band filter for the flight layer (ported from the former Global Hub). */
const FlightFilterBar: React.FC<{ bands: AltBand[]; onToggle: (b: AltBand) => void; query: string; onQuery: (q: string) => void }> = ({
  bands,
  onToggle,
  query,
  onQuery,
}) => (
  <div className="space-y-2">
    <div className="hub-label">Quota (filtro sul globo)</div>
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtra per quota">
      {ALT_BANDS.map((b) => (
        <button
          key={b.id}
          type="button"
          className="hub-chip !h-8"
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
    <input
      type="search"
      value={query}
      onChange={(e) => onQuery(e.target.value)}
      placeholder="Filtra i voli mostrati (nominativo o Paese)…"
      aria-label="Filtra i voli mostrati"
      className="w-full h-9 px-3 rounded-lg border border-[var(--hub-line)] bg-[var(--hub-panel)] text-sm focus:outline-none focus:border-[var(--hub-line-strong)] placeholder:text-[var(--hub-dim)]"
    />
  </div>
);

const LOCAL_LEVEL_COLOR: Record<WeatherAlertInfo['level'], string> = {
  green: '#4ade80',
  yellow: '#facc15',
  orange: '#fb923c',
  red: '#ef4444',
};

const REFRESH = { quakes: 90_000, flights: 60_000, disasters: 5 * 60_000 };
const ISS_COLOR = '#facc15';
const TRACK_REFRESH_MS = 60_000;
const TRACKED_FLIGHT_COLOR = '#22d3ee';

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
// Globe column sizing (see useGlobeHeight).
const STICKY_GAP_PX = 8; // space under the sticky app header
const BOTTOM_GAP_PX = 16;
const MIN_GLOBE_COLUMN = { desktop: 440, mobile: 380 };

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
 * Height of the globe column (toolbar + globe box), measured from the real
 * layout: the space between the stage's top edge and the bottom of the
 * viewport, so the whole sphere and its controls are visible on load
 * without scrolling. Capped to what fits under the navbar once the column
 * is sticky, and on phones to roughly a square globe.
 */
function useGlobeHeight(sectionRef: React.RefObject<HTMLElement | null>, isMobile: boolean): { height: number | null; stickyTop: number } {
  const [height, setHeight] = useState<number | null>(null);
  const [stickyTop, setStickyTop] = useState(120);
  useLayoutEffect(() => {
    const measure = () => {
      const el = sectionRef.current;
      if (!el) return;
      const vh = window.innerHeight;
      // Sticky app header (navbar + top nav) and, on phones, the fixed bottom nav.
      const header = document.querySelector('header')?.getBoundingClientRect().height ?? 64;
      const bottomNav = [...document.querySelectorAll<HTMLElement>('nav[aria-label="Sezioni principali"]')]
        .filter((n) => getComputedStyle(n).position === 'fixed' && n.offsetHeight > 0)
        .reduce((h, n) => Math.max(h, n.offsetHeight), 0);
      const top = el.getBoundingClientRect().top + window.scrollY;
      const bottomGap = BOTTOM_GAP_PX + bottomNav;
      const available = vh - top - bottomGap;
      const max = isMobile
        ? Math.min(vh - header - bottomGap, Math.round(window.innerWidth * 1.05) + 110) // ≈ square globe + 2 toolbar rows
        : vh - header - STICKY_GAP_PX - bottomGap;
      const min = isMobile ? MIN_GLOBE_COLUMN.mobile : MIN_GLOBE_COLUMN.desktop;
      setStickyTop(Math.round(header + STICKY_GAP_PX));
      setHeight(Math.round(Math.max(min, Math.min(max, available))));
    };
    measure();
    // The header above can change height (weather loaded, error banner, wrap).
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [sectionRef, isMobile]);
  return { height, stickyTop };
}

interface NewsGlobeStageProps {
  isDark: boolean;
  location: LocationInfo;
  alerts: WeatherAlertInfo[];
  strikes: LightningStrike[];
}

interface WindowPanelProps {
  def: WindowDef;
  layerOn?: boolean;
  onToggleLayer?: () => void;
  onClose: () => void;
  children: React.ReactNode;
}

/** One side window: header (layer toggle + close) and a scrollable body. */
const WindowPanel: React.FC<WindowPanelProps> = ({ def, layerOn, onToggleLayer, onClose, children }) => {
  const { id, title, icon: Icon, layer } = def;
  return (
    <section
      id={`worldhub-window-${id}`}
      aria-label={title}
      className="hub-panel hub-panel--glow flex flex-col animate-tab-enter max-h-[75dvh] md:max-h-[min(72vh,680px)]"
    >
      <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--hub-line)] shrink-0">
        <h2 className="font-display text-base font-bold flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 shrink-0" style={{ color: layer ? LAYER_META[layer].color : 'var(--hub-cyan)' }} />
          <span className="truncate">{title}</span>
        </h2>
        <div className="flex items-center gap-1.5 shrink-0">
          {layer && onToggleLayer && (
            <button
              type="button"
              onClick={onToggleLayer}
              aria-pressed={layerOn}
              className="hub-icon-btn !h-8 !px-2.5 text-xs"
              title={layerOn ? 'Nascondi dal mappamondo' : 'Mostra sul mappamondo'}
            >
              {layerOn ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {layerOn ? 'Sul globo' : 'Nascosto'}
            </button>
          )}
          <button type="button" onClick={onClose} className="hub-icon-btn !h-8 !px-2" aria-label={`Chiudi ${title}`} title="Chiudi">
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4">{children}</div>
    </section>
  );
};

/** Toggle tab for one window: vertical on the desktop rails, compact chip on phones. */
const WindowTab: React.FC<{ def: WindowDef; open: boolean; badge?: number; vertical: boolean; onToggle: () => void }> = ({
  def,
  open,
  badge,
  vertical,
  onToggle,
}) => {
  const Icon = def.icon;
  const badgeText = badge !== undefined && badge > 0 ? (badge > 999 ? '999+' : String(badge)) : null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-controls={`worldhub-window-${def.id}`}
      aria-expanded={open}
      title={open ? `Chiudi ${def.title}` : `Apri ${def.title}`}
      className={`hub-panel relative flex items-center transition-colors hover:border-[var(--hub-line-strong)] ${
        vertical ? 'flex-col gap-2 w-11 py-3 !rounded-xl' : 'gap-1.5 h-10 px-3 !rounded-xl text-xs font-semibold'
      } ${open ? '!border-[var(--hub-line-strong)] text-[var(--hub-cyan)] bg-[var(--hub-glow)]' : 'text-[var(--hub-dim)]'}`}
    >
      <Icon className="w-4 h-4 shrink-0" style={def.layer ? { color: LAYER_META[def.layer].color } : undefined} />
      {vertical ? (
        <span className="font-hud text-xs font-bold tracking-[0.2em] uppercase [writing-mode:vertical-rl] rotate-180">{def.title}</span>
      ) : (
        <span className={open ? 'text-[var(--hub-text)]' : ''}>{def.title}</span>
      )}
      {badgeText && (
        <span
          className={`font-hud text-xs font-bold px-1 rounded bg-[var(--hub-red)] text-white leading-4 ${
            vertical ? 'absolute -top-1.5 -right-1.5' : ''
          }`}
        >
          {badgeText}
        </span>
      )}
    </button>
  );
};

/**
 * WorldHub home: a centred real-time globe (earthquakes, flights, alerts,
 * satellites) with the news feed and every event category in toggleable side
 * windows. Each event window also shows/hides its layer on the globe.
 */
export const NewsGlobeStage: React.FC<NewsGlobeStageProps> = ({ isDark, location, alerts, strikes }) => {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [open, setOpen] = useState<Record<WindowId, boolean>>(() =>
    typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
      ? { news: true, flights: false, satellites: false, markets: false, quakes: false, alerts: false, crypto: false }
      : { news: true, flights: false, satellites: true, markets: false, quakes: true, alerts: false, crypto: false }
  );
  const [layers, setLayers] = useState<Record<WorldLayer, boolean>>({ news: true, quakes: true, flights: true, alerts: true, satellites: true });
  const [newsTab, setNewsTab] = useState<'italia' | 'mondo'>('italia');
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [altBands, setAltBands] = useState<AltBand[]>([]);
  const [flightQuery, setFlightQuery] = useState('');
  const [satGroup, setSatGroup] = useState<SatelliteGroup>('stations');
  const [focus, setFocus] = useState<GlobeFocus | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const globeRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const { height: globeHeight, stickyTop } = useGlobeHeight(sectionRef, isMobile);

  // Selected aircraft (popup) and follow mode.
  const [selectedFlight, setSelectedFlight] = useState<{ icao24: string; seed: FlightDetail | null } | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [following, setFollowing] = useState(false);
  const tracker = useFlightTracker(selectedFlight?.icao24 ?? null, selectedFlight?.seed ?? null);
  const trackedId = selectedFlight ? `f:${selectedFlight.icao24}` : null;

  // Only poll a source while its layer is shown or its window is open.
  const quakes = usePolledJson<FeedResponse<Earthquake>>(WORLD_ENDPOINTS.earthquakes, REFRESH.quakes, layers.quakes || open.quakes);
  const flights = usePolledJson<FlightsResponse>(WORLD_ENDPOINTS.flights, REFRESH.flights, layers.flights || open.flights);
  const disasters = usePolledJson<FeedResponse<Disaster>>(WORLD_ENDPOINTS.disasters, REFRESH.disasters, layers.alerts || open.alerts);
  const sats = useSatellites(satGroup, layers.satellites || open.satellites);
  const geo = usePolledResource(fetchGeoNews, GEO_NEWS_REFRESH_MS);
  const areas = geo.data?.areas ?? [];
  const selectedArea = selectedAreaId ? areas.find((a) => a.id === selectedAreaId) ?? null : null;

  const toggleWindow = (id: WindowId) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
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
      const q = flightQuery.trim().toUpperCase();
      for (const f of flights.data?.items ?? []) {
        if (trackedId === `f:${f.id}`) continue; // drawn live below
        const altFt = (f.altitudeM ?? 0) / 0.3048;
        if (altBands.length && !altBands.includes(altBandOf(altFt))) continue;
        if (q && !f.callsign.toUpperCase().includes(q) && !f.country.toUpperCase().includes(q)) continue;
        out.push({
          id: `f:${f.id}`,
          layer: 'flights',
          lat: f.lat,
          lon: f.lon,
          color: flightColor(altFt),
          size: 3.5,
          title: `Volo ${f.callsign}`,
          detail: [f.country, f.altitudeM != null ? `${f.altitudeM.toLocaleString('it-IT')} m` : null, f.speedKmh != null ? `${f.speedKmh} km/h` : null]
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
  }, [layers, areas, flights.data, altBands, flightQuery, quakes.data, disasters.data, strikes, alerts, location, selectedFlight, tracker.position, tracker.flight, trackedId]);

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
      // Phones stack the windows below the globe: bring the globe back into view.
      if (isMobile) globeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      if (isMobile) globeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [isMobile]
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

  const sampleById = useMemo(() => new Map((flights.data?.items ?? []).map((f) => [f.id, f])), [flights.data]);

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
        setOpen((p) => ({ ...p, news: true }));
        setNewsTab('mondo');
        setSelectedAreaId(m.id.slice(2));
      }
      setHighlightId(m.id);
      setFocus({ lat: m.lat, lon: m.lon, seq: Date.now() });
    },
    [sampleById, openFlight, selectedFlight]
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
    flights: flights.data?.totalAirborne ?? 0,
    alerts: (disasters.data?.items.length ?? 0) + alerts.length + strikes.length,
    satellites: sats.states.length,
  };
  const badgeFor = (def: WindowDef) => (def.layer ? counts[def.layer] : undefined);

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
      case 'flights':
        return (
          <FlightsList
            feed={flights.data}
            isLoading={flights.isLoading}
            error={flights.error}
            onRetry={flights.retry}
            search={
              <div className="space-y-3">
                <FlightSearch onSelect={openFlight} />
                <FlightFilterBar
                  bands={altBands}
                  onToggle={(b) => setAltBands((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]))}
                  query={flightQuery}
                  onQuery={setFlightQuery}
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
      layerOn={def.layer ? layers[def.layer] : undefined}
      onToggleLayer={def.layer ? () => toggleLayer(def.layer!) : undefined}
      onClose={() => setOpen((prev) => ({ ...prev, [def.id]: false }))}
    >
      {renderWindowBody(def.id)}
    </WindowPanel>
  );

  const layerChips = (
    <div role="group" aria-label="Livelli del mappamondo" className="hub-panel !rounded-full flex flex-wrap justify-center gap-1 p-1">
      {(Object.keys(LAYER_META) as WorldLayer[]).map((layer) => (
        <button
          key={layer}
          type="button"
          aria-pressed={layers[layer]}
          onClick={() => toggleLayer(layer)}
          className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold transition-opacity ${
            layers[layer] ? 'bg-[var(--hub-glow)]' : 'opacity-50'
          }`}
          title={layers[layer] ? `Nascondi ${LAYER_META[layer].label}` : `Mostra ${LAYER_META[layer].label}`}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: LAYER_META[layer].color }} />
          {LAYER_META[layer].label}
        </button>
      ))}
    </div>
  );

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

  const globe = (
    <div ref={globeRef} className="flex flex-col gap-2 scroll-mt-20" style={globeHeight ? { height: globeHeight } : undefined}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {layerChips}
        <div className="w-full sm:w-64">
          <FlightSearch compact onSelect={openFlight} />
        </div>
      </div>
      {/* Fills the rest of the measured column; never clipped by the viewport. */}
      <div className={`hub-globe-stage relative rounded-2xl overflow-hidden min-h-[260px] ${globeHeight ? 'flex-1' : 'h-[60vh]'}`}>
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
          onEmptyClick={() => {
            if (cardOpen) closeCard();
          }}
        />

        {/* Desktop: popup floats over the globe (left edge, above the follow badge) */}
        {cardOpen && selectedFlight && !isMobile && (
          <div className="absolute left-2 top-2 bottom-12 z-20 w-[min(300px,calc(100%-1rem))] flex flex-col pointer-events-none">
            <div className="pointer-events-auto max-h-full min-h-0 flex flex-col">{flightCard}</div>
          </div>
        )}

        {following && selectedFlight && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-2 z-20 hub-panel !rounded-full bg-[var(--hub-panel-strong)] flex items-center gap-2 pl-3 pr-1 py-1 text-xs max-w-[calc(100%-4.5rem)]">
            <Crosshair className="w-3.5 h-3.5 text-[var(--hub-cyan)] shrink-0" />
            <span className="truncate">
              Stai seguendo <strong className="font-hud">{tracker.flight?.callsign ?? selectedFlight.icao24.toUpperCase()}</strong>
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
        )}
      </div>
    </div>
  );

  if (isMobile) {
    // Phones: globe on top, then the window toggles, then every open window
    // stacked full-width below — several can be open, the page scrolls.
    return (
      <section ref={sectionRef} className="relative z-10 w-full px-3 pb-4 space-y-3" aria-label="Mappamondo eventi in tempo reale">
        {globe}
        {/* Phones: the popup sits right below the globe so the aircraft stays visible */}
        {cardOpen && selectedFlight && <div className="max-h-[70dvh] flex flex-col min-h-0">{flightCard}</div>}
        <nav aria-label="Finestre WorldHub" className="flex flex-wrap gap-2 justify-center">
          {WINDOWS.map((def) => (
            <WindowTab key={def.id} def={def} open={open[def.id]} badge={badgeFor(def)} vertical={false} onToggle={() => toggleWindow(def.id)} />
          ))}
        </nav>
        <div className="space-y-3">{WINDOWS.filter((w) => open[w.id]).map(renderWindow)}</div>
      </section>
    );
  }

  const column = (side: Side) => {
    const defs = WINDOWS.filter((w) => w.side === side);
    const openDefs = defs.filter((w) => open[w.id]);
    const rail = (
      <nav aria-label={side === 'left' ? 'Finestre a sinistra' : 'Finestre a destra'} className="flex flex-col gap-2 shrink-0">
        {defs.map((def) => (
          <WindowTab key={def.id} def={def} open={open[def.id]} badge={badgeFor(def)} vertical onToggle={() => toggleWindow(def.id)} />
        ))}
      </nav>
    );
    const stack = openDefs.length > 0 && (
      <div className="flex flex-col gap-3 w-[min(360px,28vw)] min-w-[260px]">{openDefs.map(renderWindow)}</div>
    );
    return (
      <div className={`flex gap-2 items-start ${side === 'right' ? 'flex-row-reverse' : ''}`}>
        {rail}
        {stack}
      </div>
    );
  };

  // Tablet / desktop: [left rail + windows] [sticky centred globe] [windows + right rail]
  return (
    <section
      ref={sectionRef}
      className="relative z-10 w-full px-3 pb-8 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-start"
      aria-label="Mappamondo eventi in tempo reale"
    >
      {column('left')}
      <div className="sticky self-start min-w-0" style={{ top: stickyTop }}>{globe}</div>
      {column('right')}
    </section>
  );
};

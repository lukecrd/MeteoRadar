import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Cloud,
  CloudLightning,
  CloudRain,
  Eye,
  Compass,
  Droplets,
  Gauge,
  Globe2,
  Layers,
  Maximize2,
  Minimize2,
  Moon,
  Newspaper,
  Plane,
  Play,
  Radio,
  RefreshCw,
  Satellite,
  ShieldAlert,
  Sun,
  Wind,
  X,
} from 'lucide-react';
import { HumiditySensorReading, WeatherData } from '../types';
import { getBeaufortScale, getWeatherDescription, getWindDirectionLabel, summarizeRain } from '../services/weatherApi';
import { computeLunarEphemeris, computeSolarEphemeris } from '../services/astronomy';
import { MoonDiskSvg } from './AstronomicalEphemerisCard';
import { usePolledJson } from '../hooks/usePolledJson';
import { useNewsFeed } from '../hooks/useNewsFeed';
import { NEWS_CATEGORY_META, NewsFilter, timeAgo } from '../services/newsApi';
import { distanceKm } from '../alerts/personalAlerts';
import { bearingDeg, compassIt, satellitePasses } from '../services/overhead';
import { classifyFlight } from '../services/flightClassifier';
import {
  Earthquake,
  FeedResponse,
  FlightsResponse,
  ISS_NORAD,
  quakeColor,
  SatellitesResponse,
  WORLD_ENDPOINTS,
} from '../services/worldEventsApi';

interface KioskStationModalProps {
  isOpen: boolean;
  onClose: () => void;
  weather: WeatherData;
  currentHumidity: number;
  humidityReadings: HumiditySensorReading[];
  onRefresh: () => void;
  isLoading: boolean;
}

type KioskMainTab = 'meteo' | 'eventi' | 'sintesi';
const KIOSK_TABS: KioskMainTab[] = ['meteo', 'eventi', 'sintesi'];
type KioskAltFilter = 'all' | 'low' | 'mid' | 'high';

const NEWS_FILTERS: NewsFilter[] = ['all', 'meteo', 'italia', 'mondo', 'scienza', 'tech', 'ambiente'];

export const KioskStationModal: React.FC<KioskStationModalProps> = ({
  isOpen,
  onClose,
  weather,
  currentHumidity,
  humidityReadings,
  onRefresh,
  isLoading,
}) => {
  const [now, setNow] = useState(() => new Date());
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [kioskTab, setKioskTab] = useState<KioskMainTab>('meteo');
  const [autoCycle, setAutoCycle] = useState(false);
  const [focusedPanel, setFocusedPanel] = useState<number>(0);
  const [idle, setIdle] = useState(false);

  // Filters inside the "Notizie, Terremoti & Voli 3D" tab
  const [newsCategory, setNewsCategory] = useState<NewsFilter>('all');
  const [radarRadiusKm, setRadarRadiusKm] = useState<75 | 150>(75);
  const [flightAltFilter, setFlightAltFilter] = useState<KioskAltFilter>('all');
  const [minQuakeMag, setMinQuakeMag] = useState<number>(0);

  const radarRadiusNm = radarRadiusKm === 75 ? 42 : 82;

  // Live 1-second station clock
  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [isOpen]);

  // Auto-cycle across panels and switch between the two Kiosk tabs when Ciclo 3D is active
  useEffect(() => {
    if (!isOpen || !autoCycle) return;
    const id = setInterval(() => {
      setFocusedPanel((prev) => {
        const next = (prev + 1) % 6;
        if (next === 0) {
          setKioskTab((t) => KIOSK_TABS[(KIOSK_TABS.indexOf(t) + 1) % KIOSK_TABS.length]);
        }
        return next;
      });
    }, 7_000);
    return () => clearInterval(id);
  }, [isOpen, autoCycle]);

  // Keep the display awake while the kiosk is open: a wall screen must not sleep.
  useEffect(() => {
    if (!isOpen || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let closed = false;
    // The browser drops the lock when the tab is hidden, so take it again on return.
    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (closed) l.release().catch(() => {});
          else lock = l;
        })
        .catch(() => {});
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      closed = true;
      document.removeEventListener('visibilitychange', acquire);
      lock?.release().catch(() => {});
    };
  }, [isOpen]);

  // After 8 s without input, hide the cursor and dim the controls.
  useEffect(() => {
    if (!isOpen) return;
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), 8_000);
    };
    wake();
    window.addEventListener('pointermove', wake, { passive: true });
    window.addEventListener('pointerdown', wake, { passive: true });
    window.addEventListener('keydown', wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
  }, [isOpen]);

  // Sync native Fullscreen API state and keyboard shortcuts (Escape, 1, 2, 3, C, F)
  useEffect(() => {
    if (!isOpen) return;

    const onFullscreenChange = () => {
      setIsNativeFullscreen(!!document.fullscreenElement);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '1') {
        setKioskTab('meteo');
      } else if (e.key === '2') {
        setKioskTab('eventi');
      } else if (e.key === '3') {
        setKioskTab('sintesi');
      } else if (e.key === 'c' || e.key === 'C') {
        setAutoCycle((prev) => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleBrowserFullscreen();
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('keydown', onKeyDown);

    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('keydown', onKeyDown);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [isOpen, onClose]);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const { location, current, hourly, daily, airQuality, alerts } = weather;
  const lat = location.latitude;
  const lon = location.longitude;

  // Poll live nearby flights, ISS TLEs, earthquakes, and news
  const flightsFeed = usePolledJson<FlightsResponse>(
    WORLD_ENDPOINTS.flightsArea(lat.toFixed(2), lon.toFixed(2), radarRadiusNm),
    30_000,
    isOpen
  );
  const stationsFeed = usePolledJson<SatellitesResponse>(
    WORLD_ENDPOINTS.satellites('stations'),
    2 * 60 * 60_000,
    isOpen
  );
  const quakesFeed = usePolledJson<FeedResponse<Earthquake>>(
    WORLD_ENDPOINTS.earthquakes,
    120_000,
    isOpen
  );
  const newsFeed = useNewsFeed(newsCategory, 120_000);

  const solar = useMemo(() => computeSolarEphemeris(location, daily, now), [location, daily, now]);
  const lunar = useMemo(() => computeLunarEphemeris(now), [now]);
  const beaufort = getBeaufortScale(current.windSpeed);
  const windLabel = getWindDirectionLabel(current.windDirection);

  // Deduplicated news items
  const uniqueNews = useMemo(() => {
    const seen = new Set<string>();
    return newsFeed.items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [newsFeed.items]);

  // Nearby flights enriched with distance, bearing, and classification
  const allNearbyFlights = useMemo(() => {
    const rawItems = Array.isArray(flightsFeed.data?.items) ? flightsFeed.data!.items : [];
    return rawItems
      .map((f) => {
        const km = distanceKm(lat, lon, f.lat, f.lon);
        const bearing = bearingDeg(lat, lon, f.lat, f.lon);
        const dir = compassIt(bearing);
        const meta = classifyFlight(f);
        return { ...f, km, bearing, dir, meta };
      })
      .filter((f) => f.km <= radarRadiusKm)
      .sort((a, b) => a.km - b.km);
  }, [flightsFeed.data, lat, lon, radarRadiusKm]);

  const filteredFlights = useMemo(() => {
    if (flightAltFilter === 'all') return allNearbyFlights;
    return allNearbyFlights.filter((f) => {
      const alt = f.altitudeM ?? 0;
      if (flightAltFilter === 'low') return alt < 3000;
      if (flightAltFilter === 'mid') return alt >= 3000 && alt <= 8500;
      return alt > 8500;
    });
  }, [allNearbyFlights, flightAltFilter]);

  // Upcoming ISS passes
  const issPasses = useMemo(() => {
    const rawStations = Array.isArray(stationsFeed.data?.items) ? stationsFeed.data!.items : [];
    const iss = rawStations.find((t) => t.norad === ISS_NORAD);
    if (!iss) return [];
    const nowMs = now.getTime();
    return satellitePasses(iss.line1, iss.line2, lat, lon, nowMs, 36)
      .filter((p) => p.endMs > nowMs)
      .slice(0, 3);
  }, [stationsFeed.data, lat, lon, now]);

  // Recent earthquakes filtered by minimum magnitude
  const filteredQuakes = useMemo(() => {
    const items = Array.isArray(quakesFeed.data?.items) ? quakesFeed.data!.items : [];
    return items
      .filter((q) => q && typeof q.mag === 'number' && q.mag >= minQuakeMag)
      .map((q) => ({
        ...q,
        distKm: Math.round(distanceKm(lat, lon, q.lat, q.lon)),
      }))
      .sort((a, b) => b.time - a.time);
  }, [quakesFeed.data, lat, lon, minQuakeMag]);

  const localTimeStr = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('it-IT', {
        timeZone: location.timezone && location.timezone !== 'auto' ? location.timezone : undefined,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(now);
    } catch {
      return now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }, [now, location.timezone]);

  const dateStr = useMemo(() => {
    return now.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [now]);

  const utcStr = now.toISOString().slice(11, 19);

  if (!isOpen) return null;

  // Build SVG sparkline & 3D area fill for live humidity readings
  const { sparkLine, sparkArea } = (() => {
    if (humidityReadings.length < 2) return { sparkLine: '', sparkArea: '' };
    const slice = humidityReadings.slice(-18);
    const minH = Math.min(...slice.map((r) => r.humidity)) - 2;
    const maxH = Math.max(...slice.map((r) => r.humidity)) + 2;
    const span = Math.max(4, maxH - minH);
    const pts = slice.map((r, i) => {
      const x = (i / (slice.length - 1)) * 220;
      const y = 42 - ((r.humidity - minH) / span) * 34;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const line = pts.join(' ');
    const area = `0,46 ${line} 220,46`;
    return { sparkLine: line, sparkArea: area };
  })();

  // 12-Hour 3D Temperature & Rain curve geometry
  const next12 = hourly.slice(0, 12);
  const chart12 = (() => {
    if (next12.length < 2) return null;
    const temps = next12.map((h) => h.temperature);
    const minT = Math.min(...temps) - 1.5;
    const maxT = Math.max(...temps) + 1.5;
    const spanT = Math.max(4, maxT - minT);
    const w = 680;
    const h = 112;
    const padX = 28;
    const usableW = w - padX * 2;

    const nodes = next12.map((item, i) => {
      const x = padX + (i / (next12.length - 1)) * usableW;
      const y = 76 - ((item.temperature - minT) / spanT) * 48;
      return { x, y, item };
    });
    const polyPoints = nodes.map((n) => `${n.x.toFixed(1)},${n.y.toFixed(1)}`).join(' ');
    const areaPoints = `${nodes[0].x.toFixed(1)},90 ${polyPoints} ${nodes[nodes.length - 1].x.toFixed(1)},90`;
    return { nodes, polyPoints, areaPoints, w, h };
  })();

  const baroNorm = Math.max(0.08, Math.min(0.96, (current.pressure - 980) / 60));
  const capeVal = Math.round(hourly[0]?.cape ?? 120);
  const zeroTermicoM = Math.max(0, Math.round((current.temperature / 6.5) * 1000));
  const windKnots = Math.round(current.windSpeed * 0.539957);
  const windMs = (current.windSpeed / 3.6).toFixed(1);

  // 3D Celestial Sun position on Kiosk mini-dome
  const clampedSunProg = Math.max(0, Math.min(1, solar.sunProgress));
  const sunAngleRad = Math.PI * (1 - clampedSunProg);
  const sunGx = 115 - Math.cos(sunAngleRad) * 82;
  const sunGy = 68 + Math.sin(sunAngleRad) * 16;
  const sunArcH = solar.isDaylightNow ? Math.sin(Math.PI * clampedSunProg) * 46 : -8;
  const sunY = sunGy - sunArcH;

  const activeAlert = alerts?.find((a) => a.level !== 'green') ?? alerts?.[0];

  const card3DClass = (idx: number, accentBorder: string, accentGlow: string) =>
    `relative rounded-2xl border p-4 sm:p-5 flex flex-col justify-between overflow-hidden transition-all duration-300 backdrop-blur-xl ${
      autoCycle && focusedPanel === idx
        ? `kiosk-focus ${accentBorder} bg-slate-900/95 ${accentGlow} -translate-y-0.5`
        : 'border-slate-700/75 bg-gradient-to-br from-slate-900/92 via-slate-900/82 to-slate-950/92 shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset,0_18px_38px_-12px_rgba(0,0,0,0.78)] hover:border-slate-600/90'
    }`;

  // One of four pictograms for the Sintesi tab: enough to read the sky from far away.
  const sky = getWeatherDescription(current.weatherCode);
  const GlanceIcon = sky.isStorm
    ? CloudLightning
    : sky.isRain
      ? CloudRain
      : current.weatherCode > 1
        ? Cloud
        : current.isDay
          ? Sun
          : Moon;

  const leadStory = uniqueNews[0] ?? null;
  const streamStories = uniqueNews.slice(1, 14);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Stazione Meteo Fullscreen 3D · ${location.name}`}
      className={`on-dark fixed inset-0 z-50 bg-[#030712] text-slate-50 flex flex-col justify-between overflow-y-auto xl:overflow-hidden select-none p-3 sm:p-5 gap-3.5 ${idle ? 'cursor-none' : ''}`}
      style={{
        backgroundImage:
          'radial-gradient(ellipse 75% 45% at 50% -5%, rgba(34, 211, 238, 0.16), transparent 70%), radial-gradient(ellipse 55% 40% at 90% 85%, rgba(168, 85, 247, 0.13), transparent 65%), radial-gradient(ellipse 50% 35% at 10% 80%, rgba(16, 185, 129, 0.11), transparent 65%), linear-gradient(to bottom, rgba(30, 41, 59, 0.28) 1px, transparent 1px), linear-gradient(to right, rgba(30, 41, 59, 0.28) 1px, transparent 1px)',
        backgroundSize: '100% 100%, 100% 100%, 100% 100%, 44px 44px, 44px 44px',
      }}
    >
      {/* TOP 3D HOLOGRAPHIC COMMAND HEADER WITH UNIFIED TAB SWITCHER */}
      <header className="relative rounded-2xl border border-cyan-500/35 bg-gradient-to-r from-slate-900/95 via-slate-900/90 to-slate-900/95 px-4 py-3 shadow-[0_1px_0_0_rgba(255,255,255,0.18)_inset,0_12px_30px_-10px_rgba(0,0,0,0.8)] flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Countdown to the next step of the automatic cycle */}
        {autoCycle && (
          <div aria-hidden className="absolute bottom-0 left-4 right-4 h-[2px] overflow-hidden rounded-full">
            <div key={focusedPanel} className="kiosk-cycle-bar h-full bg-cyan-400" />
          </div>
        )}

        {/* Station Title & Coordinates */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-400/40 shrink-0 shadow-[0_0_16px_rgba(34,211,238,0.25)]">
            <Radio className="w-5 h-5 text-cyan-400" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-base sm:text-xl font-bold tracking-tight text-white truncate">
                STAZIONE 3D · {location.name.toUpperCase()}
              </h1>
              <span className="text-xs font-hud text-cyan-300 tabular-nums">
                {lat.toFixed(2)}°N {lon.toFixed(2)}°E
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300 flex-wrap">
              <span className="capitalize">{dateStr}</span>
              {activeAlert && (
                <>
                  <span aria-hidden>·</span>
                  <span className="font-semibold text-amber-300 inline-flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> {activeAlert.title}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 3D HOLOGRAPHIC KIOSK TABS: TAB 1 (METEO) vs TAB 2 (NOTIZIE, TERREMOTI & VOLI 3D) */}
        <div
          role="tablist"
          aria-label="Sezioni Stazione Kiosk 3D"
          className="flex items-center gap-2 p-1 rounded-2xl bg-slate-950/90 border border-slate-700/80 shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={kioskTab === 'meteo'}
            onClick={() => setKioskTab('meteo')}
            className={`h-9 px-3.5 rounded-xl font-display text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-all ${
              kioskTab === 'meteo'
                ? 'bg-gradient-to-r from-cyan-500/30 via-sky-500/25 to-emerald-500/25 text-white border border-cyan-400/70 shadow-[0_0_20px_rgba(34,211,238,0.3)] -translate-y-[1px]'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
          >
            <Gauge className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>1 · Meteo, Aria &amp; Cielo 3D</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={kioskTab === 'eventi'}
            onClick={() => setKioskTab('eventi')}
            className={`h-9 px-3.5 rounded-xl font-display text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-all ${
              kioskTab === 'eventi'
                ? 'bg-gradient-to-r from-violet-500/35 via-cyan-500/25 to-rose-500/30 text-white border border-violet-400/80 shadow-[0_0_22px_rgba(167,139,250,0.35)] -translate-y-[1px]'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
          >
            <Globe2 className="w-4 h-4 text-violet-400 shrink-0" />
            <span>2 · Notizie, Terremoti &amp; Voli 3D</span>
            <span className="font-hud text-[11px] px-1.5 py-0.5 rounded-md bg-slate-900/90 border border-slate-700 text-cyan-300 tabular-nums">
              {uniqueNews.length}N · {allNearbyFlights.length}V · {filteredQuakes.length}T
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={kioskTab === 'sintesi'}
            onClick={() => setKioskTab('sintesi')}
            className={`h-9 px-3.5 rounded-xl font-display text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-all ${
              kioskTab === 'sintesi'
                ? 'bg-slate-800 text-white border border-slate-300/70 -translate-y-[1px]'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
          >
            <Eye className="w-4 h-4 text-slate-200 shrink-0" />
            <span>3 · Sintesi</span>
          </button>
        </div>

        {/* Clocks & Action Controls */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 font-hud tabular-nums">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-cyan-300/80">Ora Locale</div>
              <div className="text-xl sm:text-2xl font-bold text-cyan-400 leading-none mt-0.5 drop-shadow-[0_0_10px_rgba(34,211,238,0.35)]">
                {localTimeStr}
              </div>
            </div>
            <div className="h-7 w-px bg-slate-700/80" />
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-amber-300/80">UTC</div>
              <div className="text-xl sm:text-2xl font-bold text-amber-300 leading-none mt-0.5">
                {utcStr}
              </div>
            </div>
          </div>

          <div className={`flex items-center gap-1.5 shrink-0 transition-opacity duration-500 ${idle ? 'opacity-30' : ''}`}>
            <button
              type="button"
              onClick={() => setAutoCycle((prev) => !prev)}
              aria-pressed={autoCycle}
              className={`h-9 px-2.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-all ${
                autoCycle
                  ? 'border-cyan-400 bg-cyan-500/25 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.3)]'
                  : 'border-slate-700 bg-slate-800/90 text-slate-200 hover:border-cyan-400/60'
              }`}
              title="Rotazione automatica quadranti e tab ogni 7 secondi (tasto C)"
            >
              <Play className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Ciclo 3D</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onRefresh();
                newsFeed.refresh();
                flightsFeed.retry();
                quakesFeed.retry();
              }}
              disabled={isLoading}
              className="h-9 px-2.5 rounded-xl border border-slate-700 bg-slate-800/90 text-slate-200 hover:border-cyan-400/60 text-xs font-semibold inline-flex items-center gap-1.5"
              title="Sincronizza tutti i flussi"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading || newsFeed.isLoading ? 'animate-spin text-cyan-400' : 'text-emerald-400'}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>

            <button
              type="button"
              onClick={toggleBrowserFullscreen}
              className="h-9 px-2.5 rounded-xl border border-slate-700 bg-slate-800/90 text-slate-200 hover:border-cyan-400/60 text-xs font-semibold inline-flex items-center gap-1.5"
              title="Schermo intero nativo (tasto F)"
            >
              {isNativeFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-cyan-400" /> : <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3 rounded-xl border border-rose-500/60 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 text-xs font-bold inline-flex items-center gap-1.5 shadow-[0_0_14px_rgba(244,63,94,0.25)]"
              title="Esci dalla modalità Stazione Fullscreen (ESC)"
            >
              <X className="w-4 h-4" />
              <span>Esci</span>
            </button>
          </div>
        </div>
      </header>

      {/* =====================================================================
          TAB 1: METEO, ARIA & CIELO 3D
          ===================================================================== */}
      {kioskTab === 'meteo' && (
        <div key="kiosk-tab-meteo" className="kiosk-stage flex-1 min-h-0 flex flex-col justify-between gap-3.5">
          {/* TOP 4 3D VOLUMETRIC TELEMETRY QUADRANTS */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5 flex-1 min-h-0">
            {/* MODULE 1: 3D THERMOMETRY, BAROMETRIC CYLINDER & CONVECTIVE ENERGY */}
            <section
              className={card3DClass(
                0,
                'border-cyan-400',
                'shadow-[0_0_30px_rgba(34,211,238,0.22)]'
              )}
            >
              <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80" />
              <div>
                <div className="text-xs font-hud uppercase tracking-wider text-cyan-300 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Gauge className="w-4 h-4 text-cyan-400 shrink-0" /> Termometria &amp; Barometro 3D
                  </span>
                  <span className="text-slate-300 tabular-nums">
                    Min {daily[0]?.minTemp}° · Max {daily[0]?.maxTemp}°C
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-hud text-5xl 2xl:text-6xl font-bold tabular-nums tracking-tight text-white drop-shadow-[0_4px_16px_rgba(34,211,238,0.28)]">
                      {current.temperature.toFixed(1)}°
                    </div>
                    <div className="text-sm font-bold text-cyan-300 mt-1 truncate">{current.weatherDescription}</div>
                    <div className="text-xs text-slate-300 font-hud tabular-nums mt-0.5">
                      Percepita <strong className="text-white">{current.apparentTemperature.toFixed(1)}°C</strong> · Rugiada{' '}
                      <strong className="text-cyan-300">{current.dewPoint}°C</strong>
                    </div>
                  </div>

                  {/* 3D Isometric Barometric Pressure Cylinder */}
                  <div className="flex flex-col items-center shrink-0">
                    <svg viewBox="0 0 68 92" className="w-16 h-20 select-none" aria-hidden="true">
                      <defs>
                        <linearGradient id="kioskBaroFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" />
                          <stop offset="100%" stopColor="#0284c7" />
                        </linearGradient>
                      </defs>
                      <ellipse cx="34" cy="14" rx="18" ry="6" fill="rgba(15,23,42,0.9)" stroke="#38bdf8" strokeWidth="1.2" />
                      <path
                        d="M 16 14 L 16 74 A 18 6 0 0 0 52 74 L 52 14"
                        fill="rgba(15,23,42,0.65)"
                        stroke="rgba(56,189,248,0.45)"
                        strokeWidth="1.2"
                      />
                      {(() => {
                        const topY = 74 - baroNorm * 54;
                        return (
                          <>
                            <path
                              d={`M 16 ${topY} L 16 74 A 18 6 0 0 0 52 74 L 52 ${topY} Z`}
                              fill="url(#kioskBaroFill)"
                              opacity="0.78"
                            />
                            <ellipse cx="34" cy={topY} rx="18" ry="6" fill="#67e8f9" stroke="#ffffff" strokeWidth="0.8" />
                          </>
                        );
                      })()}
                      <ellipse
                        cx="34"
                        cy="44"
                        rx="18"
                        ry="6"
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                    </svg>
                    <span className="font-hud text-xs font-bold text-cyan-300 tabular-nums -mt-1">
                      {current.pressure} hPa
                    </span>
                  </div>
                </div>
              </div>

              <dl className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-800 text-xs mt-3">
                <div className="rounded-lg bg-slate-950/70 border border-slate-800/90 p-2">
                  <dt className="text-[10px] text-slate-400 truncate">Nuvole</dt>
                  <dd className="font-hud text-sm font-bold text-white tabular-nums mt-0.5">{current.cloudCover}%</dd>
                </div>
                <div className="rounded-lg bg-slate-950/70 border border-slate-800/90 p-2">
                  <dt className="text-[10px] text-slate-400 truncate">Pioggia</dt>
                  <dd className="font-hud text-sm font-bold text-sky-300 tabular-nums mt-0.5">{current.precipitation} mm</dd>
                </div>
                <div className="rounded-lg bg-slate-950/70 border border-slate-800/90 p-2">
                  <dt className="text-[10px] text-slate-400 truncate">Zero Term.</dt>
                  <dd className="font-hud text-sm font-bold text-amber-300 tabular-nums mt-0.5">{zeroTermicoM} m</dd>
                </div>
                <div className="rounded-lg bg-slate-950/70 border border-slate-800/90 p-2">
                  <dt className="text-[10px] text-slate-400 truncate">CAPE</dt>
                  <dd className="font-hud text-sm font-bold text-emerald-300 tabular-nums mt-0.5">{capeVal} J/kg</dd>
                </div>
              </dl>
            </section>

            {/* MODULE 2: 3D ISOMETRIC WIND ROSE & ANEMOMETER */}
            <section
              className={card3DClass(
                1,
                'border-emerald-400',
                'shadow-[0_0_30px_rgba(52,211,153,0.22)]'
              )}
            >
              <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-80" />
              <div className="text-xs font-hud uppercase tracking-wider text-emerald-300 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-bold">
                  <Wind className="w-4 h-4 text-emerald-400 shrink-0" /> Rosa Venti 3D &amp; Anemometro
                </span>
                <span className="text-amber-300 font-bold">Beaufort {beaufort.scale}</span>
              </div>

              <div className="flex items-center gap-4 my-2.5">
                <svg viewBox="0 0 120 106" className="w-28 h-24 shrink-0 select-none" aria-hidden="true">
                  <defs>
                    <radialGradient id="kioskWindGlow" cx="50%" cy="50%" r="55%">
                      <stop offset="0%" stopColor="rgba(16, 185, 129, 0.28)" />
                      <stop offset="100%" stopColor="rgba(2, 6, 23, 0)" />
                    </radialGradient>
                  </defs>
                  <ellipse cx="60" cy="60" rx="48" ry="34" fill="none" stroke="rgba(16, 185, 129, 0.2)" strokeWidth="3" />
                  <ellipse cx="60" cy="54" rx="48" ry="34" fill="url(#kioskWindGlow)" stroke="#34d399" strokeWidth="1.5" />
                  <ellipse cx="60" cy="54" rx="32" ry="22" fill="none" stroke="rgba(52, 211, 153, 0.35)" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="12" y1="54" x2="108" y2="54" stroke="rgba(52, 211, 153, 0.25)" strokeWidth="1" />
                  <line x1="60" y1="20" x2="60" y2="88" stroke="rgba(52, 211, 153, 0.25)" strokeWidth="1" />

                  <text x="60" y="16" textAnchor="middle" className="fill-cyan-300 text-[10px] font-hud font-bold">N</text>
                  <text x="113" y="57" textAnchor="middle" className="fill-slate-300 text-[9px] font-hud font-bold">E</text>
                  <text x="60" y="99" textAnchor="middle" className="fill-slate-300 text-[9px] font-hud font-bold">S</text>
                  <text x="7" y="57" textAnchor="middle" className="fill-slate-300 text-[9px] font-hud font-bold">O</text>

                  {(() => {
                    const rad = ((current.windDirection - 90) * Math.PI) / 180;
                    const tx = 60 + Math.cos(rad) * 38;
                    const ty = 54 + Math.sin(rad) * 26;
                    const bx = 60 - Math.cos(rad) * 22;
                    const by = 54 - Math.sin(rad) * 15;
                    return (
                      <g>
                        <line x1={bx} y1={by} x2={tx} y2={ty} stroke="#10b981" strokeWidth="3.2" strokeLinecap="round" />
                        <circle cx={tx} cy={ty} r="4.5" fill="#6ee7b7" stroke="#022c22" strokeWidth="1.5" />
                        <circle cx="60" cy="54" r="3.5" fill="#ffffff" />
                      </g>
                    );
                  })()}
                </svg>

                <div className="min-w-0 flex-1">
                  <div className="font-hud text-4xl 2xl:text-5xl font-bold tabular-nums text-white leading-none">
                    {current.windSpeed} <span className="text-sm font-normal text-emerald-300">km/h</span>
                  </div>
                  <div className="text-sm font-bold text-emerald-300 mt-1.5 truncate">
                    {windLabel} ({current.windDirection}°)
                  </div>
                  <div className="text-xs text-slate-300 font-hud tabular-nums mt-0.5">
                    {windKnots} kt · {windMs} m/s · {beaufort.description}
                  </div>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-800 text-xs">
                <div className="rounded-lg bg-slate-950/70 border border-slate-800/90 p-2">
                  <dt className="text-[10px] text-slate-400">Raffiche Massime</dt>
                  <dd className="font-hud text-base font-bold tabular-nums text-amber-300 mt-0.5">
                    {current.windGusts} km/h
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-950/70 border border-slate-800/90 p-2">
                  <dt className="text-[10px] text-slate-400">Visibilità Ottica</dt>
                  <dd className="font-hud text-base font-bold tabular-nums text-cyan-300 mt-0.5">
                    {current.visibility} km
                  </dd>
                </div>
              </dl>
            </section>

            {/* MODULE 3: 6-CHANNEL AIR QUALITY SPECTROMETER, HYGROMETRY & UV */}
            <section
              className={card3DClass(
                2,
                'border-violet-400',
                'shadow-[0_0_30px_rgba(167,139,250,0.22)]'
              )}
            >
              <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-80" />
              <div>
                <div className="text-xs font-hud uppercase tracking-wider text-violet-300 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Droplets className="w-4 h-4 text-sky-400 shrink-0" /> Igrometria &amp; Spettrometro Aria
                  </span>
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <Activity className="w-3.5 h-3.5" /> AQI {airQuality?.europeanAqi ?? 28}
                  </span>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-hud text-4xl font-bold tabular-nums text-sky-300 leading-none">
                      {currentHumidity.toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-300 mt-1">
                      Umidità Live · UV <strong className="text-amber-300">{current.uvIndex}</strong>/{daily[0]?.uvMax ?? 6}
                    </div>
                  </div>
                  {sparkLine && (
                    <svg viewBox="0 0 220 48" className="w-36 h-12 shrink-0 select-none" aria-hidden="true">
                      <defs>
                        <linearGradient id="kioskHumGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgba(56, 189, 248, 0.45)" />
                          <stop offset="100%" stopColor="rgba(56, 189, 248, 0.0)" />
                        </linearGradient>
                      </defs>
                      <polygon points={sparkArea} fill="url(#kioskHumGrad)" />
                      <polyline
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={sparkLine}
                      />
                    </svg>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-xs mt-2">
                {[
                  { label: 'PM2.5', val: airQuality?.pm2_5 ?? 7, max: 35, color: 'bg-emerald-400', text: 'text-emerald-300' },
                  { label: 'PM10', val: airQuality?.pm10 ?? 15, max: 50, color: 'bg-cyan-400', text: 'text-cyan-300' },
                  { label: 'O₃', val: airQuality?.ozone ?? 78, max: 140, color: 'bg-violet-400', text: 'text-violet-300' },
                  { label: 'NO₂', val: airQuality?.nitrogenDioxide ?? 12, max: 60, color: 'bg-amber-400', text: 'text-amber-300' },
                  { label: 'SO₂', val: airQuality?.sulphurDioxide ?? 2, max: 30, color: 'bg-sky-400', text: 'text-sky-300' },
                  { label: 'CO', val: Math.round((airQuality?.carbonMonoxide ?? 220) / 10), max: 100, color: 'bg-rose-400', text: 'text-rose-300' },
                ].map((p) => {
                  const pct = Math.min(100, Math.max(8, Math.round((p.val / p.max) * 100)));
                  return (
                    <div key={p.label} className="rounded-lg bg-slate-950/75 border border-slate-800/90 p-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400 font-semibold">{p.label}</span>
                        <span className={`font-hud font-bold tabular-nums ${p.text}`}>{p.val}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-800 mt-1 overflow-hidden">
                        <div className={`h-full rounded-full ${p.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* MODULE 4: 3D CELESTIAL SPHERE, SOLAR ARC & VOLUMETRIC MOON */}
            <section
              className={card3DClass(
                3,
                'border-amber-400',
                'shadow-[0_0_30px_rgba(251,191,36,0.22)]'
              )}
            >
              <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-80" />
              <div className="text-xs font-hud uppercase tracking-wider text-amber-300 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-bold">
                  <Moon className="w-4 h-4 text-amber-300 shrink-0" /> Sfera Celeste 3D &amp; Luna
                </span>
                <span className="text-slate-200 tabular-nums">
                  {solar.daylightHours}h {solar.daylightMinutes}m luce
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 my-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <MoonDiskSvg phaseValue={lunar.phaseValue} size={64} showOrbitRing />
                  <div className="min-w-0">
                    <div className="font-display text-base font-bold text-amber-200 truncate">{lunar.phaseName}</div>
                    <div className="font-hud text-xs font-semibold text-white tabular-nums">
                      Illum. <span className="text-amber-300">{lunar.illuminationPct.toFixed(1)}%</span> · {lunar.ageDays.toFixed(1)} gg
                    </div>
                    <div className="text-[11px] text-cyan-300 font-hud tabular-nums">
                      {lunar.distanceKm.toLocaleString('it-IT')} km
                    </div>
                  </div>
                </div>

                <svg viewBox="0 0 230 92" className="w-32 h-16 shrink-0 select-none" aria-hidden="true">
                  <ellipse cx="115" cy="68" rx="82" ry="16" fill="rgba(56,189,248,0.12)" stroke="rgba(56,189,248,0.45)" strokeWidth="1.2" />
                  <path d="M 33 68 Q 115 4 197 68" fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeDasharray="3 2" />
                  <line x1={sunGx} y1={sunGy} x2={sunGx} y2={sunY} stroke="#fbbf24" strokeWidth="1.2" strokeDasharray="2 2" />
                  <circle cx={sunGx} cy={sunY} r="9" fill="rgba(251,191,36,0.28)" />
                  <circle cx={sunGx} cy={sunY} r="4.5" fill={solar.isDaylightNow ? '#fde047' : '#64748b'} stroke="#0f172a" strokeWidth="1.2" />
                  <text x="26" y="72" textAnchor="end" className="fill-amber-300 text-[9px] font-hud font-bold">E</text>
                  <text x="115" y="88" textAnchor="middle" className="fill-cyan-300 text-[8px] font-hud">
                    Sole {solar.currentElevationDeg > 0 ? `+${solar.currentElevationDeg}°` : `${solar.currentElevationDeg}°`}
                  </text>
                  <text x="204" y="72" textAnchor="start" className="fill-orange-300 text-[9px] font-hud font-bold">O</text>
                </svg>
              </div>

              <dl className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-800 text-xs">
                <div className="rounded-lg bg-slate-950/70 border border-slate-800/90 p-2">
                  <dt className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Sun className="w-3 h-3 text-amber-400" /> Alba/Tram.
                  </dt>
                  <dd className="font-hud text-xs font-bold text-white tabular-nums mt-0.5">
                    {solar.sunriseTime} · {solar.sunsetTime}
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-950/70 border border-slate-800/90 p-2">
                  <dt className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Compass className="w-3 h-3 text-cyan-400" /> Zenit Max
                  </dt>
                  <dd className="font-hud text-xs font-bold text-cyan-300 tabular-nums mt-0.5">
                    {solar.solarNoonTime} ({solar.maxElevationDeg}°)
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-950/70 border border-slate-800/90 p-2">
                  <dt className="text-[10px] text-slate-400 truncate">Golden Hour</dt>
                  <dd className="font-hud text-xs font-bold text-amber-300 tabular-nums mt-0.5 truncate">
                    {solar.eveningGoldenHour}
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          {/* BOTTOM METEO ROW: 12-HOUR 3D THERMO-PLUVIOMETRIC CURVE + 5-DAY THERMAL OUTLOOK */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 shrink-0">
            <section
              className={`lg:col-span-7 ${card3DClass(
                4,
                'border-sky-400',
                'shadow-[0_0_30px_rgba(56,189,248,0.22)]'
              )}`}
            >
              <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-sky-400 to-transparent opacity-80" />
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-hud uppercase tracking-wider text-sky-300 font-bold">
                  Curva Termo-Pluviometrica 3D · Prossime 12 Ore
                </span>
                <span className="text-[11px] font-hud text-slate-400">
                  Curva Gialla/Ciano = Temperatura (°C) · Colonne 3D = Probabilità Pioggia (%)
                </span>
              </div>

              {chart12 && (
                <div className="rounded-xl bg-slate-950/85 border border-slate-800/90 p-3">
                  <svg viewBox={`0 0 ${chart12.w} ${chart12.h}`} className="w-full h-32 select-none block">
                    <defs>
                      <linearGradient id="kioskTempArea3D" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(56, 189, 248, 0.42)" />
                        <stop offset="100%" stopColor="rgba(56, 189, 248, 0.0)" />
                      </linearGradient>
                    </defs>

                    {chart12.nodes.map((n) => {
                      const barH = (n.item.precipitationProbability / 100) * 42;
                      return (
                        <g key={`bar-${n.item.time}`}>
                          <rect
                            x={n.x - 11}
                            y={90 - barH}
                            width="22"
                            height={Math.max(2, barH)}
                            rx="3"
                            fill="rgba(34, 211, 238, 0.25)"
                            stroke="rgba(34, 211, 238, 0.55)"
                            strokeWidth="0.9"
                          />
                        </g>
                      );
                    })}

                    <polygon points={chart12.areaPoints} fill="url(#kioskTempArea3D)" />
                    <polyline
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={chart12.polyPoints}
                    />

                    {chart12.nodes.map((n) => (
                      <g key={n.item.time} className="font-hud">
                        <circle cx={n.x} cy={n.y} r="3.6" fill="#fde047" stroke="#0f172a" strokeWidth="1.2" />
                        <text x={n.x} y={n.y - 8} textAnchor="middle" className="fill-white text-[11px] font-bold">
                          {n.item.temperature.toFixed(0)}°
                        </text>
                        <text x={n.x} y="106" textAnchor="middle" className="fill-slate-300 text-[10px]">
                          {n.item.hourLabel}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              )}
            </section>

            <section
              className={`lg:col-span-5 ${card3DClass(
                5,
                'border-emerald-400',
                'shadow-[0_0_30px_rgba(52,211,153,0.22)]'
              )}`}
            >
              <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-80" />
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-hud uppercase tracking-wider text-emerald-300 font-bold">
                  Proiezione Multi-Giorno · 5 Giorni
                </span>
                <span className="text-[11px] font-hud text-slate-400">Escursione Termica &amp; Pioggia</span>
              </div>

              <div className="grid grid-cols-5 gap-2.5 my-auto text-center font-hud">
                {daily.slice(0, 5).map((d) => (
                  <div
                    key={d.date}
                    className="rounded-xl border border-slate-800/90 bg-slate-950/80 p-3 flex flex-col justify-between gap-1.5"
                  >
                    <div className="text-xs font-bold text-cyan-200 truncate">{d.dayLabel}</div>
                    <div className="text-base font-bold text-white tabular-nums">
                      {d.maxTemp}° <span className="text-xs text-slate-400 font-normal">{d.minTemp}°</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400"
                        style={{ width: `${Math.min(100, Math.max(25, (d.maxTemp + 10) * 2.2))}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-sky-300 tabular-nums">{d.precipitationProbability}% pioggia</div>
                    <div className="text-[10px] text-amber-300/90 tabular-nums">UV {d.uvMax}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Headlines ticker: the news stay in view without leaving the weather tab */}
          {uniqueNews.length > 0 && (
            <div className="hub-ticker hub-ticker-mask shrink-0 overflow-hidden rounded-xl border border-slate-800/90 bg-slate-950/80 h-8 flex items-center">
              <div className="hub-ticker-track" style={{ ['--ticker-duration' as string]: '120s' }}>
                {[0, 1].map((copy) => (
                  <div key={copy} aria-hidden={copy === 1} className="flex items-center shrink-0">
                    {uniqueNews.slice(0, 12).map((item) => (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        tabIndex={copy === 1 ? -1 : undefined}
                        className="inline-flex items-center gap-2 px-4 text-xs text-slate-200 hover:text-cyan-300 whitespace-nowrap"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: NEWS_CATEGORY_META[item.category].color }}
                        />
                        <span className="font-hud font-bold text-slate-400">{item.source}</span>
                        <span>{item.title}</span>
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: SINTESI — few, huge figures, readable from across the room
          ===================================================================== */}
      {kioskTab === 'sintesi' && (
        <div key="kiosk-tab-sintesi" className="kiosk-stage flex-1 min-h-0 flex flex-col gap-3.5">
          <section className="relative flex-1 min-h-0 rounded-2xl border border-slate-700/75 bg-slate-950/80 p-6 grid grid-cols-1 lg:grid-cols-2 items-center gap-6 overflow-hidden">
            <div className="text-center lg:text-left min-w-0">
              <div className="font-hud font-bold tabular-nums leading-none text-white text-[clamp(4rem,19vh,15rem)]">
                {localTimeStr.slice(0, 5)}
              </div>
              <div className="mt-4 text-[clamp(1.25rem,3.4vh,2.5rem)] font-semibold text-slate-200 capitalize">{dateStr}</div>
              <div className="mt-1 text-[clamp(1rem,2.6vh,2rem)] text-slate-400">{location.name}</div>
            </div>

            <div className="flex items-center justify-center lg:justify-end gap-[3vh] min-w-0">
              <GlanceIcon className="shrink-0 w-[20vh] h-[20vh] max-w-[30vw] text-cyan-300" strokeWidth={1.4} aria-hidden />
              <div className="min-w-0">
                <div className="font-hud font-bold tabular-nums leading-none text-white text-[clamp(4rem,22vh,17rem)]">
                  {current.temperature.toFixed(0)}°
                </div>
                <div className="mt-3 text-[clamp(1.25rem,3.6vh,2.75rem)] font-semibold text-cyan-200">
                  {current.weatherDescription}
                </div>
                <div className="mt-1 font-hud tabular-nums text-[clamp(1rem,2.8vh,2rem)] text-slate-300">
                  Min {daily[0]?.minTemp}° · Max {daily[0]?.maxTemp}° · Vento {current.windSpeed} km/h
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 shrink-0">
            <section className="rounded-2xl border border-slate-700/75 bg-slate-950/80 px-6 py-4 flex items-center gap-4 min-w-0">
              <CloudRain className="w-[5vh] h-[5vh] shrink-0 text-sky-400" aria-hidden />
              <p className="text-[clamp(1.125rem,3.2vh,2.25rem)] font-semibold text-white">
                {weather.rainNext?.length ? summarizeRain(weather.rainNext) : 'Previsione pioggia a breve non disponibile'}
              </p>
            </section>
            <section
              className={`rounded-2xl border px-6 py-4 flex items-center gap-4 min-w-0 ${
                activeAlert && activeAlert.level !== 'green'
                  ? 'border-amber-400/70 bg-amber-500/15'
                  : 'border-slate-700/75 bg-slate-950/80'
              }`}
            >
              <ShieldAlert
                className={`w-[5vh] h-[5vh] shrink-0 ${activeAlert && activeAlert.level !== 'green' ? 'text-amber-300' : 'text-emerald-400'}`}
                aria-hidden
              />
              <p className="text-[clamp(1.125rem,3.2vh,2.25rem)] font-semibold text-white line-clamp-2">
                {activeAlert?.title ?? 'Nessuna allerta attiva'}
              </p>
            </section>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: NOTIZIE, TERREMOTI & VOLI 3D (UNIFIED FUTURISTIC 3D COMMAND TAB)
          ===================================================================== */}
      {kioskTab === 'eventi' && (
        <div key="kiosk-tab-eventi" className="kiosk-stage flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* COLUMN 1 (5 COLS): 3D HOLOGRAPHIC NEWS HUB WITH CATEGORY TABS */}
          <section className="lg:col-span-5 relative rounded-2xl border border-violet-400/50 bg-gradient-to-br from-slate-900/95 via-slate-900/85 to-slate-950/95 p-4 sm:p-5 flex flex-col justify-between overflow-hidden shadow-[0_1px_0_0_rgba(255,255,255,0.16)_inset,0_20px_44px_-12px_rgba(0,0,0,0.82)] min-h-0">
            <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-90" />

            {/* News Header & Category Filter Bar */}
            <div className="space-y-2.5 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-hud uppercase tracking-wider text-violet-300 font-bold flex items-center gap-1.5">
                  <Newspaper className="w-4 h-4 text-violet-400 shrink-0" /> Hub Notizie Tempo Reale 3D (ANSA · Google News)
                </span>
                <span className="text-xs font-hud text-cyan-300 tabular-nums">
                  {uniqueNews.length} notizie attive
                </span>
              </div>

              {/* Category Filter Tabs inside Kiosk */}
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categoria notizie Kiosk">
                {NEWS_FILTERS.map((cat) => {
                  const meta = NEWS_CATEGORY_META[cat];
                  const active = newsCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNewsCategory(cat)}
                      aria-pressed={active}
                      className={`px-2.5 py-1 rounded-lg font-hud text-xs font-bold transition-all inline-flex items-center gap-1.5 border ${
                        active
                          ? 'bg-slate-800 text-white border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.28)]'
                          : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3D Featured Lead Story Stage */}
            {leadStory ? (
              <a
                href={leadStory.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative my-3 rounded-xl border border-violet-400/40 bg-gradient-to-br from-violet-950/35 via-slate-950/90 to-slate-950/95 p-3.5 shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset,0_10px_25px_-8px_rgba(0,0,0,0.7)] hover:border-cyan-400/70 transition-all shrink-0 block overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2 text-xs font-hud mb-1.5">
                  <span
                    className="px-2 py-0.5 rounded font-bold text-slate-950"
                    style={{ backgroundColor: NEWS_CATEGORY_META[leadStory.category].color }}
                  >
                    PRIMO PIANO · {NEWS_CATEGORY_META[leadStory.category].short}
                  </span>
                  <span className="text-slate-300">
                    {leadStory.source} · {timeAgo(leadStory.publishedAt)}
                  </span>
                </div>
                <h3 className="font-display text-base sm:text-lg font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-2">
                  {leadStory.title}
                </h3>
                {leadStory.summary && (
                  <p className="text-xs text-slate-300 line-clamp-2 mt-1">{leadStory.summary}</p>
                )}
              </a>
            ) : (
              <div className="my-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400 text-center">
                {newsFeed.isLoading ? 'Sincronizzazione feed ANSA e Google News…' : 'Nessuna notizia disponibile.'}
              </div>
            )}

            {/* Scrollable Live News Stream */}
            <div className="flex-1 min-h-0 overflow-y-auto hub-scroll space-y-1.5 pr-1">
              {streamStories.map((item) => {
                const meta = NEWS_CATEGORY_META[item.category];
                return (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group rounded-xl bg-slate-950/80 border border-slate-800/90 hover:border-cyan-400/50 px-3 py-2 flex items-start gap-2.5 transition-all"
                  >
                    <span
                      className="w-1.5 h-8 rounded-full shrink-0 mt-0.5"
                      style={{ backgroundColor: meta.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-hud text-slate-400">
                        <span className="font-semibold text-slate-200 truncate">{item.source}</span>
                        <span className="shrink-0">{timeAgo(item.publishedAt)}</span>
                      </div>
                      <div className="text-xs font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors line-clamp-2 mt-0.5">
                        {item.title}
                        <ArrowUpRight className="inline w-3 h-3 ml-1 opacity-60 group-hover:opacity-100" />
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>

          {/* COLUMN 2 (4 COLS): 3D ISOMETRIC AIRSPACE RADAR DOME, FLIGHT FILTERS & ISS */}
          <section className="lg:col-span-4 relative rounded-2xl border border-cyan-400/50 bg-gradient-to-br from-slate-900/95 via-slate-900/85 to-slate-950/95 p-4 sm:p-5 flex flex-col justify-between overflow-hidden shadow-[0_1px_0_0_rgba(255,255,255,0.16)_inset,0_20px_44px_-12px_rgba(0,0,0,0.82)] min-h-0">
            <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-90" />

            {/* Radar Header + Radius & Altitude Filters */}
            <div className="space-y-2 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-hud uppercase tracking-wider text-cyan-300 font-bold flex items-center gap-1.5">
                  <Plane className="w-4 h-4 text-cyan-400 shrink-0" /> Cupola Radar Voli 3D &amp; ISS
                </span>
                <div className="flex items-center gap-1 font-hud text-xs">
                  {([75, 150] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRadarRadiusKm(r)}
                      aria-pressed={radarRadiusKm === r}
                      className={`px-2 py-0.5 rounded-md border font-bold ${
                        radarRadiusKm === r
                          ? 'border-cyan-400 bg-cyan-500/25 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      {r} km
                    </button>
                  ))}
                </div>
              </div>

              {/* Altitude Band Filter Chips */}
              <div className="flex flex-wrap gap-1 text-[11px] font-hud">
                {[
                  { id: 'all' as KioskAltFilter, label: `Tutti (${allNearbyFlights.length})`, dot: '#38bdf8' },
                  { id: 'low' as KioskAltFilter, label: '<3 km', dot: '#34d399' },
                  { id: 'mid' as KioskAltFilter, label: '3–8,5 km', dot: '#22d3ee' },
                  { id: 'high' as KioskAltFilter, label: '>8,5 km', dot: '#a78bfa' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setFlightAltFilter(b.id)}
                    aria-pressed={flightAltFilter === b.id}
                    className={`px-2 py-0.5 rounded-lg border font-bold inline-flex items-center gap-1 ${
                      flightAltFilter === b.id
                        ? 'border-cyan-400 bg-slate-800 text-white'
                        : 'border-slate-800 bg-slate-950/80 text-slate-300'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: b.dot }} />
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3D Isometric Airspace Radar Dome SVG */}
            <div className="my-2.5 rounded-xl bg-slate-950/90 border border-slate-800/90 p-2.5 overflow-hidden shrink-0">
              <svg viewBox="0 0 360 195" className="w-full h-40 select-none block" aria-label="Cupola radar 3D voli">
                <defs>
                  <radialGradient id="kioskEventDomeGlow" cx="50%" cy="50%" r="55%">
                    <stop offset="0%" stopColor="rgba(34, 211, 238, 0.26)" />
                    <stop offset="100%" stopColor="rgba(2, 6, 23, 0)" />
                  </radialGradient>
                </defs>
                {/* 3D Upper Dome Wireframe */}
                <path
                  d="M 45 140 A 135 105 0 0 1 315 140"
                  fill="none"
                  stroke="rgba(56, 189, 248, 0.22)"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                />
                {/* Altitude Scale */}
                <g className="font-hud text-[8.5px] fill-slate-400">
                  <line x1="26" y1="140" x2="26" y2="62" stroke="rgba(148,163,184,0.35)" strokeWidth="1" />
                  <text x="22" y="65" textAnchor="end">12km</text>
                  <text x="22" y="102" textAnchor="end">6km</text>
                  <text x="22" y="142" textAnchor="end">0</text>
                </g>

                {/* Tilted 3D Radar Ground Plane */}
                <ellipse cx="180" cy="140" rx="135" ry="42" fill="url(#kioskEventDomeGlow)" stroke="#22d3ee" strokeWidth="1.3" />
                <ellipse cx="180" cy="140" rx="85" ry="26" fill="none" stroke="rgba(34,211,238,0.28)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="45" y1="140" x2="315" y2="140" stroke="rgba(56,189,248,0.2)" strokeWidth="1" />
                <line x1="180" y1="98" x2="180" y2="182" stroke="rgba(56,189,248,0.2)" strokeWidth="1" />
                <text x="180" y="92" textAnchor="middle" className="fill-cyan-300 font-hud text-[9.5px] font-bold">NORD</text>
                <text x="180" y="192" textAnchor="middle" className="fill-slate-400 font-hud text-[9px]">SUD ({radarRadiusKm} km)</text>
                <circle cx="180" cy="140" r="3" fill="#ffffff" />

                {/* 3D Aircraft Altitude Pillars */}
                {filteredFlights.slice(0, 18).map((f, i) => {
                  const norm = Math.min(0.93, Math.max(0.06, f.km / radarRadiusKm));
                  const rad = ((f.bearing - 90) * Math.PI) / 180;
                  const gx = 180 + Math.cos(rad) * 135 * norm;
                  const gy = 140 + Math.sin(rad) * 42 * norm;
                  const altM = Math.max(300, f.altitudeM ?? 1500);
                  const pillarH = Math.min(76, Math.max(9, (altM / 12000) * 76));
                  const topY = gy - pillarH;
                  const col = altM < 3000 ? '#34d399' : altM <= 8500 ? '#22d3ee' : '#a78bfa';
                  const alignEnd = gx > 220;
                  return (
                    <g key={f.id}>
                      <ellipse cx={gx} cy={gy} rx="3" ry="1.4" fill={col} opacity="0.45" />
                      <line x1={gx} y1={gy} x2={gx} y2={topY} stroke={col} strokeWidth="1.4" strokeDasharray="2 1" />
                      <circle cx={gx} cy={topY} r="3.6" fill={col} stroke="#020617" strokeWidth="1" />
                      {i < 7 && (
                        <text
                          x={alignEnd ? gx - 5 : gx + 5}
                          y={topY + 3}
                          textAnchor={alignEnd ? 'end' : 'start'}
                          className="fill-white font-hud text-[8.5px] font-bold"
                        >
                          {f.callsign}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Live Aircraft List */}
            <div className="flex-1 min-h-0 overflow-y-auto hub-scroll space-y-1.5 pr-1">
              {filteredFlights.length === 0 ? (
                <div className="text-xs text-slate-400 py-4 text-center">
                  {flightsFeed.isLoading ? 'Scansione transponder ADS-B…' : `Nessun volo entro ${radarRadiusKm} km per questo filtro`}
                </div>
              ) : (
                filteredFlights.slice(0, 8).map((f) => (
                  <div
                    key={f.id}
                    className="rounded-xl bg-slate-950/80 border border-slate-800/90 px-3 py-1.5 flex items-center justify-between gap-2 text-xs min-w-0"
                  >
                    <div className="min-w-0 truncate">
                      <span className="font-hud font-bold text-cyan-300">{f.callsign}</span>
                      <span className="text-slate-300 ml-1.5 truncate">
                        · {f.meta.airlineName ?? f.meta.aircraftLabel}
                      </span>
                    </div>
                    <div className="font-hud text-[11px] text-slate-200 tabular-nums shrink-0">
                      {f.altitudeM ? `${f.altitudeM.toLocaleString('it-IT')}m · ` : ''}
                      {f.speedKmh ? `${f.speedKmh}km/h · ` : ''}
                      <strong className="text-white">{Math.round(f.km)}km</strong> {f.dir}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ISS Orbital Passes Strip */}
            <div className="rounded-xl bg-slate-950/90 border border-amber-500/35 px-3 py-2 mt-2 shrink-0">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-amber-300 font-bold truncate">
                  <Satellite className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Passaggi ISS (36h):</span>
                </span>
                {issPasses.length > 0 ? (
                  <span className="font-hud text-white font-bold tabular-nums shrink-0">
                    {new Date(issPasses[0].startMs).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · Culmine{' '}
                    <span className="text-cyan-300">{Math.round(issPasses[0].maxElevationDeg)}°</span> ({compassIt(issPasses[0].startAzimuthDeg)}→{compassIt(issPasses[0].endAzimuthDeg)})
                  </span>
                ) : (
                  <span className="font-hud text-slate-400">Calcolo orbita SGP4…</span>
                )}
              </div>
            </div>
          </section>

          {/* COLUMN 3 (3 COLS): 3D SUBTERRANEAN SEISMIC MONITOR (INGV / USGS) */}
          <section className="lg:col-span-3 relative rounded-2xl border border-rose-500/50 bg-gradient-to-br from-slate-900/95 via-slate-900/85 to-slate-950/95 p-4 sm:p-5 flex flex-col justify-between overflow-hidden shadow-[0_1px_0_0_rgba(255,255,255,0.16)_inset,0_20px_44px_-12px_rgba(0,0,0,0.82)] min-h-0">
            <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-rose-400 to-transparent opacity-90" />

            {/* Seismic Header & Magnitude Filter */}
            <div className="space-y-2 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-hud uppercase tracking-wider text-rose-300 font-bold flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-rose-400 shrink-0" /> Sismografo 3D (INGV/USGS)
                </span>
                <span className="text-xs font-hud text-rose-300 font-bold tabular-nums">
                  {filteredQuakes.length} sismi
                </span>
              </div>

              <div className="flex items-center gap-1 text-[11px] font-hud">
                {[
                  { min: 0, label: 'Tutti' },
                  { min: 2.5, label: 'M 2.5+' },
                  { min: 4.0, label: 'M 4.0+' },
                ].map((f) => (
                  <button
                    key={f.min}
                    type="button"
                    onClick={() => setMinQuakeMag(f.min)}
                    aria-pressed={minQuakeMag === f.min}
                    className={`px-2.5 py-0.5 rounded-lg border font-bold ${
                      minQuakeMag === f.min
                        ? 'border-rose-400 bg-rose-500/25 text-white'
                        : 'border-slate-800 bg-slate-950/80 text-slate-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3D Isometric Subterranean Hypocenter Depth Visualizer SVG */}
            <div className="my-2.5 rounded-xl bg-slate-950/90 border border-slate-800/90 p-2.5 overflow-hidden shrink-0">
              <div className="flex items-center justify-between text-[10px] font-hud text-slate-400 mb-1">
                <span className="flex items-center gap-1 text-rose-300 font-semibold">
                  <Layers className="w-3 h-3" /> Sezione Crostale 3D · Profondità Ipocentri
                </span>
                <span>0–120 km</span>
              </div>
              <svg viewBox="0 0 260 135" className="w-full h-32 select-none block" aria-label="Sezione crostale 3D ipocentri sismici">
                {/* 3D Surface Crust Plane */}
                <polygon
                  points="35,28 235,28 215,52 15,52"
                  fill="rgba(244, 63, 94, 0.1)"
                  stroke="rgba(251, 113, 133, 0.45)"
                  strokeWidth="1.2"
                />
                {/* 3D Subterranean Lithosphere Cube Wireframe */}
                <line x1="15" y1="52" x2="15" y2="122" stroke="rgba(148,163,184,0.28)" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="215" y1="52" x2="215" y2="122" stroke="rgba(148,163,184,0.28)" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="235" y1="28" x2="235" y2="98" stroke="rgba(148,163,184,0.2)" strokeWidth="1" strokeDasharray="2 2" />
                <polygon
                  points="35,98 235,98 215,122 15,122"
                  fill="rgba(15, 23, 42, 0.6)"
                  stroke="rgba(148, 163, 184, 0.25)"
                  strokeWidth="1"
                />
                <text x="242" y="34" className="fill-slate-400 font-hud text-[8px]">0km</text>
                <text x="242" y="75" className="fill-slate-400 font-hud text-[8px]">50km</text>
                <text x="242" y="115" className="fill-slate-400 font-hud text-[8px]">100km+</text>

                {/* Plot Recent Quakes with Epicenter Shockwave + Vertical Depth Line + 3D Hypocenter Sphere */}
                {filteredQuakes.slice(0, 8).map((q, idx) => {
                  const mag = typeof q.mag === 'number' ? q.mag : 2;
                  const col = quakeColor(mag);
                  const sx = 32 + (idx / 7) * 176;
                  const sy = 36 + (idx % 2) * 8;
                  const depthNorm = Math.min(1, Math.max(0.08, (q.depthKm ?? 10) / 100));
                  const hy = sy + depthNorm * 68;
                  const r = Math.min(8, Math.max(3, mag * 1.3));
                  return (
                    <g key={q.id}>
                      {/* Surface Epicenter Shockwave Ring */}
                      <ellipse cx={sx} cy={sy} rx={r * 1.8} ry={r * 0.75} fill="none" stroke={col} strokeWidth="1" opacity="0.7" />
                      {/* Vertical Hypocentral Depth Line */}
                      <line x1={sx} y1={sy} x2={sx} y2={hy} stroke={col} strokeWidth="1.2" strokeDasharray="2 1" />
                      {/* 3D Hypocenter Sphere at Depth */}
                      <circle cx={sx} cy={hy} r={r} fill={col} stroke="#020617" strokeWidth="1" />
                      {idx < 4 && (
                        <text x={sx} y={hy + r + 8} textAnchor="middle" className="fill-white font-hud text-[8px] font-bold">
                          M{mag.toFixed(1)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Scrollable Live Quake List */}
            <div className="flex-1 min-h-0 overflow-y-auto hub-scroll space-y-1.5 pr-1">
              {filteredQuakes.length === 0 ? (
                <div className="text-xs text-slate-400 py-6 text-center">
                  {quakesFeed.isLoading ? 'Connessione rete sismica INGV / USGS…' : 'Nessun sisma per questo filtro'}
                </div>
              ) : (
                filteredQuakes.slice(0, 10).map((q) => {
                  const mag = typeof q.mag === 'number' ? q.mag : 0;
                  const col = quakeColor(mag);
                  return (
                    <a
                      key={q.id}
                      href={q.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl bg-slate-950/80 border border-slate-800/90 hover:border-rose-400/50 px-2.5 py-2 flex items-center justify-between gap-2.5 text-xs min-w-0 transition-colors"
                    >
                      <span
                        className="font-hud text-xs font-bold px-2 py-1 rounded-lg shrink-0 tabular-nums text-slate-950"
                        style={{ backgroundColor: col }}
                      >
                        M{mag.toFixed(1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-100 truncate" title={q.place}>
                          {q.place}
                        </div>
                        <div className="font-hud text-[10px] text-slate-400 tabular-nums">
                          Prof. {Math.round(q.depthKm ?? 0)} km · a {q.distKm.toLocaleString('it-IT')} km
                        </div>
                      </div>
                      <span className="font-hud text-[11px] text-slate-300 tabular-nums shrink-0">
                        {new Date(q.time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </a>
                  );
                })
              )}
            </div>

            <div className="pt-2 mt-2 border-t border-slate-800/90 flex items-center justify-between text-[11px] font-hud text-slate-400 shrink-0">
              <span>Reti: INGV Italia · USGS Global</span>
              <span className="text-emerald-400">Live 24/7</span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

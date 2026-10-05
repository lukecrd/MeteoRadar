import React, { useMemo, useState } from 'react';
import { Flame, Orbit } from 'lucide-react';
import { usePolledResource } from '../../hooks/usePolledResource';
import {
  fetchGeoNews,
  fetchMarkets,
  formatPct,
  formatPrice,
  GEO_REGION_META,
  GeoRegion,
  MarketQuote,
  trendColor,
  UP,
  DOWN,
} from '../../services/hubApi';
import { HubGlobe3D, GlobeMarker } from './HubGlobe3D';
import { CryptoDeck } from './CryptoDeck';
import { MarketBoard, marketMarkerId } from './MarketBoard';
import { WorldNewsPanel } from './WorldNewsPanel';
import { WorldClocks } from './HubWidgets';

const NEWS_REFRESH_MS = 5 * 60_000;
const MARKETS_REFRESH_MS = 60_000;

const REGIONS: (GeoRegion | 'all')[] = ['all', 'europa', 'americhe', 'mena', 'asia'];
const REGION_FOCUS: Record<GeoRegion, { lat: number; lon: number }> = {
  europa: { lat: 48, lon: 14 },
  americhe: { lat: 12, lon: -78 },
  mena: { lat: 18, lon: 32 },
  asia: { lat: 18, lon: 118 },
};

const newsMarkerId = (areaId: string) => `news:${areaId}`;

export const GlobalHub: React.FC = () => {
  const news = usePolledResource(fetchGeoNews, NEWS_REFRESH_MS);
  const markets = usePolledResource(fetchMarkets, MARKETS_REFRESH_MS);
  const [region, setRegion] = useState<GeoRegion | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const areas = news.data?.areas ?? [];
  const quotes = markets.data?.quotes ?? [];

  const markers: GlobeMarker[] = useMemo(() => {
    const maxRecent = Math.max(1, ...areas.map((a) => a.recentCount));
    const newsMarkers: GlobeMarker[] = areas
      .filter((a) => a.items.length > 0)
      .map((a) => ({
        id: newsMarkerId(a.id),
        kind: 'news',
        lat: a.lat,
        lon: a.lon,
        label: a.name,
        sublabel: `${a.items.length} notizie · ${a.recentCount} nelle ultime 6 h`,
        color: GEO_REGION_META[a.region].color,
        heat: a.recentCount / maxRecent,
        dimmed: region !== 'all' && a.region !== region,
      }));
    const marketMarkers: GlobeMarker[] = quotes
      .filter((q) => q.lat != null && q.lon != null)
      .map((q) => ({
        id: marketMarkerId(q.symbol),
        kind: 'market',
        lat: q.lat!,
        lon: q.lon!,
        label: `${q.name}`,
        sublabel: `${q.city} · ${formatPrice(q.price)} · ${formatPct(q.changePct)}${q.isOpen ? ' · APERTA' : ''}`,
        color: q.changePct >= 0 ? UP : DOWN,
        heat: Math.min(1, Math.abs(q.changePct) / 3),
      }));
    return [...newsMarkers, ...marketMarkers];
  }, [areas, quotes, region]);

  const selectedArea = selectedId?.startsWith('news:') ? areas.find((a) => newsMarkerId(a.id) === selectedId) ?? null : null;
  const selectedMarker = markers.find((m) => m.id === selectedId) ?? null;

  const focus = useMemo(() => {
    if (selectedMarker) return { lat: selectedMarker.lat, lon: selectedMarker.lon };
    if (region !== 'all') return REGION_FOCUS[region];
    return null;
  }, [selectedMarker?.lat, selectedMarker?.lon, region]);

  const hotspots = useMemo(
    () =>
      [...areas]
        .filter((a) => region === 'all' || a.region === region)
        .sort((a, b) => b.recentCount - a.recentCount)
        .slice(0, 3),
    [areas, region]
  );

  const selectMarket = (q: MarketQuote) => {
    // Secondary indices (e.g. Nasdaq) share their exchange city's marker.
    const anchor = q.lat != null ? q : quotes.find((o) => o.city === q.city && o.lat != null);
    setSelectedId(anchor ? marketMarkerId(anchor.symbol) : null);
  };

  const sp500 = quotes.find((q) => q.symbol === '^GSPC');
  const mib = quotes.find((q) => q.symbol === 'FTSEMIB.MI');
  const totalStories = areas.reduce((n, a) => n + a.items.length, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="hub-panel hub-panel--glow p-4 sm:p-5 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="hub-label flex items-center gap-2">
            <span className="hub-live-dot" /> MOD-00 // Centro di comando globale
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-1 flex items-center gap-3">
            <Orbit className="w-8 h-8 text-[var(--hub-cyan)]" />
            Global Hub
          </h2>
          <p className="text-sm text-[var(--hub-dim)] mt-1">
            {totalStories > 0 ? `${totalStories} notizie da ${areas.length} aree` : 'Notizie geolocalizzate'} · borse mondiali · crypto in tempo reale
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

      {/* Region filter */}
      <div className="flex gap-2 overflow-x-auto pb-1" role="toolbar" aria-label="Filtra per area geografica">
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
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: GEO_REGION_META[r].color }} />
            {GEO_REGION_META[r].label}
          </button>
        ))}
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
            onSelectArea={(id) => setSelectedId(newsMarkerId(id))}
            onClearArea={() => setSelectedId(null)}
          />
        </div>

        <div className="order-1 xl:order-2 hub-panel overflow-hidden relative h-[420px] sm:h-[520px] xl:h-auto hub-globe-stage">
          <HubGlobe3D markers={markers} selectedId={selectedId} onSelect={setSelectedId} focus={focus} />

          {/* Hotspots */}
          <div className="absolute left-3 top-3 z-10 space-y-1.5 pointer-events-none max-w-[60%]">
            <div className="hub-label flex items-center gap-1.5">
              <Flame className="w-3 h-3 text-[var(--hub-red)]" /> Hotspot ultime 6 h
            </div>
            {hotspots.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedId(newsMarkerId(a.id))}
                className="pointer-events-auto hub-chip !h-7 !text-[10px]"
                aria-pressed={selectedId === newsMarkerId(a.id)}
                style={{ ['--chip-color' as any]: GEO_REGION_META[a.region].color }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: GEO_REGION_META[a.region].color }} />
                {a.name} <span className="opacity-70">{a.recentCount}</span>
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="absolute left-3 bottom-3 z-10 flex flex-wrap items-center gap-3 font-hud text-[10px] text-[var(--hub-dim)] pointer-events-none">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--hub-cyan)] shadow-[0_0_6px_var(--hub-cyan)]" /> Notizie
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rotate-45" style={{ background: UP }} />
              <span className="w-2 h-2 rotate-45" style={{ background: DOWN }} /> Borse
            </span>
            <span className="hidden sm:inline">Trascina per ruotare · tocca un punto</span>
          </div>
        </div>

        <div className="order-3 h-[520px] xl:h-auto min-h-0 flex">
          <MarketBoard
            quotes={quotes}
            isLoading={markets.isLoading}
            error={markets.error}
            fetchedAt={markets.data?.fetchedAt ?? null}
            selectedId={selectedId}
            onSelect={selectMarket}
            onRefresh={markets.refresh}
          />
        </div>
      </div>

      <p className="hub-label text-center !normal-case !tracking-normal opacity-70">
        Fonti: Google News (notizie) · Yahoo Finance (borse, dati non ufficiali con possibile ritardo) · Binance / CoinGecko (crypto). Solo a scopo informativo.
      </p>
    </div>
  );
};

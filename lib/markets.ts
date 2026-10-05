// World stock indices, FX and commodities for the Global Hub. Quotes come
// from Yahoo Finance's public chart endpoint (no API key, but unofficial:
// it can change or rate-limit, so every symbol degrades independently and
// the last good quote is kept). Shared by server.ts and the Vercel function.

export type MarketKind = 'index' | 'fx' | 'commodity';
export type MarketRegion = 'europa' | 'americhe' | 'asia' | 'global';

export interface MarketDef {
  symbol: string;
  name: string;
  short: string;
  kind: MarketKind;
  region: MarketRegion;
  city?: string;
  /** only the headline index per exchange city gets a globe marker */
  lat?: number;
  lon?: number;
}

export interface MarketQuote extends MarketDef {
  currency: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  dayHigh: number | null;
  dayLow: number | null;
  isOpen: boolean;
  marketTime: number; // epoch ms of the last trade
  spark: number[];
}

export interface MarketsResponse {
  quotes: MarketQuote[];
  fetchedAt: number;
  errors: string[];
}

export const MARKETS: MarketDef[] = [
  { symbol: 'FTSEMIB.MI', region: 'europa', name: 'FTSE MIB', short: 'MIB', kind: 'index', city: 'Milano', lat: 45.46, lon: 9.19 },
  { symbol: '^STOXX50E', region: 'europa', name: 'Euro Stoxx 50', short: 'SX5E', kind: 'index', city: 'Zurigo', lat: 47.37, lon: 8.54 },
  { symbol: '^GDAXI', region: 'europa', name: 'DAX 40', short: 'DAX', kind: 'index', city: 'Francoforte', lat: 50.11, lon: 8.68 },
  { symbol: '^FCHI', region: 'europa', name: 'CAC 40', short: 'CAC', kind: 'index', city: 'Parigi', lat: 48.87, lon: 2.34 },
  { symbol: '^FTSE', region: 'europa', name: 'FTSE 100', short: 'UKX', kind: 'index', city: 'Londra', lat: 51.51, lon: -0.09 },
  { symbol: '^IBEX', region: 'europa', name: 'IBEX 35', short: 'IBEX', kind: 'index', city: 'Madrid', lat: 40.42, lon: -3.7 },
  { symbol: '^GSPC', region: 'americhe', name: 'S&P 500', short: 'SPX', kind: 'index', city: 'New York', lat: 40.71, lon: -74.01 },
  { symbol: '^IXIC', region: 'americhe', name: 'Nasdaq Composite', short: 'NDX', kind: 'index', city: 'New York' },
  { symbol: '^DJI', region: 'americhe', name: 'Dow Jones', short: 'DJI', kind: 'index', city: 'New York' },
  { symbol: '^GSPTSE', region: 'americhe', name: 'S&P/TSX', short: 'TSX', kind: 'index', city: 'Toronto', lat: 43.65, lon: -79.38 },
  { symbol: '^BVSP', region: 'americhe', name: 'Bovespa', short: 'IBOV', kind: 'index', city: 'San Paolo', lat: -23.55, lon: -46.63 },
  { symbol: '^MXX', region: 'americhe', name: 'IPC Messico', short: 'MEXBOL', kind: 'index', city: 'Città del Messico', lat: 19.43, lon: -99.13 },
  { symbol: '^N225', region: 'asia', name: 'Nikkei 225', short: 'NKY', kind: 'index', city: 'Tokyo', lat: 35.68, lon: 139.77 },
  { symbol: '^HSI', region: 'asia', name: 'Hang Seng', short: 'HSI', kind: 'index', city: 'Hong Kong', lat: 22.28, lon: 114.16 },
  { symbol: '000001.SS', region: 'asia', name: 'Shanghai Composite', short: 'SHCOMP', kind: 'index', city: 'Shanghai', lat: 31.23, lon: 121.47 },
  { symbol: '^KS11', region: 'asia', name: 'KOSPI', short: 'KOSPI', kind: 'index', city: 'Seul', lat: 37.57, lon: 126.98 },
  { symbol: '^BSESN', region: 'asia', name: 'BSE Sensex', short: 'SENSEX', kind: 'index', city: 'Mumbai', lat: 19.08, lon: 72.88 },
  { symbol: '^AXJO', region: 'asia', name: 'ASX 200', short: 'AS51', kind: 'index', city: 'Sydney', lat: -33.87, lon: 151.21 },
  { symbol: 'EURUSD=X', region: 'global', name: 'Euro / Dollaro', short: 'EUR/USD', kind: 'fx' },
  { symbol: 'GC=F', region: 'global', name: 'Oro', short: 'GOLD', kind: 'commodity' },
  { symbol: 'CL=F', region: 'global', name: 'Petrolio WTI', short: 'WTI', kind: 'commodity' },
  { symbol: 'BZ=F', region: 'global', name: 'Petrolio Brent', short: 'BRENT', kind: 'commodity' },
];

const CACHE_TTL_MS = 45 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const CONCURRENCY = 6;
const SPARK_POINTS = 40;

let cache: { at: number; data: MarketsResponse } | null = null;
let inflight: Promise<MarketsResponse> | null = null;

function downsample(values: number[], points: number): number[] {
  if (values.length <= points) return values;
  const step = (values.length - 1) / (points - 1);
  return Array.from({ length: points }, (_, i) => values[Math.round(i * step)]);
}

async function fetchQuote(def: MarketDef): Promise<MarketQuote> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(def.symbol)}?range=1d&interval=5m`;
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (MeteoRadar Global Hub)' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: any = await res.json();
    const result = json?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') throw new Error('risposta senza prezzo');

    const closes: number[] = (result.indicators?.quote?.[0]?.close ?? []).filter((v: unknown): v is number => typeof v === 'number');
    const price: number = meta.regularMarketPrice;
    const prevClose: number = meta.chartPreviousClose ?? meta.previousClose ?? closes[0] ?? price;
    const period = meta.currentTradingPeriod?.regular;
    const nowSec = Date.now() / 1000;

    return {
      ...def,
      currency: meta.currency ?? '',
      price,
      prevClose,
      change: price - prevClose,
      changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
      dayHigh: meta.regularMarketDayHigh ?? null,
      dayLow: meta.regularMarketDayLow ?? null,
      // Futures and FX trade almost round the clock; Yahoo's "regular" window is meaningless there.
      isOpen: def.kind === 'index' ? !!period && nowSec >= period.start && nowSec < period.end : nowSec - (meta.regularMarketTime ?? 0) < 15 * 60,
      marketTime: (meta.regularMarketTime ?? nowSec) * 1000,
      spark: downsample(closes, SPARK_POINTS),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function loadAll(): Promise<MarketsResponse> {
  const prevBySymbol = new Map(cache?.data.quotes.map((q) => [q.symbol, q]));
  const quotes: (MarketQuote | null)[] = new Array(MARKETS.length).fill(null);
  const errors: string[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < MARKETS.length) {
        const i = next++;
        const def = MARKETS[i];
        try {
          quotes[i] = await fetchQuote(def);
        } catch (err: any) {
          errors.push(`${def.name}: ${err?.name === 'AbortError' ? 'timeout' : err?.message || err}`);
          quotes[i] = prevBySymbol.get(def.symbol) ?? null;
        }
      }
    })
  );
  return { quotes: quotes.filter((q): q is MarketQuote => q !== null), fetchedAt: Date.now(), errors };
}

export async function getMarkets(): Promise<MarketsResponse> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  inflight ??= loadAll()
    .then((data) => {
      cache = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

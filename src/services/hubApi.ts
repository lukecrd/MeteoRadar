import type { GeoAreaNews, GeoNewsItem, GeoNewsResponse, GeoRegion } from '../../lib/geonews';
import type { MarketQuote, MarketsResponse } from '../../lib/markets';
import type { Quake, QuakesResponse } from '../../lib/quakes';
import type { Airport, Flight, FlightHub, FlightInfo, HubFlightsResponse } from '../../lib/flights';

export type { GeoAreaNews, GeoNewsItem, GeoNewsResponse, GeoRegion, MarketQuote, MarketsResponse };
export type { Quake, QuakesResponse, Airport, Flight, FlightHub, FlightInfo, HubFlightsResponse };
// Plain data (no Node APIs), safe to bundle for the browser.
export { FLIGHT_HUBS, FLIGHT_RADIUS_KM } from '../../lib/flights';

// Same convention as newsApi: native builds point at a deployed backend.
const API_BASE: string = ((import.meta as any).env?.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';

async function getJson<T>(path: string, label: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${label} non disponibile (HTTP ${res.status})`);
  return (await res.json()) as T;
}

export const fetchGeoNews = () => getJson<GeoNewsResponse>('/api/geonews', 'Feed notizie mondiali');
export const fetchMarkets = () => getJson<MarketsResponse>('/api/markets', 'Feed mercati');
export const fetchQuakes = () => getJson<QuakesResponse>('/api/quakes', 'Feed terremoti');
export const fetchHubFlights = (hub: string) =>
  getJson<HubFlightsResponse>(`/api/flights?hub=${encodeURIComponent(hub)}`, 'Traffico aereo');
export const fetchFlightInfo = (callsign: string, hex: string) =>
  getJson<FlightInfo>(`/api/flight?callsign=${encodeURIComponent(callsign)}&hex=${encodeURIComponent(hex)}`, 'Dettagli volo');

// Data colours come from the shared scales (quakes warm, flights cool).
export { quakeColor, flightColor } from '../theme/colorScales';

/** Great-circle distance in km. */
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const GEO_REGION_META: Record<GeoRegion | 'all', { label: string; color: string }> = {
  all: { label: 'Mondo', color: '#22d3ee' },
  europa: { label: 'Europa', color: '#60a5fa' },
  americhe: { label: 'Americhe', color: '#f472b6' },
  mena: { label: 'Medio Oriente & Africa', color: '#fbbf24' },
  asia: { label: 'Asia & Oceania', color: '#34d399' },
};

const numberFormats = new Map<string, Intl.NumberFormat>();
export function formatNumber(value: number, digits = 2): string {
  const key = String(digits);
  let fmt = numberFormats.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    numberFormats.set(key, fmt);
  }
  return fmt.format(value);
}

/** Picks precision from magnitude: 1.1234 for FX, 7.722,72 for indices. */
export function formatPrice(value: number): string {
  return formatNumber(value, Math.abs(value) < 10 ? 4 : 2);
}

export function formatPct(value: number): string {
  return `${value > 0 ? '+' : ''}${formatNumber(value, 2)}%`;
}

export const UP = '#34d399';
export const DOWN = '#fb7185';
/** Text colour for a change; theme-aware (the hex UP/DOWN are for WebGL and SVG). */
export const trendColor = (v: number) => (v > 0 ? 'var(--hub-up)' : v < 0 ? 'var(--hub-down)' : 'var(--hub-dim)');

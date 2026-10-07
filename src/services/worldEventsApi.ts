import type {
  Disaster,
  Earthquake,
  FeedResponse,
  Flight,
  FlightsResponse,
  SatelliteGroup,
  SatelliteTle,
  SatellitesResponse,
} from '../../lib/worldEvents';

import type { AirportInfo, FlightDetail, FlightInfoResponse, FlightLiveResponse, FlightSearchResponse } from '../../lib/flightTracker';
import { FLIGHT_ALT_SCALE, QUAKE_SCALE } from '../theme/colorScales';

export type { AirportInfo, FlightDetail, FlightInfoResponse, FlightLiveResponse, FlightSearchResponse };

export type { Disaster, Earthquake, FeedResponse, Flight, FlightsResponse, SatelliteGroup, SatelliteTle, SatellitesResponse };

// Same convention as newsApi: native builds can point at a deployed backend.
const API_BASE: string = ((import.meta as any).env?.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';

export const WORLD_ENDPOINTS = {
  earthquakes: `${API_BASE}/api/earthquakes`,
  flights: `${API_BASE}/api/flights`,
  disasters: `${API_BASE}/api/disasters`,
  flightSearch: (q: string) => `${API_BASE}/api/flights/search?q=${encodeURIComponent(q)}`,
  flightLive: (icao24: string) => `${API_BASE}/api/flights/live?icao24=${encodeURIComponent(icao24)}`,
  flightInfo: (callsign: string | null, icao24: string | null) =>
    `${API_BASE}/api/flights/info?${new URLSearchParams({ ...(callsign ? { callsign } : {}), ...(icao24 ? { icao24 } : {}) })}`,
  satellites: (group: SatelliteGroup) => `${API_BASE}/api/satellites?group=${encodeURIComponent(group)}`,
} as const;

/** CelesTrak groups offered in the Satelliti window (order = menu order). */
export const SATELLITE_GROUP_META: { id: SatelliteGroup; label: string }[] = [
  { id: 'stations', label: 'Stazioni spaziali' },
  { id: 'visual', label: 'Più luminosi' },
  { id: 'weather', label: 'Meteo' },
  { id: 'gps-ops', label: 'GPS' },
  { id: 'starlink', label: 'Starlink' },
  { id: 'active', label: 'Tutti gli attivi' },
];

export const ISS_NORAD = 25544;

/** Globe layers the user can show/hide. */
export type WorldLayer = 'news' | 'quakes' | 'flights' | 'alerts' | 'satellites';

// Data colours come from the shared scales in theme/colorScales (quakes warm,
// flights cool); the swatch here only labels the layer toggle.
export const LAYER_META: Record<WorldLayer, { label: string; color: string }> = {
  news: { label: 'Notizie', color: '#60a5fa' },
  quakes: { label: 'Terremoti', color: QUAKE_SCALE[4].color },
  flights: { label: 'Voli', color: FLIGHT_ALT_SCALE[1].color },
  alerts: { label: 'Allerte', color: '#f472b6' },
  satellites: { label: 'Satelliti', color: '#a98bf5' },
};

export { quakeColor, quakeTextColor, flightColor, FLIGHT_ALT_SCALE } from '../theme/colorScales';

/** Altitude bands for the flight filter, same classes and colours as flightColor(). */
export type AltBand = 'low' | 'climb' | 'mid' | 'cruise';
export const ALT_BANDS: { id: AltBand; label: string; hint: string; color: string; maxFt: number }[] = [
  { id: 'low', label: FLIGHT_ALT_SCALE[0].label, hint: 'Decollo e atterraggio', color: FLIGHT_ALT_SCALE[0].color, maxFt: 10000 },
  { id: 'climb', label: FLIGHT_ALT_SCALE[1].label, hint: 'Salita e discesa', color: FLIGHT_ALT_SCALE[1].color, maxFt: 25000 },
  { id: 'mid', label: FLIGHT_ALT_SCALE[2].label, hint: 'Crociera bassa', color: FLIGHT_ALT_SCALE[2].color, maxFt: 35000 },
  { id: 'cruise', label: FLIGHT_ALT_SCALE[3].label, hint: 'Crociera alta', color: FLIGHT_ALT_SCALE[3].color, maxFt: Infinity },
];
export const altBandOf = (altFt: number): AltBand => ALT_BANDS.find((b) => altFt < b.maxFt)!.id;

export const DISASTER_LABEL: Record<string, string> = {
  EQ: 'Terremoto',
  TC: 'Ciclone tropicale',
  FL: 'Alluvione',
  VO: 'Vulcano',
  WF: 'Incendio',
  DR: 'Siccità',
  TS: 'Tsunami',
};

export const GDACS_LEVEL_COLOR: Record<string, string> = {
  Green: '#4ade80',
  Orange: '#fb923c',
  Red: '#ef4444',
};

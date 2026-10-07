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
export type WorldLayer = 'quakes' | 'flights' | 'alerts' | 'satellites';

export const LAYER_META: Record<WorldLayer, { label: string; color: string }> = {
  quakes: { label: 'Terremoti', color: '#fb923c' },
  flights: { label: 'Voli', color: '#38bdf8' },
  alerts: { label: 'Allerte', color: '#f472b6' },
  satellites: { label: 'Satelliti', color: '#a78bfa' },
};

/** Marker colour ramp by magnitude (M2.5 yellow → M6+ red). */
export function quakeColor(mag: number): string {
  if (mag >= 6) return '#ef4444';
  if (mag >= 5) return '#f97316';
  if (mag >= 4) return '#fb923c';
  if (mag >= 3) return '#fbbf24';
  return '#fde68a';
}

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

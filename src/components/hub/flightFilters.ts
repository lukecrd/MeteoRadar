import type { Flight } from '../../services/hubApi';

export type AltBand = 'low' | 'climb' | 'mid' | 'cruise';

/** Same bands (and colours) as flightColor(). */
export const ALT_BANDS: { id: AltBand; label: string; hint: string; color: string; max: number }[] = [
  { id: 'low', label: '< FL100', hint: 'Decollo e atterraggio', color: '#fbbf24', max: 10000 },
  { id: 'climb', label: 'FL100–250', hint: 'Salita e discesa', color: '#34d399', max: 25000 },
  { id: 'mid', label: 'FL250–350', hint: 'Crociera bassa', color: '#38bdf8', max: 35000 },
  { id: 'cruise', label: '> FL350', hint: 'Crociera alta', color: '#c4b5fd', max: Infinity },
];

export const altBandOf = (altFt: number): AltBand => ALT_BANDS.find((b) => altFt < b.max)!.id;

/** What the globe shows: nothing, everything, the filtered set, or hand-picked flights. */
export type FlightShowMode = 'none' | 'all' | 'filtered' | 'pinned';

export const FLIGHT_SHOW_MODES: { id: FlightShowMode; label: string }[] = [
  { id: 'none', label: 'Nessuno' },
  { id: 'all', label: 'Tutti' },
  { id: 'filtered', label: 'Filtrati' },
  { id: 'pinned', label: 'Solo scelti' },
];

export interface FlightFilters {
  /** hub ids; empty = every zone */
  hubs: string[];
  /** altitude bands; empty = every altitude */
  bands: AltBand[];
  /** callsign / registration / type substring */
  query: string;
}

export const EMPTY_FILTERS: FlightFilters = { hubs: [], bands: [], query: '' };

export function matchesFilters(f: Flight, filters: FlightFilters): boolean {
  if (filters.hubs.length && !filters.hubs.includes(f.hub)) return false;
  if (filters.bands.length && !filters.bands.includes(altBandOf(f.alt))) return false;
  const q = filters.query.trim().toUpperCase();
  if (q && !f.cs.includes(q) && !f.reg?.toUpperCase().includes(q) && !f.type?.toUpperCase().includes(q)) return false;
  return true;
}

export const toggleIn = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

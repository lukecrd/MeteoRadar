import { useEffect, useMemo, useState } from 'react';
import { eciToGeodetic, degreesLat, degreesLong, gstime, propagate, twoline2satrec, SatRec } from 'satellite.js';
import { SatelliteGroup, SatellitesResponse, WORLD_ENDPOINTS } from '../services/worldEventsApi';
import { usePolledJson } from './usePolledJson';

export interface SatelliteState {
  norad: number;
  name: string;
  lat: number;
  lon: number;
  altKm: number;
  speedKms: number;
}

export interface TrackSample {
  lat: number;
  lon: number;
  altKm: number;
}

interface SatEntry {
  norad: number;
  name: string;
  satrec: SatRec;
}

const PROPAGATE_MS = 1000;
// TLEs only change a few times a day; the server caches them for ≥2 h anyway.
const TLE_REFRESH_MS = 30 * 60_000;

function geodeticAt(satrec: SatRec, date: Date, gmst: number) {
  const pv = propagate(satrec, date);
  if (!pv || !pv.position || typeof pv.position === 'boolean') return null;
  const geo = eciToGeodetic(pv.position, gmst);
  const v = pv.velocity;
  return {
    lat: degreesLat(geo.latitude),
    lon: degreesLong(geo.longitude),
    altKm: geo.height,
    speedKms: v ? Math.hypot(v.x, v.y, v.z) : 0,
  };
}

/**
 * Loads a CelesTrak group's TLEs and propagates every satellite with SGP4
 * (satellite.js) once a second while `enabled`.
 */
export function useSatellites(group: SatelliteGroup, enabled: boolean) {
  const feed = usePolledJson<SatellitesResponse>(WORLD_ENDPOINTS.satellites(group), TLE_REFRESH_MS, enabled);

  const entries = useMemo<SatEntry[]>(() => {
    const out: SatEntry[] = [];
    for (const t of feed.data?.group === group ? feed.data.items : []) {
      try {
        const satrec = twoline2satrec(t.line1, t.line2);
        if (!satrec.error) out.push({ norad: t.norad, name: t.name, satrec });
      } catch {
        // malformed TLE: skip
      }
    }
    return out;
  }, [feed.data, group]);

  const [states, setStates] = useState<SatelliteState[]>([]);

  useEffect(() => {
    if (!enabled || entries.length === 0) {
      setStates([]);
      return;
    }
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      const now = new Date();
      const gmst = gstime(now);
      const next: SatelliteState[] = [];
      for (const e of entries) {
        const g = geodeticAt(e.satrec, now, gmst);
        // Drop decayed / diverged solutions.
        if (!g || !Number.isFinite(g.lat) || !Number.isFinite(g.altKm) || g.altKm < 80 || g.altKm > 60_000) continue;
        next.push({ norad: e.norad, name: e.name, ...g });
      }
      setStates(next);
    };
    tick();
    const id = setInterval(tick, PROPAGATE_MS);
    return () => clearInterval(id);
  }, [entries, enabled]);

  const satrecByNorad = useMemo(() => new Map(entries.map((e) => [e.norad, e.satrec])), [entries]);

  return { feed, states, satrecByNorad };
}

/** One orbital period of positions (in Earth-fixed lat/lon/alt) from now. */
export function orbitTrack(satrec: SatRec, from = new Date(), steps = 160): TrackSample[] {
  const periodMin = (2 * Math.PI) / satrec.no; // satrec.no is rad/min
  const out: TrackSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = new Date(from.getTime() + (i / steps) * periodMin * 60_000);
    const g = geodeticAt(satrec, t, gstime(t));
    if (g && Number.isFinite(g.lat)) out.push({ lat: g.lat, lon: g.lon, altKm: g.altKm });
  }
  return out;
}

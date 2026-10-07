import { useEffect, useRef, useState } from 'react';
import { FlightDetail, FlightInfoResponse, FlightLiveResponse, WORLD_ENDPOINTS } from '../services/worldEventsApi';
import { describeFetchError } from './usePolledJson';

export interface LatLon {
  lat: number;
  lon: number;
}

export type TrackerStatus = 'idle' | 'loading' | 'live' | 'estimated' | 'lost';

const D2R = Math.PI / 180;
const EARTH_KM = 6371;
const LIVE_POLL_MS = 12_000; // server caches 8 s; adsb.lol, no OpenSky credits
const LOST_AFTER_MS = 5 * 60_000;
const MAX_DEAD_RECKON_S = 120;
const TRAIL_MAX = 240;

/** Point reached from `p` after `distKm` along initial bearing `bearingDeg`. */
export function destinationPoint(p: LatLon, bearingDeg: number, distKm: number): LatLon {
  const d = distKm / EARTH_KM;
  const b = bearingDeg * D2R;
  const la1 = p.lat * D2R;
  const lo1 = p.lon * D2R;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
  const lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return { lat: la2 / D2R, lon: ((lo2 / D2R + 540) % 360) - 180 };
}

/** Great-circle polyline between two points (spherical linear interpolation). */
export function greatCircle(a: LatLon, b: LatLon, steps = 64): LatLon[] {
  const toV = (p: LatLon) => [Math.cos(p.lat * D2R) * Math.cos(p.lon * D2R), Math.cos(p.lat * D2R) * Math.sin(p.lon * D2R), Math.sin(p.lat * D2R)];
  const va = toV(a);
  const vb = toV(b);
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-6) return [a, b];
  const out: LatLon[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const k1 = Math.sin((1 - t) * omega) / Math.sin(omega);
    const k2 = Math.sin(t * omega) / Math.sin(omega);
    const x = k1 * va[0] + k2 * vb[0];
    const y = k1 * va[1] + k2 * vb[1];
    const z = k1 * va[2] + k2 * vb[2];
    out.push({ lat: Math.atan2(z, Math.hypot(x, y)) / D2R, lon: Math.atan2(y, x) / D2R });
  }
  return out;
}

/** Dead-reckoned position from the last fix (straight line along track). */
function predict(f: FlightDetail, now: number): LatLon {
  if (f.onGround || !f.speedMs || f.trackDeg == null) return { lat: f.lat, lon: f.lon };
  const dt = Math.min(MAX_DEAD_RECKON_S, Math.max(0, (now - f.positionTime) / 1000));
  return destinationPoint(f, f.trackDeg, (f.speedMs * dt) / 1000);
}

/**
 * Live tracking of one aircraft: polls /api/flights/live while selected,
 * loads route/aircraft enrichment once per callsign, dead-reckons the
 * position every second between fixes and records a trail.
 */
export function useFlightTracker(icao24: string | null, seed: FlightDetail | null) {
  const [flight, setFlight] = useState<FlightDetail | null>(seed);
  const [position, setPosition] = useState<LatLon | null>(seed ? { lat: seed.lat, lon: seed.lon } : null);
  const [status, setStatus] = useState<TrackerStatus>(icao24 ? 'loading' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<FlightInfoResponse | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [trail, setTrail] = useState<LatLon[]>([]);
  const flightRef = useRef<FlightDetail | null>(seed);

  // Reset on a new aircraft.
  useEffect(() => {
    flightRef.current = seed;
    setFlight(seed);
    setPosition(seed ? { lat: seed.lat, lon: seed.lon } : null);
    setStatus(icao24 ? 'loading' : 'idle');
    setError(null);
    setInfo(null);
    setTrail(seed ? [{ lat: seed.lat, lon: seed.lon }] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icao24]);

  // Live polling.
  useEffect(() => {
    if (!icao24) return;
    let cancelled = false;
    const ctrl = new AbortController();
    const load = async () => {
      try {
        const res = await fetch(WORLD_ENDPOINTS.flightLive(icao24), { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as FlightLiveResponse;
        if (cancelled) return;
        setError(data.error);
        if (data.found && data.flight) {
          const prev = flightRef.current;
          // Keep the OpenSky origin country when adsb.lol does not provide it.
          const merged = { ...data.flight, country: data.flight.country ?? prev?.country ?? null };
          flightRef.current = merged;
          setFlight(merged);
          const stale = Date.now() - merged.lastContact > LOST_AFTER_MS;
          setStatus(stale ? 'lost' : merged.source === 'adsb.lol' ? 'live' : 'estimated');
          setTrail((t) => [...t.slice(-TRAIL_MAX), { lat: merged.lat, lon: merged.lon }]);
        } else {
          setStatus('lost');
        }
      } catch (err: any) {
        if (cancelled || err?.name === 'AbortError') return;
        setError(describeFetchError(err));
        setStatus((s) => (s === 'loading' ? 'lost' : 'estimated'));
      }
    };
    load();
    const id = setInterval(() => document.visibilityState === 'visible' && load(), LIVE_POLL_MS);
    return () => {
      cancelled = true;
      ctrl.abort();
      clearInterval(id);
    };
  }, [icao24]);

  // Dead reckoning tick (1 s) + trail sampling.
  useEffect(() => {
    if (!icao24) return;
    let n = 0;
    const id = setInterval(() => {
      const f = flightRef.current;
      if (!f) return;
      const p = predict(f, Date.now());
      setPosition(p);
      if (++n % 5 === 0) setTrail((t) => [...t.slice(-TRAIL_MAX), p]);
    }, 1000);
    return () => clearInterval(id);
  }, [icao24]);

  // Enrichment (cached 12–24 h server-side).
  const callsign = flight?.callsign?.trim() || null;
  useEffect(() => {
    if (!icao24) return;
    let cancelled = false;
    setInfoLoading(true);
    fetch(WORLD_ENDPOINTS.flightInfo(callsign, icao24))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: FlightInfoResponse) => !cancelled && setInfo(d))
      .catch((err) => !cancelled && setInfo({ route: null, aircraft: null, error: describeFetchError(err) }))
      .finally(() => !cancelled && setInfoLoading(false));
    return () => {
      cancelled = true;
    };
  }, [icao24, callsign]);

  return { flight, position, status, error, info, infoLoading, trail };
}

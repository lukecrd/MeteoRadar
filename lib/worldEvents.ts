// Real-time world event feeds for the WorldHub globe, shared by the Express
// dev server (server.ts) and the Vercel functions (api/*.ts).
//
//  - Earthquakes: USGS GeoJSON summary feed (M2.5+, past day)
//  - Flights:     OpenSky Network /states/all (anonymous by default; optional
//                 OAuth client credentials via OPENSKY_CLIENT_ID/SECRET)
//  - Disasters:   GDACS event list (cyclones, floods, volcanoes, wildfires…)
//
// Every source is cached in memory for a short TTL and, when the upstream
// fails, the last good copy is served with `stale: true` plus the error, so a
// single broken source never blanks the globe.

const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = 'Mozilla/5.0 (WorldHub event globe)';

export interface Earthquake {
  id: string;
  mag: number;
  place: string;
  time: number; // epoch ms
  lat: number;
  lon: number;
  depthKm: number;
  url: string;
  tsunami: boolean;
}

export interface Flight {
  id: string; // icao24
  callsign: string;
  country: string;
  lat: number;
  lon: number;
  altitudeM: number | null;
  speedKmh: number | null;
  heading: number | null;
}

export type DisasterType = 'EQ' | 'TC' | 'FL' | 'VO' | 'WF' | 'DR' | string;

export interface Disaster {
  id: string;
  type: DisasterType;
  name: string;
  alertLevel: 'Green' | 'Orange' | 'Red' | string;
  country: string;
  from: number;
  to: number;
  lat: number;
  lon: number;
  url: string;
}

export interface FeedResponse<T> {
  items: T[];
  fetchedAt: number;
  stale: boolean;
  error: string | null;
}

export interface FlightsResponse extends FeedResponse<Flight> {
  /** Airborne aircraft reported worldwide (before sampling). */
  totalAirborne: number;
  topCountries: { country: string; count: number }[];
}

interface CacheEntry<R> {
  at: number;
  value: R;
}

async function fetchJson(url: string, init: RequestInit = {}): Promise<{ json: any; res: Response }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...(init.headers || {}) },
    });
    if (!res.ok) {
      const err: any = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.retryAfter = Number(res.headers.get('x-rate-limit-retry-after-seconds') || res.headers.get('retry-after') || 0);
      throw err;
    }
    return { json: await res.json(), res };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wraps a loader with a TTL cache, request de-duplication and a
 * serve-stale-on-error fallback. `blockedUntil` lets a loader back off after
 * a rate-limit response without hammering the upstream.
 */
function cachedFeed<R extends { fetchedAt: number; stale: boolean; error: string | null }>(
  ttlMs: number,
  load: () => Promise<R>,
  empty: () => R
) {
  let cache: CacheEntry<R> | null = null;
  let inflight: Promise<R> | null = null;
  let blockedUntil = 0;

  return async function get(): Promise<R> {
    const now = Date.now();
    if (cache && now - cache.at < ttlMs) return cache.value;
    if (now < blockedUntil) {
      const msg = `Limite richieste raggiunto, nuovo tentativo tra ${Math.ceil((blockedUntil - now) / 1000)} s`;
      return cache ? { ...cache.value, stale: true, error: msg } : { ...empty(), error: msg };
    }
    if (inflight) return inflight;

    inflight = load()
      .then((value) => {
        cache = { at: Date.now(), value };
        return value;
      })
      .catch((err: any) => {
        if (err?.status === 429) {
          blockedUntil = Date.now() + Math.max(60, Math.min(err.retryAfter || 300, 3600)) * 1000;
        }
        const msg = err?.status === 429 ? 'Limite richieste del servizio raggiunto (HTTP 429)' : String(err?.message || err);
        return cache ? { ...cache.value, stale: true, error: msg } : { ...empty(), error: msg };
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  };
}

/* ---------------- Earthquakes (USGS) ---------------- */

const USGS_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

export const getEarthquakes = cachedFeed<FeedResponse<Earthquake>>(
  60_000,
  async () => {
    const { json } = await fetchJson(USGS_URL);
    const items: Earthquake[] = (json.features || [])
      .filter((f: any) => Array.isArray(f?.geometry?.coordinates) && typeof f?.properties?.mag === 'number')
      .map((f: any) => ({
        id: String(f.id),
        mag: Math.round(f.properties.mag * 10) / 10,
        place: String(f.properties.place || 'Località sconosciuta'),
        time: Number(f.properties.time),
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        depthKm: Math.round((f.geometry.coordinates[2] ?? 0) * 10) / 10,
        url: String(f.properties.url || ''),
        tsunami: f.properties.tsunami === 1,
      }))
      .sort((a: Earthquake, b: Earthquake) => b.time - a.time);
    return { items, fetchedAt: Date.now(), stale: false, error: null };
  },
  () => ({ items: [], fetchedAt: Date.now(), stale: true, error: null })
);

/* ---------------- Flights (OpenSky Network) ---------------- */

const OPENSKY_URL = 'https://opensky-network.org/api/states/all';
const OPENSKY_TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const MAX_FLIGHTS = 300;

let openSkyToken: { value: string; exp: number } | null = null;

/** Optional OAuth2 client-credentials token (higher rate limits). */
async function getOpenSkyAuthHeader(): Promise<Record<string, string>> {
  const id = process.env.OPENSKY_CLIENT_ID;
  const secret = process.env.OPENSKY_CLIENT_SECRET;
  if (!id || !secret) return {};
  if (!openSkyToken || Date.now() > openSkyToken.exp) {
    const res = await fetch(OPENSKY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
    });
    if (!res.ok) return {};
    const tok = await res.json();
    openSkyToken = { value: tok.access_token, exp: Date.now() + Math.max(60, (tok.expires_in || 1800) - 60) * 1000 };
  }
  return { Authorization: `Bearer ${openSkyToken.value}` };
}

/**
 * Full (unsampled) state vectors of the last successful global snapshot.
 * Flight search and the follow fallback read from here, so they never cost
 * extra OpenSky credits on top of the shared 90 s snapshot.
 */
let lastFlightStates: { at: number; states: any[] } | null = null;

export async function getFlightSnapshot(): Promise<{ at: number; states: any[]; stale: boolean; error: string | null }> {
  const res = await getFlights();
  return { at: lastFlightStates?.at ?? res.fetchedAt, states: lastFlightStates?.states ?? [], stale: res.stale, error: res.error };
}

export const getFlights = cachedFeed<FlightsResponse>(
  // Anonymous OpenSky quota is small (a global snapshot costs several
  // credits), so the snapshot is shared by all clients for 90 s.
  90_000,
  async () => {
    const { json } = await fetchJson(OPENSKY_URL, { headers: await getOpenSkyAuthHeader() });
    const states: any[] = Array.isArray(json.states) ? json.states : [];
    lastFlightStates = { at: Date.now(), states };
    // state vector: [0]icao24 [1]callsign [2]country [5]lon [6]lat [7]baroAlt [8]onGround [9]velocity m/s [10]track
    const airborne = states.filter((s) => s[5] != null && s[6] != null && s[8] === false);

    const byCountry = new Map<string, number>();
    for (const s of airborne) byCountry.set(s[2], (byCountry.get(s[2]) || 0) + 1);
    const topCountries = [...byCountry.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([country, count]) => ({ country, count }));

    // Even stride sample keeps a representative global spread.
    const stride = Math.max(1, airborne.length / MAX_FLIGHTS);
    const items: Flight[] = [];
    for (let i = 0; i < airborne.length && items.length < MAX_FLIGHTS; i += stride) {
      const s = airborne[Math.floor(i)];
      items.push({
        id: String(s[0]),
        callsign: String(s[1] || '').trim() || String(s[0]).toUpperCase(),
        country: String(s[2] || ''),
        lon: s[5],
        lat: s[6],
        altitudeM: s[7] != null ? Math.round(s[7]) : null,
        speedKmh: s[9] != null ? Math.round(s[9] * 3.6) : null,
        heading: s[10] != null ? Math.round(s[10]) : null,
      });
    }
    return { items, totalAirborne: airborne.length, topCountries, fetchedAt: Date.now(), stale: false, error: null };
  },
  () => ({ items: [], totalAirborne: 0, topCountries: [], fetchedAt: Date.now(), stale: true, error: null })
);

/* ---------------- Global disasters (GDACS) ---------------- */

const GDACS_URL = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP';

export const getDisasters = cachedFeed<FeedResponse<Disaster>>(
  5 * 60_000,
  async () => {
    const { json } = await fetchJson(GDACS_URL);
    const items: Disaster[] = (json.features || [])
      .filter((f: any) => f?.geometry?.type === 'Point' && Array.isArray(f.geometry.coordinates))
      .map((f: any) => {
        const p = f.properties || {};
        return {
          id: `${p.eventtype}-${p.eventid}-${p.episodeid ?? 0}`,
          type: String(p.eventtype || ''),
          name: String(p.name || p.description || p.eventname || 'Evento'),
          alertLevel: String(p.alertlevel || 'Green'),
          country: String(p.country || ''),
          from: parseUtc(p.fromdate),
          to: parseUtc(p.todate),
          lon: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
          url: String(p.url?.report || ''),
        };
      })
      .sort((a: Disaster, b: Disaster) => alertRank(b.alertLevel) - alertRank(a.alertLevel) || b.to - a.to);
    return { items, fetchedAt: Date.now(), stale: false, error: null };
  },
  () => ({ items: [], fetchedAt: Date.now(), stale: true, error: null })
);

/** GDACS timestamps are UTC but carry no zone suffix. */
function parseUtc(value: unknown): number {
  if (typeof value !== 'string' || !value) return 0;
  return Date.parse(/(?:[zZ]|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value}Z`) || 0;
}

function alertRank(level: string): number {
  return level === 'Red' ? 3 : level === 'Orange' ? 2 : 1;
}

/* ---------------- Satellites (CelesTrak GP / TLE) ---------------- */

export const SATELLITE_GROUPS = ['stations', 'visual', 'weather', 'gps-ops', 'starlink', 'active'] as const;
export type SatelliteGroup = (typeof SATELLITE_GROUPS)[number];

export function isSatelliteGroup(value: unknown): value is SatelliteGroup {
  return typeof value === 'string' && (SATELLITE_GROUPS as readonly string[]).includes(value);
}

export interface SatelliteTle {
  name: string;
  norad: number;
  line1: string;
  line2: string;
}

export interface SatellitesResponse extends FeedResponse<SatelliteTle> {
  group: SatelliteGroup;
  /** Objects in the CelesTrak group before the render cap. */
  total: number;
}

// CelesTrak updates GP data a few times a day and asks clients not to
// re-download a group more often than every 2 hours, so TLE sets are cached
// for 3 h in memory and mirrored to the OS temp dir (survives dev restarts;
// /tmp on Vercel) — a restart never re-hits CelesTrak needlessly.
const SAT_TTL_MS = 3 * 60 * 60_000;
const MAX_SATELLITES = 1500;
const ISS_NORAD = 25544;

function parseTle(text: string): SatelliteTle[] {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
  const out: SatelliteTle[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const [name, l1, l2] = [lines[i], lines[i + 1], lines[i + 2]];
    if (!l1.startsWith('1 ') || !l2.startsWith('2 ')) {
      i -= 2; // resync on malformed blocks
      continue;
    }
    out.push({ name: name.trim(), norad: Number(l1.slice(2, 7)), line1: l1, line2: l2 });
  }
  return out;
}

async function tleCacheFile(group: SatelliteGroup): Promise<string> {
  const [os, path] = await Promise.all([import('os'), import('path')]);
  return path.join(os.tmpdir(), `worldhub-tle-${group}.json`);
}

async function readTleDisk(group: SatelliteGroup): Promise<{ at: number; items: SatelliteTle[] } | null> {
  try {
    const fs = await import('fs/promises');
    const data = JSON.parse(await fs.readFile(await tleCacheFile(group), 'utf8'));
    return Array.isArray(data?.items) && typeof data.at === 'number' ? data : null;
  } catch {
    return null;
  }
}

async function writeTleDisk(group: SatelliteGroup, entry: { at: number; items: SatelliteTle[] }) {
  try {
    const fs = await import('fs/promises');
    await fs.writeFile(await tleCacheFile(group), JSON.stringify(entry));
  } catch {
    // read-only filesystem: memory cache only
  }
}

const satCache = new Map<SatelliteGroup, { at: number; items: SatelliteTle[] }>();
const satInflight = new Map<SatelliteGroup, Promise<SatellitesResponse>>();

function capSatellites(group: SatelliteGroup, all: SatelliteTle[], at: number, stale: boolean, error: string | null): SatellitesResponse {
  let items = all;
  if (all.length > MAX_SATELLITES) {
    const stride = all.length / MAX_SATELLITES;
    items = [];
    for (let i = 0; i < all.length && items.length < MAX_SATELLITES; i += stride) items.push(all[Math.floor(i)]);
  }
  // Keep the ISS whenever the group has it.
  const iss = all.find((s) => s.norad === ISS_NORAD);
  if (iss && !items.includes(iss)) items = [iss, ...items.slice(0, MAX_SATELLITES - 1)];
  return { group, items, total: all.length, fetchedAt: at, stale, error };
}

export async function getSatellites(group: SatelliteGroup): Promise<SatellitesResponse> {
  let hit = satCache.get(group) ?? null;
  if (!hit) {
    hit = await readTleDisk(group);
    if (hit) satCache.set(group, hit);
  }
  if (hit && Date.now() - hit.at < SAT_TTL_MS) return capSatellites(group, hit.items, hit.at, false, null);

  const pending = satInflight.get(group);
  if (pending) return pending;

  const p = (async () => {
    try {
      const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=tle`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25_000);
      let text: string;
      try {
        const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': USER_AGENT } });
        if (!res.ok) throw new Error(`CelesTrak HTTP ${res.status}`);
        text = await res.text();
      } finally {
        clearTimeout(timer);
      }
      const items = parseTle(text);
      // CelesTrak answers throttled requests with a plain-text notice.
      if (items.length === 0) throw new Error(text.trim().slice(0, 160) || 'Risposta CelesTrak vuota');
      const entry = { at: Date.now(), items };
      satCache.set(group, entry);
      await writeTleDisk(group, entry);
      return capSatellites(group, items, entry.at, false, null);
    } catch (err: any) {
      const msg = String(err?.message || err);
      return hit ? capSatellites(group, hit.items, hit.at, true, msg) : capSatellites(group, [], Date.now(), true, msg);
    } finally {
      satInflight.delete(group);
    }
  })();
  satInflight.set(group, p);
  return p;
}

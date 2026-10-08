// Real-time world event feeds for the WorldHub globe, shared by the Express
// dev server (server.ts) and the Vercel functions (api/*.ts).
//
//  - Earthquakes: USGS + INGV, merged by lib/quakes.ts
//  - Flights:     OpenSky Network /states/all (anonymous by default; optional
//                 OAuth client credentials via OPENSKY_CLIENT_ID/SECRET), with
//                 adsb.lol hub sampling as fallback when OpenSky is unreachable
//  - Disasters:   GDACS event list (cyclones, floods, volcanoes, wildfires…)
//
// Every source is cached in memory for a short TTL and, when the upstream
// fails, the last good copy is served with `stale: true` plus the error, so a
// single broken source never blanks the globe.

import { getQuakes } from './quakes.js';

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
  source?: "USGS" | "INGV";
  /** USGS PAGER impact alert, when issued */
  alert?: "green" | "yellow" | "orange" | "red" | null;
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
  /** Upstream(s) that produced this snapshot; adsb.fi/adsb.lol = regional fallback. */
  source?: string;
  topCountries: { country: string; count: number }[];
}

interface CacheEntry<R> {
  at: number;
  value: R;
}

async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<{ json: any; res: Response }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
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

/* ---------------- Earthquakes (USGS + INGV) ---------------- */

// lib/quakes.ts merges USGS (M2.5+ / 24 h and M4.5+ / 7 days, worldwide)
// with INGV (M2+ / 7 days around Italy, Italian place names) and drops
// duplicates; here it is adapted to the globe feed shape.
export const getEarthquakes = cachedFeed<FeedResponse<Earthquake>>(
  60_000,
  async () => {
    const res = await getQuakes();
    if (res.quakes.length === 0 && res.errors.length) throw new Error(res.errors.join(" · "));
    const items: Earthquake[] = res.quakes.map((q) => ({
      id: q.id,
      mag: Math.round(q.mag * 10) / 10,
      place: q.place,
      time: q.time,
      lat: q.lat,
      lon: q.lon,
      depthKm: Math.round(q.depthKm * 10) / 10,
      url: q.url,
      tsunami: q.tsunami,
      source: q.source,
      alert: q.alert,
    }));
    return { items, fetchedAt: res.fetchedAt, stale: false, error: res.errors.length ? res.errors.join(" · ") : null };
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

/* ADS-B Exchange-style fallback. OpenSky refuses connections from most cloud
 * providers (Vercel runs on AWS), which surfaces as Node's bare "fetch
 * failed". adsb.fi and adsb.lol have no global endpoint, so the busiest
 * airspaces are sampled with point queries (max radius 250 NM) and converted
 * to OpenSky state vectors, keeping flight search and "Segui volo" working on
 * the same snapshot. adsb.fi sustains 1 req/s; adsb.lol only allows a short
 * burst, so it gets a slow lane and is dropped on its first 429 (its budget is
 * needed by "Segui volo"). */
const ADSB_HUBS: [number, number][] = [
  [45.5, 9.2], [41.8, 12.5], [50.0, 8.6], [51.5, -0.5], [48.9, 2.4], [40.4, -3.7],
  [48.2, 16.4], [41.0, 29.0], [25.2, 55.3], [28.6, 77.1], [1.35, 103.9], [35.6, 139.8],
  [40.7, -74.0], [41.9, -87.9], [33.6, -84.4], [32.9, -97.0], [34.0, -118.4], [-23.4, -46.5],
];
const ADSB_RADIUS_NM = 250;
const ADSB_LANES = [
  { name: 'adsb.fi', url: (lat: number, lon: number) => `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${ADSB_RADIUS_NM}`, gapMs: 1_100 },
  { name: 'adsb.lol', url: (lat: number, lon: number) => `https://api.adsb.lol/v2/point/${lat}/${lon}/${ADSB_RADIUS_NM}`, gapMs: 4_000 },
];
// Skip OpenSky for a while after it fails, so each refresh does not pay its timeout.
const OPENSKY_RETRY_MS = 10 * 60_000;
let openSkyDownUntil = 0;
let openSkyLastError = '';

// ICAO 24-bit address blocks → state of registry (OpenSky's origin_country).
const ICAO_BLOCKS: [number, number, string][] = [
  [0x008000, 0x00ffff, 'South Africa'], [0x010000, 0x017fff, 'Egypt'], [0x020000, 0x027fff, 'Morocco'],
  [0x040000, 0x040fff, 'Ethiopia'], [0x04c000, 0x04cfff, 'Kenya'], [0x064000, 0x064fff, 'Nigeria'],
  [0x06a000, 0x06a3ff, 'Qatar'], [0x0ac000, 0x0acfff, 'Colombia'], [0x0d0000, 0x0d7fff, 'Mexico'],
  [0x100000, 0x1fffff, 'Russia'], [0x300000, 0x33ffff, 'Italy'], [0x340000, 0x37ffff, 'Spain'],
  [0x380000, 0x3bffff, 'France'], [0x3c0000, 0x3fffff, 'Germany'], [0x400000, 0x43ffff, 'United Kingdom'],
  [0x440000, 0x447fff, 'Austria'], [0x448000, 0x44ffff, 'Belgium'], [0x458000, 0x45ffff, 'Denmark'],
  [0x460000, 0x467fff, 'Finland'], [0x468000, 0x46ffff, 'Greece'], [0x470000, 0x477fff, 'Hungary'],
  [0x478000, 0x47ffff, 'Norway'], [0x480000, 0x487fff, 'Netherlands'], [0x488000, 0x48ffff, 'Poland'],
  [0x490000, 0x497fff, 'Portugal'], [0x498000, 0x49ffff, 'Czech Republic'], [0x4a0000, 0x4a7fff, 'Romania'],
  [0x4a8000, 0x4affff, 'Sweden'], [0x4b0000, 0x4b7fff, 'Switzerland'], [0x4b8000, 0x4bffff, 'Turkey'],
  [0x4ca000, 0x4cafff, 'Ireland'], [0x4cc000, 0x4ccfff, 'Iceland'], [0x4d0000, 0x4d03ff, 'Luxembourg'],
  [0x4d2000, 0x4d23ff, 'Malta'], [0x508000, 0x50ffff, 'Ukraine'], [0x683000, 0x6833ff, 'Kazakhstan'],
  [0x710000, 0x717fff, 'Saudi Arabia'], [0x718000, 0x71ffff, 'Republic of Korea'], [0x730000, 0x737fff, 'Iran'],
  [0x738000, 0x73ffff, 'Israel'], [0x750000, 0x757fff, 'Malaysia'], [0x758000, 0x75ffff, 'Philippines'],
  [0x760000, 0x767fff, 'Pakistan'], [0x768000, 0x76ffff, 'Singapore'], [0x780000, 0x7bffff, 'China'],
  [0x7c0000, 0x7fffff, 'Australia'], [0x800000, 0x83ffff, 'India'], [0x840000, 0x87ffff, 'Japan'],
  [0x880000, 0x887fff, 'Thailand'], [0x888000, 0x88ffff, 'Viet Nam'], [0x896000, 0x896fff, 'United Arab Emirates'],
  [0x899000, 0x8993ff, 'Taiwan'], [0x8a0000, 0x8affff, 'Indonesia'], [0xa00000, 0xafffff, 'United States'],
  [0xc00000, 0xc3ffff, 'Canada'], [0xc80000, 0xc87fff, 'New Zealand'], [0xe00000, 0xe3ffff, 'Argentina'],
  [0xe40000, 0xe7ffff, 'Brazil'], [0xe80000, 0xe80fff, 'Chile'],
];

function countryFromIcao(hex: string): string {
  const n = parseInt(hex, 16);
  if (!Number.isFinite(n)) return '';
  for (const [lo, hi, country] of ICAO_BLOCKS) if (n >= lo && n <= hi) return country;
  return '';
}

/** readsb-style aircraft (adsb.fi / adsb.lol) → OpenSky state vector (see lib/flightTracker.ts). */
function adsbToState(ac: any, nowSec: number): any[] | null {
  if (typeof ac?.lat !== 'number' || typeof ac?.lon !== 'number') return null;
  const hex = String(ac.hex || '').replace(/^~/, '').toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(hex)) return null; // skip TIS-B/non-ICAO tracks
  const onGround = ac.alt_baro === 'ground';
  const rate = typeof ac.baro_rate === 'number' ? ac.baro_rate : typeof ac.geom_rate === 'number' ? ac.geom_rate : null;
  return [
    hex,
    String(ac.flight || ''),
    countryFromIcao(hex),
    Math.round(nowSec - (ac.seen_pos ?? ac.seen ?? 0)),
    Math.round(nowSec - (ac.seen ?? 0)),
    ac.lon,
    ac.lat,
    typeof ac.alt_baro === 'number' ? ac.alt_baro * 0.3048 : onGround ? 0 : null,
    onGround,
    typeof ac.gs === 'number' ? ac.gs * 0.514444 : null,
    typeof ac.track === 'number' ? ac.track : typeof ac.true_heading === 'number' ? ac.true_heading : null,
    rate != null ? (rate * 0.3048) / 60 : null,
    null,
    typeof ac.alt_geom === 'number' ? ac.alt_geom * 0.3048 : null,
    ac.squawk ? String(ac.squawk) : null,
  ];
}

async function fetchAdsbStates(): Promise<{ states: any[]; source: string }> {
  const byHex = new Map<string, any[]>();
  const used = new Set<string>();
  const errors: string[] = [];
  const queue = [...ADSB_HUBS];
  const lane = async ({ name, url, gapMs }: (typeof ADSB_LANES)[number]) => {
    for (let hub = queue.shift(); hub; hub = queue.shift()) {
      const started = Date.now();
      try {
        const { json } = await fetchJson(url(hub[0], hub[1]), {}, 8_000);
        const now = typeof json.now === 'number' ? json.now : Date.now();
        const nowSec = now > 1e12 ? now / 1000 : now;
        for (const ac of json.ac ?? json.aircraft ?? []) {
          const s = adsbToState(ac, nowSec);
          if (s && !byHex.has(s[0])) byHex.set(s[0], s);
        }
        used.add(name);
      } catch (err: any) {
        errors.push(`${name}: ${err?.name === 'AbortError' ? 'timeout' : err?.message || err}`);
        if (err?.status === 429 || err?.status === 403) {
          queue.unshift(hub); // leave the hub to the other lane
          return;
        }
      }
      if (queue.length) await new Promise((r) => setTimeout(r, Math.max(0, gapMs - (Date.now() - started))));
    }
  };
  await Promise.all(ADSB_LANES.map(lane));
  if (byHex.size === 0) throw new Error(errors.slice(-2).join(' · ') || 'nessun dato ADS-B');
  return { states: [...byHex.values()], source: [...used].join(' + ') };
}

export const getFlights = cachedFeed<FlightsResponse>(
  // Anonymous OpenSky quota is small (a global snapshot costs several
  // credits), so the snapshot is shared by all clients for 90 s.
  90_000,
  async () => {
    let states: any[] = [];
    let source = 'OpenSky Network';
    if (Date.now() >= openSkyDownUntil) {
      try {
        const { json } = await fetchJson(OPENSKY_URL, { headers: await getOpenSkyAuthHeader() }, 8_000);
        states = Array.isArray(json.states) ? json.states : [];
        if (states.length === 0) throw new Error('snapshot vuoto');
      } catch (err: any) {
        openSkyDownUntil = Date.now() + OPENSKY_RETRY_MS;
        openSkyLastError = err?.status === 429 ? 'limite richieste (HTTP 429)' : err?.name === 'AbortError' ? 'timeout' : String(err?.message || err);
        states = [];
      }
    }
    if (states.length === 0) {
      try {
        ({ states, source } = await fetchAdsbStates());
      } catch (fallbackErr: any) {
        throw new Error(`OpenSky: ${openSkyLastError} · ${fallbackErr?.message || fallbackErr}`);
      }
    }
    lastFlightStates = { at: Date.now(), states };
    // state vector: [0]icao24 [1]callsign [2]country [5]lon [6]lat [7]baroAlt [8]onGround [9]velocity m/s [10]track
    const airborne = states.filter((s) => s[5] != null && s[6] != null && s[8] === false);

    const byCountry = new Map<string, number>();
    for (const s of airborne) if (s[2]) byCountry.set(s[2], (byCountry.get(s[2]) || 0) + 1);
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
    return { items, totalAirborne: airborne.length, topCountries, source, fetchedAt: Date.now(), stale: false, error: null };
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

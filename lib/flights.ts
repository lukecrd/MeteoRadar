// Live air traffic for the Global Hub globe.
// - Positions: the adsb.lol and adsb.fi community ADS-B networks (no key).
//   Both only answer "aircraft within 250 nm of a point" and allow about one
//   request per second, so we sample the airspace around a set of major hubs,
//   split between the two providers and paced per provider.
// - Route + aircraft details for one flight: adsbdb.com (no key), on demand.
// Shared by the Express server (server.ts) and the Vercel functions.

export interface FlightHub {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface Flight {
  hex: string; // ICAO 24-bit address
  cs: string; // callsign
  lat: number;
  lon: number;
  alt: number; // barometric altitude, ft
  gs: number | null; // ground speed, kt
  trk: number | null; // track, degrees
  vr: number | null; // vertical rate, ft/min
  type: string | null; // ICAO type designator, e.g. A320
  reg: string | null;
  sqk: string | null;
  hub: string;
}

export interface HubFlightsResponse {
  hub: string;
  flights: Flight[];
  /** aircraft seen in the area before thinning to MAX_PER_HUB */
  total: number;
  source: string | null;
  fetchedAt: number;
  error: string | null;
}

export interface Airport {
  name: string;
  city: string;
  country: string;
  iata: string | null;
  icao: string;
  lat: number;
  lon: number;
}

export interface FlightInfo {
  callsign: string;
  airline: { name: string; iata: string | null; icao: string; country: string } | null;
  origin: Airport | null;
  destination: Airport | null;
  aircraft: {
    type: string;
    icaoType: string;
    manufacturer: string;
    registration: string;
    owner: string;
    ownerCountry: string;
    photo: string | null;
  } | null;
}

export const FLIGHT_HUBS: FlightHub[] = [
  { id: 'mxp', name: 'Milano', lat: 45.63, lon: 8.72 },
  { id: 'fco', name: 'Roma', lat: 41.8, lon: 12.25 },
  { id: 'lhr', name: 'Londra', lat: 51.47, lon: -0.45 },
  { id: 'fra', name: 'Francoforte', lat: 50.03, lon: 8.57 },
  { id: 'ist', name: 'Istanbul', lat: 41.26, lon: 28.74 },
  { id: 'dxb', name: 'Dubai', lat: 25.25, lon: 55.36 },
  { id: 'sin', name: 'Singapore', lat: 1.36, lon: 103.99 },
  { id: 'hnd', name: 'Tokyo', lat: 35.55, lon: 139.78 },
  { id: 'syd', name: 'Sydney', lat: -33.95, lon: 151.18 },
  { id: 'jfk', name: 'New York', lat: 40.64, lon: -73.78 },
  { id: 'lax', name: 'Los Angeles', lat: 33.94, lon: -118.41 },
  { id: 'gru', name: 'San Paolo', lat: -23.43, lon: -46.47 },
];

export const isHubId = (v: unknown): v is string => typeof v === 'string' && FLIGHT_HUBS.some((h) => h.id === v);

const RADIUS_NM = 250;
export const FLIGHT_RADIUS_KM = Math.round(RADIUS_NM * 1.852);

interface Provider {
  name: string;
  /** minimum spacing between two requests to this provider */
  gapMs: number;
  url: (h: FlightHub) => string;
  list: string;
}

/** Same readsb JSON on both; only the list key differs. */
const PROVIDERS: Provider[] = [
  { name: 'adsb.fi', gapMs: 1100, url: (h) => `https://opendata.adsb.fi/api/v2/lat/${h.lat}/lon/${h.lon}/dist/${RADIUS_NM}`, list: 'aircraft' },
  { name: 'adsb.lol', gapMs: 1600, url: (h) => `https://api.adsb.lol/v2/lat/${h.lat}/lon/${h.lon}/dist/${RADIUS_NM}`, list: 'ac' },
];

const MAX_PER_HUB = 120;
const CACHE_TTL_MS = 60 * 1000;
const INFO_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const UA = { 'User-Agent': 'Mozilla/5.0 (MeteoRadar Global Hub)' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** a request never waits longer than this for a provider slot; it tries the other provider instead */
const MAX_QUEUE_WAIT_MS = 3000;
/** pause for a provider that answered "too many requests" */
const RATE_LIMIT_COOLDOWN_MS = 30 * 1000;

const hubCache = new Map<string, HubFlightsResponse>();
const hubInflight = new Map<string, Promise<HubFlightsResponse>>();
const nextSlot = new Map<string, number>();
const infoCache = new Map<string, { at: number; info: FlightInfo }>();

class RateLimited extends Error {}
class ProviderBusy extends Error {}

/**
 * Spaces calls per provider so this instance stays under its rate limit.
 * Refuses (instead of queueing for ever) when the wait would be too long.
 */
async function paced<T>(p: Provider, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const at = Math.max(now, nextSlot.get(p.name) ?? 0);
  if (at - now > MAX_QUEUE_WAIT_MS) throw new ProviderBusy('occupato');
  nextSlot.set(p.name, at + p.gapMs);
  if (at > now) await sleep(at - now);
  try {
    return await fn();
  } catch (err) {
    if (err instanceof RateLimited) nextSlot.set(p.name, Date.now() + RATE_LIMIT_COOLDOWN_MS);
    throw err;
  }
}

async function getJson(url: string): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: UA });
    if (res.status === 404) return null;
    if (res.status === 429 || res.status === 420) throw new RateLimited(`HTTP ${res.status}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

async function loadHub(hub: FlightHub, provider: Provider): Promise<{ flights: Flight[]; total: number }> {
  const json = await paced(provider, () => getJson(provider.url(hub)));
  const out: Flight[] = [];
  for (const a of json?.[provider.list] ?? []) {
    const cs = typeof a.flight === 'string' ? a.flight.trim() : '';
    // Airborne, positioned, identified traffic only (skips ground vehicles and gliders without callsign).
    if (typeof a.alt_baro !== 'number' || a.alt_baro < 500 || num(a.lat) === null || num(a.lon) === null || !cs) continue;
    out.push({
      hex: String(a.hex).toLowerCase(),
      cs,
      lat: Math.round(a.lat * 1e4) / 1e4,
      lon: Math.round(a.lon * 1e4) / 1e4,
      alt: a.alt_baro,
      gs: num(a.gs),
      trk: num(a.track) ?? num(a.true_heading),
      vr: num(a.baro_rate) ?? num(a.geom_rate),
      type: a.t ?? null,
      reg: a.r ?? null,
      sqk: a.squawk ?? null,
      hub: hub.id,
    });
  }
  const total = out.length;
  if (total <= MAX_PER_HUB) return { flights: out, total };
  // Thin evenly so every part of the hub's airspace stays represented.
  const step = total / MAX_PER_HUB;
  return { flights: Array.from({ length: MAX_PER_HUB }, (_, i) => out[Math.floor(i * step)]), total };
}

async function loadHubWithFallback(hub: FlightHub): Promise<HubFlightsResponse> {
  const errors: string[] = [];
  // Alternate the preferred provider by hub so two hubs can load in parallel;
  // the other provider is the fallback.
  const first = FLIGHT_HUBS.indexOf(hub) % PROVIDERS.length;
  const order = [...PROVIDERS.slice(first), ...PROVIDERS.slice(0, first)];
  for (const provider of order) {
    try {
      const { flights, total } = await loadHub(hub, provider);
      return { hub: hub.id, flights, total, source: provider.name, fetchedAt: Date.now(), error: null };
    } catch (err: any) {
      errors.push(`${provider.name}: ${err?.name === 'AbortError' ? 'timeout' : err?.message || err}`);
    }
  }
  // Both providers failed: serve the last good picture rather than an empty sky.
  const prev = hubCache.get(hub.id);
  return prev
    ? { ...prev, error: errors.join(' · ') }
    : { hub: hub.id, flights: [], total: 0, source: null, fetchedAt: Date.now(), error: errors.join(' · ') };
}

/**
 * Live traffic around one hub, cached 60 s per hub. An expired picture is
 * returned immediately while a refresh runs in the background, so only the
 * very first request for a hub ever waits on the upstream network.
 */
export async function getHubFlights(hubId: string): Promise<HubFlightsResponse> {
  const hub = FLIGHT_HUBS.find((h) => h.id === hubId);
  if (!hub) throw new Error(`hub sconosciuto: ${hubId}`);
  const hit = hubCache.get(hub.id);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit;

  let pending = hubInflight.get(hub.id);
  if (!pending) {
    pending = loadHubWithFallback(hub)
      .then((data) => {
        if (!data.error) hubCache.set(hub.id, data);
        return data;
      })
      .finally(() => hubInflight.delete(hub.id));
    hubInflight.set(hub.id, pending);
  }
  return hit ?? pending;
}

// ---------- Single-flight details ----------

export const isCallsign = (v: unknown): v is string => typeof v === 'string' && /^[A-Z0-9]{2,8}$/i.test(v);
export const isHex = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{6}$/i.test(v);

function toAirport(a: any): Airport | null {
  if (!a || typeof a.latitude !== 'number' || typeof a.longitude !== 'number') return null;
  return {
    name: a.name ?? '',
    city: a.municipality ?? '',
    country: a.country_name ?? '',
    iata: a.iata_code || null,
    icao: a.icao_code ?? '',
    lat: a.latitude,
    lon: a.longitude,
  };
}

export async function getFlightInfo(callsign: string, hex: string | null): Promise<FlightInfo> {
  const cs = callsign.toUpperCase();
  const key = `${cs}|${hex ?? ''}`;
  const hit = infoCache.get(key);
  if (hit && Date.now() - hit.at < INFO_TTL_MS) return hit.info;

  const [routeRes, aircraftRes] = await Promise.allSettled([
    getJson(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(cs)}`),
    hex ? getJson(`https://api.adsbdb.com/v0/aircraft/${encodeURIComponent(hex.toLowerCase())}`) : Promise.resolve(null),
  ]);
  const route = routeRes.status === 'fulfilled' ? routeRes.value?.response?.flightroute : null;
  const ac = aircraftRes.status === 'fulfilled' ? aircraftRes.value?.response?.aircraft : null;
  if (routeRes.status === 'rejected' && aircraftRes.status === 'rejected') {
    throw new Error('servizio rotte non raggiungibile');
  }

  const info: FlightInfo = {
    callsign: cs,
    airline: route?.airline
      ? { name: route.airline.name, iata: route.airline.iata || null, icao: route.airline.icao, country: route.airline.country ?? '' }
      : null,
    origin: toAirport(route?.origin),
    destination: toAirport(route?.destination),
    aircraft: ac
      ? {
          type: ac.type ?? '',
          icaoType: ac.icao_type ?? '',
          manufacturer: ac.manufacturer ?? '',
          registration: ac.registration ?? '',
          owner: ac.registered_owner ?? '',
          ownerCountry: ac.registered_owner_country_name ?? '',
          photo: typeof ac.url_photo_thumbnail === 'string' && ac.url_photo_thumbnail.startsWith('https://') ? ac.url_photo_thumbnail : null,
        }
      : null,
  };
  if (infoCache.size > 2000) infoCache.clear();
  infoCache.set(key, { at: Date.now(), info });
  return info;
}

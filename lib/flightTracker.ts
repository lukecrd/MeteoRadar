// Single-flight features for the WorldHub globe: search by flight number,
// live state for "Segui volo" and route/aircraft enrichment.
//
//  - Search reads the full OpenSky snapshot already cached by getFlights()
//    (no extra OpenSky credits).
//  - Live tracking polls adsb.lol (free, keyless, ODbL community ADS-B
//    network) for one aircraft, falling back to the cached OpenSky snapshot —
//    following a flight therefore never spends OpenSky quota.
//  - Enrichment uses adsbdb (free, keyless): callsign → airline + route,
//    ICAO24 / registration → aircraft type, operator, photo.
import { IATA_TO_ICAO } from './airlineCodes';
import { getFlightSnapshot } from './worldEvents';

const USER_AGENT = 'Mozilla/5.0 (WorldHub flight tracker)';
const TIMEOUT_MS = 10_000;

export interface FlightDetail {
  icao24: string;
  callsign: string;
  country: string | null;
  lat: number;
  lon: number;
  baroAltM: number | null;
  geoAltM: number | null;
  onGround: boolean;
  speedMs: number | null;
  trackDeg: number | null;
  verticalRateMs: number | null;
  squawk: string | null;
  /** epoch ms of the last received message */
  lastContact: number;
  /** epoch ms of the position fix (used for dead reckoning) */
  positionTime: number;
  registration: string | null;
  aircraftType: string | null;
  source: 'adsb.lol' | 'opensky';
}

export interface FlightSearchResponse {
  query: string;
  /** Callsigns the query was resolved to (e.g. AZ610 → ITY610) */
  resolved: string[];
  results: FlightDetail[];
  snapshotAt: number;
  error: string | null;
}

export interface FlightLiveResponse {
  icao24: string;
  found: boolean;
  flight: FlightDetail | null;
  fetchedAt: number;
  error: string | null;
}

export interface AirportInfo {
  iata: string | null;
  icao: string | null;
  name: string;
  city: string | null;
  country: string | null;
  lat: number;
  lon: number;
}

export interface FlightInfoResponse {
  route: {
    callsignIata: string | null;
    airline: { name: string; iata: string | null; icao: string | null } | null;
    origin: AirportInfo | null;
    destination: AirportInfo | null;
  } | null;
  aircraft: {
    type: string | null;
    icaoType: string | null;
    manufacturer: string | null;
    registration: string | null;
    owner: string | null;
    country: string | null;
    photo: string | null;
    photoThumb: string | null;
  } | null;
  error: string | null;
}

async function getJson(url: string): Promise<{ status: number; json: any }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
    const json = res.headers.get('content-type')?.includes('json') ? await res.json().catch(() => null) : null;
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

/** Tiny TTL cache (per key) with in-flight de-duplication. */
function ttlCache<T>(ttlMs: number, maxEntries = 500) {
  const store = new Map<string, { at: number; value: T }>();
  const inflight = new Map<string, Promise<T>>();
  return async (key: string, load: () => Promise<T>): Promise<T> => {
    const hit = store.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value;
    const pending = inflight.get(key);
    if (pending) return pending;
    const p = load()
      .then((value) => {
        if (store.size >= maxEntries) store.delete(store.keys().next().value as string);
        store.set(key, { at: Date.now(), value });
        return value;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  };
}

/* ---------------- OpenSky state vector → FlightDetail ---------------- */
// [0]icao24 [1]callsign [2]country [3]time_position [4]last_contact [5]lon [6]lat
// [7]baro_alt [8]on_ground [9]velocity [10]true_track [11]vertical_rate
// [12]sensors [13]geo_alt [14]squawk
function fromOpenSky(s: any[]): FlightDetail {
  return {
    icao24: String(s[0]).toLowerCase(),
    callsign: String(s[1] || '').trim() || String(s[0]).toUpperCase(),
    country: s[2] ? String(s[2]) : null,
    lon: s[5],
    lat: s[6],
    baroAltM: s[7] ?? null,
    geoAltM: s[13] ?? null,
    onGround: s[8] === true,
    speedMs: s[9] ?? null,
    trackDeg: s[10] ?? null,
    verticalRateMs: s[11] ?? null,
    squawk: s[14] ? String(s[14]) : null,
    lastContact: (s[4] ?? s[3] ?? 0) * 1000,
    positionTime: (s[3] ?? s[4] ?? 0) * 1000,
    registration: null,
    aircraftType: null,
    source: 'opensky',
  };
}

const FT = 0.3048;
const KT = 0.514444;

function fromAdsbLol(ac: any, now: number, country: string | null): FlightDetail | null {
  if (typeof ac?.lat !== 'number' || typeof ac?.lon !== 'number') return null;
  const onGround = ac.alt_baro === 'ground';
  const seenPos = typeof ac.seen_pos === 'number' ? ac.seen_pos : ac.seen ?? 0;
  const rateFtMin = typeof ac.baro_rate === 'number' ? ac.baro_rate : typeof ac.geom_rate === 'number' ? ac.geom_rate : null;
  return {
    icao24: String(ac.hex || '').replace(/^~/, '').toLowerCase(),
    callsign: String(ac.flight || '').trim() || String(ac.hex || '').toUpperCase(),
    country,
    lat: ac.lat,
    lon: ac.lon,
    baroAltM: typeof ac.alt_baro === 'number' ? ac.alt_baro * FT : onGround ? 0 : null,
    geoAltM: typeof ac.alt_geom === 'number' ? ac.alt_geom * FT : null,
    onGround,
    speedMs: typeof ac.gs === 'number' ? ac.gs * KT : null,
    trackDeg: typeof ac.track === 'number' ? ac.track : typeof ac.true_heading === 'number' ? ac.true_heading : null,
    verticalRateMs: rateFtMin != null ? (rateFtMin * FT) / 60 : null,
    squawk: ac.squawk ? String(ac.squawk) : null,
    lastContact: now - (ac.seen ?? 0) * 1000,
    positionTime: now - seenPos * 1000,
    registration: ac.r ? String(ac.r) : null,
    aircraftType: ac.t ? String(ac.t) : null,
    source: 'adsb.lol',
  };
}

/* ---------------- Search ---------------- */

const normalize = (q: string) => q.toUpperCase().replace(/[\s\-_.]/g, '');

/** Candidate callsigns for a query: ICAO callsign as typed, IATA → ICAO. */
async function resolveCallsigns(q: string): Promise<string[]> {
  const out = new Set<string>([q]);
  const iata = q.match(/^([A-Z0-9]{2})(\d{1,4})([A-Z]{0,2})$/);
  if (iata && /[A-Z]/.test(iata[1])) {
    const num = String(Number(iata[2])) + iata[3]; // callsigns drop leading zeros
    const icao = IATA_TO_ICAO[iata[1]];
    if (icao) out.add(`${icao}${num}`);
    // adsbdb also knows IATA designators whose ATC callsign differs from the
    // printed number (e.g. U2 42VZ → EZY42VZ) and airlines missing from the
    // table. Lookups are cached 12 h server-side, misses included.
    const info = await getRoute(q).catch(() => null);
    if (info?.callsignIcao) out.add(info.callsignIcao.toUpperCase());
  }
  const icao = q.match(/^([A-Z]{3})0*(\d{1,4}[A-Z]{0,2})$/);
  if (icao) out.add(`${icao[1]}${icao[2]}`);
  return [...out];
}

export async function searchFlights(rawQuery: string): Promise<FlightSearchResponse> {
  const query = normalize(rawQuery).slice(0, 12);
  const snap = await getFlightSnapshot();
  const base = { query, snapshotAt: snap.at };
  if (query.length < 2) return { ...base, resolved: [], results: [], error: 'Inserisci almeno 2 caratteri' };

  const resolved = await resolveCallsigns(query);
  const byCallsign = new Set(resolved);
  const exact: any[] = [];
  const partial: any[] = [];
  const isHex = /^[0-9A-F]{6}$/.test(query);

  for (const s of snap.states) {
    if (s[5] == null || s[6] == null) continue;
    const cs = String(s[1] || '').trim().toUpperCase();
    if (byCallsign.has(cs) || (isHex && String(s[0]).toUpperCase() === query)) exact.push(s);
    else if (query.length >= 3 && cs.startsWith(query)) partial.push(s);
  }

  let results = [...exact, ...partial].slice(0, 20).map(fromOpenSky);

  // Registration (e.g. EI-DCL): resolve to ICAO24 through adsbdb.
  if (results.length === 0 && !isHex && (/-/.test(rawQuery) || /^N\d/.test(query)) && /^[A-Z0-9]{3,8}$/.test(query)) {
    const ac = await getAircraft(rawQuery.trim().toUpperCase()).catch(() => null);
    const hex = ac?.modeS?.toLowerCase();
    if (hex) {
      const s = snap.states.find((x) => String(x[0]).toLowerCase() === hex);
      if (s) results = [fromOpenSky(s)];
      else {
        const live = await getFlightLive(hex).catch(() => null);
        if (live?.flight) results = [live.flight];
      }
    }
  }

  // Not in the (≤90 s old) snapshot: one direct adsb.lol callsign lookup.
  if (results.length === 0) {
    for (const cs of resolved.slice(1).concat(resolved[0]).slice(0, 2)) {
      const r = await getJson(`https://api.adsb.lol/v2/callsign/${encodeURIComponent(cs)}`).catch(() => null);
      const now = typeof r?.json?.now === 'number' ? r.json.now : Date.now();
      const found = (r?.json?.ac ?? []).map((ac: any) => fromAdsbLol(ac, now, null)).filter(Boolean) as FlightDetail[];
      if (found.length) {
        results = found.slice(0, 5);
        break;
      }
    }
  }

  return { ...base, resolved, results, error: snap.error && snap.states.length === 0 ? snap.error : null };
}

/* ---------------- Live single aircraft ---------------- */

const liveCache = ttlCache<FlightLiveResponse>(8_000, 200);

export function getFlightLive(icao24Raw: string): Promise<FlightLiveResponse> {
  const icao24 = icao24Raw.toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 6);
  return liveCache(icao24, async () => {
    const snap = await getFlightSnapshot().catch(() => null);
    const snapState = snap?.states.find((s) => String(s[0]).toLowerCase() === icao24);
    let error: string | null = null;
    try {
      const r = await getJson(`https://api.adsb.lol/v2/hex/${icao24}`);
      if (r.status === 429) error = 'adsb.lol: limite richieste (HTTP 429)';
      else if (r.status >= 400) error = `adsb.lol: HTTP ${r.status}`;
      const ac = r.json?.ac?.[0];
      const now = typeof r.json?.now === 'number' ? r.json.now : Date.now();
      const flight = ac ? fromAdsbLol(ac, now, snapState ? String(snapState[2] || '') || null : null) : null;
      if (flight) return { icao24, found: true, flight, fetchedAt: Date.now(), error: null };
    } catch (err: any) {
      error = `adsb.lol: ${err?.name === 'AbortError' ? 'timeout' : err?.message || err}`;
    }
    // Fallback: the shared OpenSky snapshot (up to ~90 s old).
    if (snapState && snapState[5] != null && snapState[6] != null) {
      return { icao24, found: true, flight: fromOpenSky(snapState), fetchedAt: Date.now(), error };
    }
    return { icao24, found: false, flight: null, fetchedAt: Date.now(), error };
  });
}

/* ---------------- Enrichment (adsbdb) ---------------- */

interface RouteLookup {
  callsignIcao: string | null;
  route: FlightInfoResponse['route'];
}
const routeCache = ttlCache<RouteLookup | null>(12 * 60 * 60_000);
const aircraftCache = ttlCache<(FlightInfoResponse['aircraft'] & { modeS: string | null }) | null>(24 * 60 * 60_000);

function airport(a: any): AirportInfo | null {
  if (!a || typeof a.latitude !== 'number') return null;
  return {
    iata: a.iata_code ?? null,
    icao: a.icao_code ?? null,
    name: String(a.name ?? ''),
    city: a.municipality ?? null,
    country: a.country_name ?? null,
    lat: a.latitude,
    lon: a.longitude,
  };
}

function getRoute(callsign: string): Promise<RouteLookup | null> {
  const key = normalize(callsign);
  return routeCache(key, async () => {
    const r = await getJson(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(key)}`);
    if (r.status === 404) return null; // unknown route: cache the miss too
    if (r.status >= 400) throw new Error(`adsbdb HTTP ${r.status}`);
    const fr = r.json?.response?.flightroute;
    if (!fr) return null;
    return {
      callsignIcao: fr.callsign_icao ?? null,
      route: {
        callsignIata: fr.callsign_iata ?? null,
        airline: fr.airline ? { name: String(fr.airline.name), iata: fr.airline.iata ?? null, icao: fr.airline.icao ?? null } : null,
        origin: airport(fr.origin),
        destination: airport(fr.destination),
      },
    };
  });
}

function getAircraft(idOrRegistration: string) {
  return aircraftCache(idOrRegistration.toUpperCase(), async () => {
    const r = await getJson(`https://api.adsbdb.com/v0/aircraft/${encodeURIComponent(idOrRegistration)}`);
    if (r.status === 404) return null;
    if (r.status >= 400) throw new Error(`adsbdb HTTP ${r.status}`);
    const a = r.json?.response?.aircraft;
    if (!a) return null;
    return {
      type: a.type ?? null,
      icaoType: a.icao_type ?? null,
      manufacturer: a.manufacturer ?? null,
      registration: a.registration ?? null,
      owner: a.registered_owner ?? null,
      country: a.registered_owner_country_name ?? null,
      photo: a.url_photo ?? null,
      photoThumb: a.url_photo_thumbnail ?? null,
      modeS: a.mode_s ?? null,
    };
  });
}

export async function getFlightInfo(callsign: string | null, icao24: string | null): Promise<FlightInfoResponse> {
  const errors: string[] = [];
  const [route, aircraft] = await Promise.all([
    callsign ? getRoute(callsign).catch((e) => (errors.push(String(e?.message || e)), null)) : null,
    icao24 ? getAircraft(icao24.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)).catch((e) => (errors.push(String(e?.message || e)), null)) : null,
  ]);
  const ac = aircraft ? (({ modeS: _m, ...rest }) => rest)(aircraft) : null;
  return { route: route?.route ?? null, aircraft: ac, error: errors.length ? errors.join(' · ') : null };
}

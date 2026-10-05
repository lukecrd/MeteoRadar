// Recent earthquakes for the Global Hub globe. Two public feeds, no API key:
// - USGS (worldwide): M2.5+ over 24 h and M4.5+ over 7 days
// - INGV (Italy and surroundings): M2+ over 7 days, with Italian place names
// The same quake often appears in both; INGV wins near Italy, USGS elsewhere.
// Shared by the Express server (server.ts) and the Vercel function.

export interface Quake {
  id: string;
  mag: number;
  magType: string;
  place: string;
  time: number; // epoch ms
  depthKm: number;
  lat: number;
  lon: number;
  url: string;
  source: 'USGS' | 'INGV';
  tsunami: boolean;
  /** USGS PAGER impact alert, when issued */
  alert: 'green' | 'yellow' | 'orange' | 'red' | null;
}

export interface QuakesResponse {
  quakes: Quake[];
  fetchedAt: number;
  errors: string[];
}

const USGS_FEEDS = [
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson',
];
const INGV_MIN_MAG = 2;
const CACHE_TTL_MS = 2 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

let cache: { at: number; data: QuakesResponse } | null = null;
let inflight: Promise<QuakesResponse> | null = null;

async function getJson(url: string): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (MeteoRadar Global Hub)' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// "191 km ESE of Sarangani, Philippines" → "191 km a ESE di Sarangani, Philippines"
const COMPASS_IT: Record<string, string> = { W: 'O', WNW: 'ONO', WSW: 'OSO', NW: 'NO', SW: 'SO', NNW: 'NNO', SSW: 'SSO' };
function italianPlace(place: string): string {
  const m = place.match(/^(\d+) km ([NSEW]{1,3}) of (.+)$/);
  if (!m) return place;
  return `${m[1]} km a ${COMPASS_IT[m[2]] ?? m[2]} di ${m[3]}`;
}

function fromUsgs(f: any): Quake | null {
  const p = f?.properties;
  const [lon, lat, depth] = f?.geometry?.coordinates ?? [];
  if (!p || typeof p.mag !== 'number' || typeof lat !== 'number' || p.type !== 'earthquake') return null;
  return {
    id: `usgs:${f.id}`,
    mag: p.mag,
    magType: p.magType ?? '',
    place: italianPlace(p.place ?? 'Località sconosciuta'),
    time: p.time,
    depthKm: Math.round((depth ?? 0) * 10) / 10,
    lat,
    lon,
    url: p.url,
    source: 'USGS',
    tsunami: p.tsunami === 1,
    alert: p.alert ?? null,
  };
}

function fromIngv(f: any): Quake | null {
  const p = f?.properties;
  const [lon, lat, depth] = f?.geometry?.coordinates ?? [];
  if (!p || typeof p.mag !== 'number' || typeof lat !== 'number') return null;
  // INGV times are UTC without a zone designator.
  const time = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(p.time) ? p.time : `${p.time}Z`);
  return {
    id: `ingv:${p.eventId}`,
    mag: p.mag,
    magType: p.magType ?? '',
    place: p.place ?? 'Località sconosciuta',
    time: Number.isFinite(time) ? time : Date.now(),
    depthKm: Math.round((depth ?? 0) * 10) / 10,
    lat,
    lon,
    url: `https://terremoti.ingv.it/event/${p.eventId}`,
    source: 'INGV',
    tsunami: false,
    alert: null,
  };
}

function distanceKm(a: Quake, b: Quake): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

async function loadAll(): Promise<QuakesResponse> {
  const errors: string[] = [];
  const since = new Date(Date.now() - WEEK_MS).toISOString().slice(0, 19);
  const ingvUrl = `https://webservices.ingv.it/fdsnws/event/1/query?starttime=${since}&minmag=${INGV_MIN_MAG}&format=geojson&orderby=time&limit=400`;

  const [usgsResults, [ingvResult]] = await Promise.all([
    Promise.allSettled(USGS_FEEDS.map(getJson)),
    Promise.allSettled([getJson(ingvUrl)]),
  ]);

  const usgs = new Map<string, Quake>();
  usgsResults.forEach((r) => {
    if (r.status === 'rejected') {
      errors.push(`USGS: ${r.reason?.name === 'AbortError' ? 'timeout' : r.reason?.message || r.reason}`);
      return;
    }
    for (const f of r.value?.features ?? []) {
      const q = fromUsgs(f);
      if (q) usgs.set(q.id, q);
    }
  });

  const ingv: Quake[] = [];
  if (ingvResult.status === 'fulfilled') {
    for (const f of ingvResult.value?.features ?? []) {
      const q = fromIngv(f);
      if (q) ingv.push(q);
    }
  } else {
    const e = ingvResult.reason;
    errors.push(`INGV: ${e?.name === 'AbortError' ? 'timeout' : e?.message || e}`);
  }

  // Drop the USGS copy of any event INGV also reported (same place and minute).
  const merged = [...ingv];
  for (const q of usgs.values()) {
    const dup = ingv.some((i) => Math.abs(i.time - q.time) < 90_000 && distanceKm(i, q) < 60);
    if (!dup) merged.push(q);
  }
  merged.sort((a, b) => b.time - a.time);

  return { quakes: merged, fetchedAt: Date.now(), errors };
}

export async function getQuakes(): Promise<QuakesResponse> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  inflight ??= loadAll()
    .then((data) => {
      // A total outage keeps serving the last good list.
      if (data.quakes.length === 0 && cache) return { ...cache.data, errors: data.errors };
      cache = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

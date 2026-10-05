// Geo-located world news for the Global Hub globe. Each "area" is a country
// or bloc with coordinates; its headlines come from an Italian-language
// Google News search, so every story on the globe reads in Italian.
// Shared by the Express server (server.ts) and the Vercel function.

import { fetchFeed, NewsItem } from './news';

export type GeoRegion = 'europa' | 'americhe' | 'mena' | 'asia';

export interface GeoArea {
  id: string;
  name: string;
  region: GeoRegion;
  lat: number;
  lon: number;
  query: string;
  /** a headline must mention the area to be pinned on it */
  match: RegExp;
}

export interface GeoNewsItem extends Omit<NewsItem, 'category'> {
  areaId: string;
}

export interface GeoAreaNews extends Omit<GeoArea, 'query' | 'match'> {
  items: GeoNewsItem[];
  /** stories published in the last 6 hours: drives the marker "heat" */
  recentCount: number;
}

export interface GeoNewsResponse {
  areas: GeoAreaNews[];
  fetchedAt: number;
  errors: string[];
}

export const GEO_AREAS: GeoArea[] = [
  // Europa
  { id: 'it', name: 'Italia', region: 'europa', lat: 41.9, lon: 12.5, query: 'governo Meloni OR Mattarella OR Parlamento OR Italia', match: /itali|governo|meloni|mattarella|quirinale|parlamento|palazzo chigi|\bistat\b/i },
  { id: 'eu', name: 'Unione Europea', region: 'europa', lat: 50.85, lon: 4.35, query: '"Unione Europea" OR "Commissione europea" OR Bruxelles', match: /\bue\b|europe[ao]|bruxelles|von der leyen|strasburgo|\bbce\b/i },
  { id: 'fr', name: 'Francia', region: 'europa', lat: 48.86, lon: 2.35, query: 'Francia OR Parigi OR Macron', match: /franci|parigi|macron|eliseo/i },
  { id: 'de', name: 'Germania', region: 'europa', lat: 52.52, lon: 13.4, query: 'Germania OR Berlino OR Merz', match: /german|berlino|merz|bundestag|tedesc/i },
  { id: 'gb', name: 'Regno Unito', region: 'europa', lat: 51.51, lon: -0.13, query: '"Regno Unito" OR Londra OR Starmer', match: /regno unito|londra|starmer|britannic|inghilterra|downing/i },
  { id: 'es', name: 'Spagna', region: 'europa', lat: 40.42, lon: -3.7, query: 'Spagna OR Madrid OR Sánchez', match: /spagn|madrid|s[aá]nchez|barcellona|catalogn/i },
  { id: 'ua', name: 'Ucraina', region: 'europa', lat: 50.45, lon: 30.52, query: 'Ucraina OR Kiev OR Zelensky', match: /ucrain|kiev|kyiv|zelensky|donbass|kharkiv|odessa/i },
  { id: 'ru', name: 'Russia', region: 'europa', lat: 55.76, lon: 37.62, query: 'Russia OR Cremlino OR Putin', match: /russi|mosca|cremlino|putin/i },
  // Americhe
  { id: 'us', name: 'Stati Uniti', region: 'americhe', lat: 38.9, lon: -77.04, query: '"Stati Uniti" OR "Casa Bianca" OR Trump', match: /stati uniti|\busa\b|casa bianca|washington|trump|american|pentagono|wall street/i },
  { id: 'ca', name: 'Canada', region: 'americhe', lat: 45.42, lon: -75.7, query: 'Canada', match: /canad|ottawa|carney|toronto/i },
  { id: 'mx', name: 'Messico', region: 'americhe', lat: 19.43, lon: -99.13, query: 'Messico', match: /messic/i },
  { id: 'br', name: 'Brasile', region: 'americhe', lat: -15.79, lon: -47.88, query: 'Brasile OR Lula', match: /brasil|lula|bolsonaro|rio de janeiro/i },
  { id: 'ar', name: 'Argentina', region: 'americhe', lat: -34.6, lon: -58.38, query: 'Argentina OR Milei', match: /argentin|buenos aires|milei/i },
  // Medio Oriente & Africa
  { id: 'il', name: 'Israele e Gaza', region: 'mena', lat: 31.77, lon: 35.21, query: 'Israele OR Gaza OR Libano', match: /israel|gaza|netanyahu|hamas|cisgiordania|tel aviv|gerusalemme|liban|hezbollah/i },
  { id: 'ir', name: 'Iran', region: 'mena', lat: 35.69, lon: 51.39, query: 'Iran OR Teheran', match: /iran|teheran|hormuz|khamenei/i },
  { id: 'tr', name: 'Turchia', region: 'mena', lat: 39.93, lon: 32.86, query: 'Turchia OR Erdogan', match: /turchi|erdo[gğ]an|ankara|istanbul/i },
  { id: 'eg', name: 'Egitto', region: 'mena', lat: 30.04, lon: 31.24, query: 'Egitto OR Cairo', match: /egitt|cairo|al-?sisi|suez/i },
  { id: 'za', name: 'Africa', region: 'mena', lat: -1.29, lon: 36.82, query: 'Africa OR Kenya OR Nigeria OR Sudafrica OR Sudan OR Congo OR Sahel', match: /africa|kenya|nigeria|sudafrica|sudan|congo|etiopia|somali|sahel|\bmali\b/i },
  // Asia & Oceania
  { id: 'cn', name: 'Cina', region: 'asia', lat: 39.9, lon: 116.4, query: 'Cina OR Pechino OR "Xi Jinping"', match: /\bcina\b|cines[ei]|pechino|xi jinping|shanghai/i },
  { id: 'jp', name: 'Giappone', region: 'asia', lat: 35.68, lon: 139.69, query: 'Giappone OR Tokyo', match: /giappon|tokyo|nipponic/i },
  { id: 'in', name: 'India', region: 'asia', lat: 28.61, lon: 77.21, query: 'India OR "Nuova Delhi" OR Modi', match: /\bindia|indian[oaie]\b|nuova delhi|\bmodi\b|mumbai/i },
  { id: 'kr', name: 'Corea', region: 'asia', lat: 37.57, lon: 126.98, query: '"Corea del Sud" OR "Corea del Nord" OR Seul', match: /corea|seul|pyongyang|kim jong/i },
  { id: 'tw', name: 'Taiwan', region: 'asia', lat: 25.03, lon: 121.57, query: 'Taiwan', match: /taiwan|taipei/i },
  { id: 'au', name: 'Australia', region: 'asia', lat: -35.28, lon: 149.13, query: 'Australia OR Sydney OR Canberra', match: /australi|sydney|canberra|melbourne/i },
];

// Keeps the globe on hard news: country names otherwise pull in a lot of
// race weekends and match reports.
const EXCLUDE = '-calcio -gol -Nazionale -convocati -partita -boxe -MotoGP -"Formula 1" -F1 -tennis -"Serie A" -Champions -volley -basket -ciclismo';

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_ITEMS_PER_AREA = 10;
const MAX_AGE_MS = 48 * 60 * 60 * 1000;
const RECENT_MS = 6 * 60 * 60 * 1000;
const CONCURRENCY = 6;

let cache: { at: number; data: GeoNewsResponse } | null = null;
let inflight: Promise<GeoNewsResponse> | null = null;

function feedUrl(area: GeoArea): string {
  const q = encodeURIComponent(`${area.query} ${EXCLUDE} when:1d`);
  return `https://news.google.com/rss/search?q=${q}&hl=it&gl=IT&ceid=IT:it`;
}

async function loadArea(area: GeoArea, previous?: GeoAreaNews): Promise<{ area: GeoAreaNews; error?: string }> {
  const meta = { id: area.id, name: area.name, region: area.region, lat: area.lat, lon: area.lon };
  try {
    const raw = await fetchFeed({ url: feedUrl(area), source: 'Google News' }, 'mondo');
    const now = Date.now();
    const seen = new Set<string>();
    const items: GeoNewsItem[] = [];
    for (const { category: _c, ...item } of raw.sort((a, b) => b.publishedAt - a.publishedAt)) {
      const key = item.title.toLowerCase();
      if (seen.has(key) || now - item.publishedAt > MAX_AGE_MS || !area.match.test(item.title)) continue;
      seen.add(key);
      items.push({ ...item, areaId: area.id });
      if (items.length >= MAX_ITEMS_PER_AREA) break;
    }
    // An empty answer is usually a transient Google hiccup: keep the last good copy.
    if (items.length === 0 && previous?.items.length) return { area: previous };
    const recentCount = items.filter((i) => now - i.publishedAt < RECENT_MS).length;
    return { area: { ...meta, items, recentCount } };
  } catch (err: any) {
    const error = `${area.name}: ${err?.name === 'AbortError' ? 'timeout' : err?.message || err}`;
    return { area: previous ?? { ...meta, items: [], recentCount: 0 }, error };
  }
}

async function loadAll(): Promise<GeoNewsResponse> {
  const prevById = new Map(cache?.data.areas.map((a) => [a.id, a]));
  const results: { area: GeoAreaNews; error?: string }[] = new Array(GEO_AREAS.length);
  let next = 0;
  // Small worker pool: two dozen parallel requests to Google look like abuse.
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < GEO_AREAS.length) {
        const i = next++;
        results[i] = await loadArea(GEO_AREAS[i], prevById.get(GEO_AREAS[i].id));
      }
    })
  );
  return {
    areas: results.map((r) => r.area),
    fetchedAt: Date.now(),
    errors: results.flatMap((r) => (r.error ? [r.error] : [])),
  };
}

export async function getGeoNews(): Promise<GeoNewsResponse> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  // Coalesce concurrent requests onto one refresh.
  inflight ??= loadAll()
    .then((data) => {
      cache = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

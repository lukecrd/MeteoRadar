// Webcams near a point, from the Windy Webcams API v3 (https://api.windy.com/webcams).
// The key (WINDY_API_KEY) stays on the server; the browser only calls /api/webcams.
// Shared by the Express server (server.ts) and the Vercel function.

export interface Webcam {
  id: number;
  title: string;
  city: string;
  lat: number;
  lon: number;
  /** Latest still frame. Windy signs these URLs and they expire (10 min on the free plan). */
  image: string;
  /** Webcam page on windy.com: Windy's terms require linking back to it. */
  url: string;
  /** ISO time of the latest frame, when known */
  updatedAt: string | null;
}

export interface WebcamsResponse {
  items: Webcam[];
  /** false when WINDY_API_KEY is not set on the server */
  configured: boolean;
  fetchedAt: number;
  error?: string;
}

export const WEBCAM_RADIUS_KM = 30;
const LIMIT = 12;
// Under the 10-minute life of the image URLs, so a cached answer never serves dead links.
const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10000;
const MAX_CACHED_AREAS = 200;

const cache = new Map<string, { at: number; data: WebcamsResponse }>();

/** Query-string coordinates → numbers, or null when missing or out of range. */
export function parseWebcamQuery(query: any): { lat: number; lon: number } | null {
  const lat = Number(query?.lat);
  const lon = Number(query?.lon);
  if (query?.lat == null || query?.lon == null || query.lat === '' || query.lon === '') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

/** Never throws: a failed or unconfigured upstream comes back as { items: [], error }. */
export async function getWebcams(lat: number, lon: number): Promise<WebcamsResponse> {
  // Pasted values often carry spaces, a newline or quotes: Windy answers 401 to those.
  const key = process.env.WINDY_API_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!key) return { items: [], configured: false, fetchedAt: Date.now() };

  // ~1 km grid: neighbours share one cached answer.
  const area = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = cache.get(area);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `https://api.windy.com/webcams/api/v3/webcams?nearby=${area},${WEBCAM_RADIUS_KM}&limit=${LIMIT}&lang=it&include=images,location,urls`;
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'x-windy-api-key': key } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body: any = await res.json();
    const items: Webcam[] = (Array.isArray(body?.webcams) ? body.webcams : [])
      .filter((w: any) => w?.status !== 'inactive' && w?.images?.current?.preview)
      .map((w: any) => ({
        id: w.webcamId,
        title: String(w.title ?? 'Webcam'),
        city: String(w.location?.city ?? ''),
        lat: Number(w.location?.latitude),
        lon: Number(w.location?.longitude),
        image: w.images.current.preview,
        url: w.urls?.detail ?? `https://www.windy.com/webcams/${w.webcamId}`,
        updatedAt: w.lastUpdatedOn ?? null,
      }));
    const data: WebcamsResponse = { items, configured: true, fetchedAt: Date.now() };
    if (cache.size >= MAX_CACHED_AREAS) cache.clear();
    cache.set(area, { at: Date.now(), data });
    return data;
  } catch (err: any) {
    // Not cached: the next request retries.
    return { items: [], configured: true, fetchedAt: Date.now(), error: String(err?.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

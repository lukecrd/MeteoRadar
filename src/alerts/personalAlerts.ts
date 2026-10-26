/**
 * Personal alerts: thresholds checked against saved places.
 *
 * Shared by the app (checks while it is open) and the Android background
 * runner (src/alerts/runner.ts, bundled to public/runners/alerts.js), so this
 * file must not touch the DOM, React or localStorage: only `fetch` and plain data.
 */

export interface AlertPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface AlertRules {
  /** Rain in any of the next hours, mm/h. 0 = off. */
  rainMmH: number;
  /** Wind gusts in any of the next hours, km/h. 0 = off. */
  gustKmh: number;
  /** Air temperature in any of the next hours, °C. 0 = off. */
  heatC: number;
  /** Thunderstorm forecast (WMO codes 95–99). */
  storms: boolean;
  /** Earthquakes of at least this magnitude... 0 = off. */
  quakeMinMag: number;
  /** ...within this distance of a place. */
  quakeRadiusKm: number;
}

export interface AlertConfig {
  enabled: boolean;
  places: AlertPlace[];
  rules: AlertRules;
}

/** One notification to show. `key` is stable so the same event never notifies twice. */
export interface AlertNotice {
  key: string;
  title: string;
  body: string;
}

export interface ForecastHour {
  time: string; // local ISO hour from Open-Meteo, e.g. "2026-10-26T18:00"
  precipitationMm: number;
  gustKmh: number;
  temperatureC: number;
  weatherCode: number;
}

export interface QuakeEvent {
  id: string;
  mag: number;
  lat: number;
  lon: number;
  place: string;
  time: number; // epoch ms
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  enabled: false,
  places: [],
  rules: { rainMmH: 5, gustKmh: 60, heatC: 35, storms: true, quakeMinMag: 3, quakeRadiusKm: 100 },
};

/** Hours of forecast each check looks at. */
export const LOOKAHEAD_HOURS = 6;
/** Earthquakes older than this are ignored. */
const QUAKE_WINDOW_MS = 3 * 60 * 60 * 1000;
/** Remembered notice keys expire after this, so the "seen" list stays small. */
const SEEN_TTL_MS = 48 * 60 * 60 * 1000;

const D2R = Math.PI / 180;
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * D2R;
  const dLon = (lon2 - lon1) * D2R;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * D2R) * Math.cos(lat2 * D2R) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** "18:40" in Italian time; falls back to UTC where the runtime has no Intl time zones (background runner). */
function clockIt(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
  } catch {
    return `${new Date(ms).toISOString().slice(11, 16)} UTC`;
  }
}

/** The runner's fetch may not set `ok`; derive it from the status. */
const isOk = (res: { ok?: boolean; status: number }) => res.ok ?? (res.status >= 200 && res.status < 300);

const hourLabel = (iso: string) => iso.slice(11, 16);
const dayOf = (iso: string) => iso.slice(0, 10);

/**
 * Forecast rules for one place. Each rule notifies at most once per place per
 * day (key includes the date of the first hour that crosses the threshold).
 */
export function evaluateForecast(place: AlertPlace, rules: AlertRules, hours: ForecastHour[]): AlertNotice[] {
  const out: AlertNotice[] = [];
  const first = <T,>(pick: (h: ForecastHour) => T | null) => {
    for (const h of hours) {
      const v = pick(h);
      if (v != null) return { h, v };
    }
    return null;
  };

  if (rules.rainMmH > 0) {
    const hit = first((h) => (h.precipitationMm >= rules.rainMmH ? h.precipitationMm : null));
    if (hit) {
      out.push({
        key: `rain:${place.id}:${dayOf(hit.h.time)}`,
        title: `Pioggia forte a ${place.name}`,
        body: `Previsti ${hit.v.toFixed(1).replace('.', ',')} mm/h alle ${hourLabel(hit.h.time)}.`,
      });
    }
  }
  if (rules.gustKmh > 0) {
    const max = hours.reduce<ForecastHour | null>((m, h) => (h.gustKmh >= rules.gustKmh && (!m || h.gustKmh > m.gustKmh) ? h : m), null);
    if (max) {
      out.push({
        key: `gust:${place.id}:${dayOf(max.time)}`,
        title: `Raffiche di vento a ${place.name}`,
        body: `Raffiche fino a ${Math.round(max.gustKmh)} km/h verso le ${hourLabel(max.time)}.`,
      });
    }
  }
  if (rules.heatC > 0) {
    const max = hours.reduce<ForecastHour | null>((m, h) => (h.temperatureC >= rules.heatC && (!m || h.temperatureC > m.temperatureC) ? h : m), null);
    if (max) {
      out.push({
        key: `heat:${place.id}:${dayOf(max.time)}`,
        title: `Caldo intenso a ${place.name}`,
        body: `Fino a ${Math.round(max.temperatureC)} °C verso le ${hourLabel(max.time)}.`,
      });
    }
  }
  if (rules.storms) {
    const hit = first((h) => (h.weatherCode >= 95 && h.weatherCode <= 99 ? h.weatherCode : null));
    if (hit) {
      out.push({
        key: `storm:${place.id}:${dayOf(hit.h.time)}`,
        title: `Temporale in arrivo a ${place.name}`,
        body: `${hit.v >= 96 ? 'Temporale con possibile grandine' : 'Temporale'} previsto alle ${hourLabel(hit.h.time)}.`,
      });
    }
  }
  return out;
}

/** Earthquake rule for one place: each quake notifies once per place. */
export function evaluateQuakes(place: AlertPlace, rules: AlertRules, quakes: QuakeEvent[], now: number): AlertNotice[] {
  if (rules.quakeMinMag <= 0) return [];
  const out: AlertNotice[] = [];
  for (const q of quakes) {
    if (q.mag < rules.quakeMinMag || now - q.time > QUAKE_WINDOW_MS) continue;
    const km = distanceKm(place.lat, place.lon, q.lat, q.lon);
    if (km > rules.quakeRadiusKm) continue;
    const time = clockIt(q.time);
    out.push({
      key: `quake:${q.id}:${place.id}`,
      title: `Terremoto M${q.mag.toFixed(1)} a ${Math.round(km)} km da ${place.name}`,
      body: `${q.place}, alle ${time}.`,
    });
  }
  return out;
}

/** Notices not seen yet, and the updated seen map (expired keys dropped). */
export function filterNew(
  notices: AlertNotice[],
  seen: Record<string, number>,
  now: number
): { fresh: AlertNotice[]; seen: Record<string, number> } {
  const next: Record<string, number> = {};
  for (const [k, t] of Object.entries(seen)) if (now - t < SEEN_TTL_MS) next[k] = t;
  const fresh: AlertNotice[] = [];
  for (const n of notices) {
    if (next[n.key] != null) continue;
    next[n.key] = now;
    fresh.push(n);
  }
  return { fresh, seen: next };
}

/* ---------------- Data sources (public, no API key) ---------------- */

export async function fetchForecastHours(place: AlertPlace): Promise<ForecastHour[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
    `&hourly=precipitation,wind_gusts_10m,temperature_2m,weather_code&forecast_hours=${LOOKAHEAD_HOURS}&timezone=auto`;
  const res = await fetch(url);
  if (!isOk(res)) throw new Error(`Open-Meteo ${res.status}`);
  const j = await res.json();
  const h = j.hourly ?? {};
  return (h.time ?? []).map((time: string, i: number) => ({
    time,
    precipitationMm: Number(h.precipitation?.[i] ?? 0),
    gustKmh: Number(h.wind_gusts_10m?.[i] ?? 0),
    temperatureC: Number(h.temperature_2m?.[i] ?? 0),
    weatherCode: Number(h.weather_code?.[i] ?? 0),
  }));
}

// shortcut: INGV for places inside a box around Italy, USGS elsewhere; a quake
// near a border may then come from one network only. Merge both if that matters.
const inItaly = (p: AlertPlace) => p.lat >= 35 && p.lat <= 48 && p.lon >= 6 && p.lon <= 19;

export async function fetchQuakesNear(place: AlertPlace, rules: AlertRules, now: number): Promise<QuakeEvent[]> {
  const since = new Date(now - QUAKE_WINDOW_MS).toISOString().slice(0, 19);
  const q = `latitude=${place.lat}&longitude=${place.lon}&maxradiuskm=${rules.quakeRadiusKm}&starttime=${since}&format=geojson`;
  const url = inItaly(place)
    ? `https://webservices.ingv.it/fdsnws/event/1/query?lat=${place.lat}&lon=${place.lon}&maxradiuskm=${rules.quakeRadiusKm}&starttime=${since}&minmag=${rules.quakeMinMag}&format=geojson`
    : `https://earthquake.usgs.gov/fdsnws/event/1/query?${q}&minmagnitude=${rules.quakeMinMag}`;
  const res = await fetch(url);
  // FDSN answers 204 when nothing matches.
  if (res.status === 204) return [];
  if (!isOk(res)) throw new Error(`Terremoti ${res.status}`);
  const j = await res.json();
  return (j.features ?? []).map((f: any) => ({
    id: String(f.id ?? f.properties?.eventId),
    mag: Number(f.properties?.mag ?? 0),
    lat: Number(f.geometry?.coordinates?.[1]),
    lon: Number(f.geometry?.coordinates?.[0]),
    place: String(f.properties?.place ?? 'Epicentro sconosciuto'),
    time: typeof f.properties?.time === 'number' ? f.properties.time : Date.parse(f.properties?.time),
  }));
}

/**
 * One full check: every place, every rule. A failing source for one place is
 * skipped (it is retried on the next check) instead of failing the whole run.
 */
export async function runAlertChecks(
  config: AlertConfig,
  seen: Record<string, number>,
  now = Date.now()
): Promise<{ fresh: AlertNotice[]; seen: Record<string, number>; errors: string[] }> {
  if (!config.enabled || config.places.length === 0) return { fresh: [], seen, errors: [] };
  const notices: AlertNotice[] = [];
  const errors: string[] = [];
  const forecastOn = config.rules.rainMmH > 0 || config.rules.gustKmh > 0 || config.rules.heatC > 0 || config.rules.storms;
  await Promise.all(
    config.places.map(async (place) => {
      if (forecastOn) {
        try {
          notices.push(...evaluateForecast(place, config.rules, await fetchForecastHours(place)));
        } catch (e) {
          errors.push(`${place.name}: ${(e as Error).message}`);
        }
      }
      if (config.rules.quakeMinMag > 0) {
        try {
          notices.push(...evaluateQuakes(place, config.rules, await fetchQuakesNear(place, config.rules, now), now));
        } catch (e) {
          errors.push(`${place.name}: ${(e as Error).message}`);
        }
      }
    })
  );
  return { ...filterNew(notices, seen, now), errors };
}

/** Stable 31-bit id for a notice key (Android notification ids are 32-bit ints). */
export function noticeId(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return h & 0x7fffffff;
}

import { ecfToLookAngles, eciToEcf, gstime, jday, propagate, sunPos, twoline2satrec } from 'satellite.js';

/** One ISS pass above MIN_ELEVATION_DEG, as seen from an observer. */
export interface SatPass {
  startMs: number;
  peakMs: number;
  endMs: number;
  maxElevationDeg: number;
  startAzimuthDeg: number;
  endAzimuthDeg: number;
  /** Observer in darkness while the station is sunlit: visible to the naked eye. */
  visible: boolean;
}

const MIN_ELEVATION_DEG = 10;
const STEP_MS = 20_000;
const AU_KM = 149_597_870.7;
const EARTH_RADIUS_KM = 6378.137;
const R2D = 180 / Math.PI;

/**
 * Passes of a satellite over (lat, lon) in the next `hours`, with SGP4.
 * Naked-eye visibility: Sun at least 6° below the observer's horizon (civil
 * twilight or darker) and the satellite outside Earth's shadow.
 * shortcut: cylindrical shadow and 20 s sampling (times ±20 s); fine for a
 * "look up at 21:14" hint, not for photography timing.
 */
export function satellitePasses(line1: string, line2: string, lat: number, lon: number, from: number, hours = 24): SatPass[] {
  const satrec = twoline2satrec(line1, line2);
  const observer = { latitude: lat / R2D, longitude: lon / R2D, height: 0 };
  const passes: SatPass[] = [];
  let cur: SatPass | null = null;

  for (let t = from; t <= from + hours * 3600_000; t += STEP_MS) {
    const date = new Date(t);
    const pv = propagate(satrec, date);
    if (!pv || !pv.position || typeof pv.position === 'boolean') continue;
    const gmst = gstime(date);
    const look = ecfToLookAngles(observer, eciToEcf(pv.position, gmst));
    const el = look.elevation * R2D;

    if (el < MIN_ELEVATION_DEG) {
      if (cur) passes.push(cur);
      cur = null;
      continue;
    }
    const az = look.azimuth * R2D;
    if (!cur) cur = { startMs: t, peakMs: t, endMs: t, maxElevationDeg: el, startAzimuthDeg: az, endAzimuthDeg: az, visible: false };
    cur.endMs = t;
    cur.endAzimuthDeg = az;
    if (el > cur.maxElevationDeg) {
      cur.maxElevationDeg = el;
      cur.peakMs = t;
    }
    if (!cur.visible) {
      const [sx, sy, sz] = sunPos(jday(date)).rsun.map((v: number) => v * AU_KM);
      const sunEl = ecfToLookAngles(observer, eciToEcf({ x: sx, y: sy, z: sz }, gmst)).elevation * R2D;
      const n = Math.hypot(sx, sy, sz);
      const r = pv.position;
      const along = (r.x * sx + r.y * sy + r.z * sz) / n;
      const perp = Math.sqrt(Math.max(0, r.x ** 2 + r.y ** 2 + r.z ** 2 - along ** 2));
      const sunlit = along > 0 || perp > EARTH_RADIUS_KM;
      cur.visible = sunEl < -6 && sunlit;
    }
  }
  if (cur) passes.push(cur);
  return passes;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
/** Azimuth / bearing in degrees → Italian 8-point compass label. */
export const compassIt = (deg: number) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

/** Initial bearing from point 1 to point 2, degrees clockwise from north. */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = lat1 / R2D;
  const p2 = lat2 / R2D;
  const dl = (lon2 - lon1) / R2D;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) * R2D + 360) % 360;
}

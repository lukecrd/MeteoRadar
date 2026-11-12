import { DailyForecastItem, LocationInfo } from '../types';

export interface LunarPhaseInfo {
  phaseValue: number; // 0 to 1 (0 = New, 0.25 = First Quarter, 0.5 = Full, 0.75 = Last Quarter)
  phaseName: string;
  phaseSubtitle: string;
  illuminationPct: number; // 0 to 100
  ageDays: number; // 0 to 29.53
  isWaxing: boolean;
  distanceKm: number;
  elongationDeg: number;
  nextFullMoonDate: Date;
  nextNewMoonDate: Date;
  upcomingPhases: Array<{
    name: string;
    date: Date;
    type: 'new' | 'first_quarter' | 'full' | 'last_quarter';
  }>;
}

export interface SolarEphemerisInfo {
  sunriseTime: string; // HH:MM
  sunsetTime: string; // HH:MM
  solarNoonTime: string; // HH:MM
  civilDawnTime: string; // HH:MM
  civilDuskTime: string; // HH:MM
  morningGoldenHour: string; // HH:MM - HH:MM
  eveningGoldenHour: string; // HH:MM - HH:MM
  daylightHours: number;
  daylightMinutes: number;
  daylightTotalSec: number;
  daylightDeltaSec: number; // vs yesterday
  sunProgress: number; // 0 (sunrise) to 1 (sunset), <0 before sunrise, >1 after sunset
  isDaylightNow: boolean;
  currentElevationDeg: number;
  maxElevationDeg: number;
  currentAzimuthDeg: number;
}

const SYNODIC_MONTH = 29.530588853; // days
// Known reference New Moon: 2000-01-06 18:14 UTC (JD 2451550.26)
const REF_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
// Anomalistic month for perigee-apogee distance calculation (27.55455 days)
const ANOMALISTIC_MONTH = 27.55454988;
const REF_PERIGEE_MS = Date.UTC(2000, 0, 19, 22, 0, 0);

/**
 * Computes precise lunar phase, illumination, distance, and upcoming principal phases.
 */
export function computeLunarEphemeris(date: Date = new Date()): LunarPhaseInfo {
  const nowMs = date.getTime();
  const daysSinceRef = (nowMs - REF_NEW_MOON_MS) / 86_400_000;
  const cycles = daysSinceRef / SYNODIC_MONTH;
  const phaseValue = ((cycles % 1) + 1) % 1; // 0..1
  const ageDays = phaseValue * SYNODIC_MONTH;
  const elongationDeg = Math.round(phaseValue * 360);

  // Illumination fraction: (1 - cos(2 * pi * phaseValue)) / 2
  const illuminationFraction = (1 - Math.cos(2 * Math.PI * phaseValue)) / 2;
  const illuminationPct = Math.round(illuminationFraction * 1000) / 10;
  const isWaxing = phaseValue < 0.5;

  // Approximate Earth-Moon distance (mean 384,400 km, +/- 21,000 km)
  const anomCycles = (nowMs - REF_PERIGEE_MS) / (86_400_000 * ANOMALISTIC_MONTH);
  const anomAngle = 2 * Math.PI * (((anomCycles % 1) + 1) % 1);
  const distanceKm = Math.round(384400 - 20900 * Math.cos(anomAngle) - 3700 * Math.cos(2 * Math.PI * phaseValue));

  let phaseName = 'Luna Nuova';
  let phaseSubtitle = 'Novilunio · Cielo buio ideale per osservazione astronomica';

  if (phaseValue < 0.03 || phaseValue >= 0.97) {
    phaseName = 'Luna Nuova';
    phaseSubtitle = 'Novilunio · Disco in congiunzione solare';
  } else if (phaseValue < 0.22) {
    phaseName = 'Luna Crescente';
    phaseSubtitle = 'Falce crescente visibile a ovest dopo il tramonto';
  } else if (phaseValue < 0.28) {
    phaseName = 'Primo Quarto';
    phaseSubtitle = 'Quadratura orientale · Culmina al tramonto';
  } else if (phaseValue < 0.47) {
    phaseName = 'Gibbosa Crescente';
    phaseSubtitle = 'Oltre metà del disco lunare illuminato';
  } else if (phaseValue < 0.53) {
    phaseName = 'Luna Piena';
    phaseSubtitle = 'Plenilunio · Sorge al tramonto e brilla tutta la notte';
  } else if (phaseValue < 0.72) {
    phaseName = 'Gibbosa Calante';
    phaseSubtitle = 'Visibile dalla tarda sera fino al mattino';
  } else if (phaseValue < 0.78) {
    phaseName = 'Ultimo Quarto';
    phaseSubtitle = 'Quadratura occidentale · Sorge a mezzanotte';
  } else {
    phaseName = 'Luna Calante';
    phaseSubtitle = 'Falce calante visibile a est prima dell’alba';
  }

  // Next Full Moon (target phase 0.5) & Next New Moon (target phase 1.0)
  const daysToFull = ((0.5 - phaseValue + 1) % 1) * SYNODIC_MONTH;
  const daysToNew = ((1.0 - phaseValue) % 1) * SYNODIC_MONTH;
  const nextFullMoonDate = new Date(nowMs + daysToFull * 86_400_000);
  const nextNewMoonDate = new Date(nowMs + (daysToNew < 0.1 ? SYNODIC_MONTH : daysToNew) * 86_400_000);

  const targets: Array<{ target: number; name: string; type: 'new' | 'first_quarter' | 'full' | 'last_quarter' }> = [
    { target: 0.0, name: 'Luna Nuova', type: 'new' },
    { target: 0.25, name: 'Primo Quarto', type: 'first_quarter' },
    { target: 0.5, name: 'Luna Piena', type: 'full' },
    { target: 0.75, name: 'Ultimo Quarto', type: 'last_quarter' },
  ];

  const upcomingPhases = targets
    .map((t) => {
      let deltaPhase = (t.target - phaseValue + 1) % 1;
      if (deltaPhase < 0.015) deltaPhase += 1;
      return {
        name: t.name,
        type: t.type,
        date: new Date(nowMs + deltaPhase * SYNODIC_MONTH * 86_400_000),
      };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    phaseValue,
    phaseName,
    phaseSubtitle,
    illuminationPct,
    ageDays: Math.round(ageDays * 10) / 10,
    isWaxing,
    distanceKm,
    elongationDeg,
    nextFullMoonDate,
    nextNewMoonDate,
    upcomingPhases,
  };
}

function formatMinutesOfDay(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hh = Math.floor(normalized / 60);
  const mm = normalized % 60;
  return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}

function parseMinutesFromIsoOrTime(iso?: string): number | null {
  if (!iso) return null;
  const match = iso.match(/T(\d{2}):(\d{2})/) || iso.match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/**
 * Computes solar ephemerides for a given location and optional Open-Meteo daily forecast.
 */
export function computeSolarEphemeris(
  location: LocationInfo,
  daily?: DailyForecastItem[],
  now: Date = new Date()
): SolarEphemerisInfo {
  const latRad = (location.latitude * Math.PI) / 180;

  // Day of year (1..365)
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000);

  // Solar declination in radians
  const declination = 0.409 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81));

  // Maximum solar elevation at solar noon
  const maxElevationRad = Math.PI / 2 - Math.abs(latRad - declination);
  const maxElevationDeg = Math.max(5, Math.min(90, Math.round(((maxElevationRad * 180) / Math.PI) * 10) / 10));

  // Fallback sunrise/sunset calculation from latitude & declination if API didn't return them
  const cosHourAngle = -Math.tan(latRad) * Math.tan(declination);
  const clampedCos = Math.max(-0.98, Math.min(0.98, cosHourAngle));
  const halfDayHours = (Math.acos(clampedCos) * 180) / Math.PI / 15;

  const today = daily?.[0];
  let sunriseMin = parseMinutesFromIsoOrTime(today?.sunrise);
  let sunsetMin = parseMinutesFromIsoOrTime(today?.sunset);

  if (sunriseMin === null || sunsetMin === null) {
    const solarNoonDefault = 12 * 60 + 15;
    sunriseMin = Math.round(solarNoonDefault - halfDayHours * 60);
    sunsetMin = Math.round(solarNoonDefault + halfDayHours * 60);
  }

  const solarNoonMin = Math.round((sunriseMin + sunsetMin) / 2);
  const civilDawnMin = sunriseMin - 31;
  const civilDuskMin = sunsetMin + 31;

  // Golden hour: ~15 min before sunrise to 45 min after; and 50 min before sunset to 15 min after
  const morningGoldenHour = `${formatMinutesOfDay(sunriseMin - 10)} – ${formatMinutesOfDay(sunriseMin + 45)}`;
  const eveningGoldenHour = `${formatMinutesOfDay(sunsetMin - 50)} – ${formatMinutesOfDay(sunsetMin + 10)}`;

  const daylightTotalSec = today?.daylightDurationSec
    ? Math.round(today.daylightDurationSec)
    : Math.max(0, (sunsetMin - sunriseMin) * 60);

  const daylightHours = Math.floor(daylightTotalSec / 3600);
  const daylightMinutes = Math.floor((daylightTotalSec % 3600) / 60);

  // Calculate daylight delta vs tomorrow/yesterday using derivative of declination
  const declinationYesterday = 0.409 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 82));
  const cosYesterday = Math.max(-0.98, Math.min(0.98, -Math.tan(latRad) * Math.tan(declinationYesterday)));
  const halfDayYesterdayHours = (Math.acos(cosYesterday) * 180) / Math.PI / 15;
  const daylightDeltaSec = Math.round((halfDayHours - halfDayYesterdayHours) * 2 * 3600);

  // Local current time in location timezone
  let nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (location.timezone && location.timezone !== 'auto') {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: location.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(now);
      const hh = parseInt(parts.find((p) => p.type === 'hour')?.value || '12', 10);
      const mm = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
      nowMinutes = hh * 60 + mm;
    } catch {
      // fallback to device clock
    }
  }

  const daySpan = Math.max(1, sunsetMin - sunriseMin);
  const sunProgress = (nowMinutes - sunriseMin) / daySpan;
  const isDaylightNow = nowMinutes >= sunriseMin && nowMinutes <= sunsetMin;

  // Smooth elevation curve: peaks at solarNoonMin, negative at night
  let currentElevationDeg = 0;
  if (isDaylightNow) {
    currentElevationDeg = Math.round(Math.sin(Math.PI * Math.max(0, Math.min(1, sunProgress))) * maxElevationDeg * 10) / 10;
  } else {
    // Night elevation below horizon
    const nightDist = nowMinutes < sunriseMin ? sunriseMin - nowMinutes : nowMinutes - sunsetMin;
    currentElevationDeg = -Math.round(Math.min(45, (nightDist / 360) * 35) * 10) / 10;
  }

  // Approximate solar azimuth (East ~90 at sunrise, South ~180 at noon, West ~270 at sunset)
  const clampedProg = Math.max(-0.3, Math.min(1.3, sunProgress));
  const currentAzimuthDeg = Math.round((85 + clampedProg * 190 + 360) % 360);

  return {
    sunriseTime: formatMinutesOfDay(sunriseMin),
    sunsetTime: formatMinutesOfDay(sunsetMin),
    solarNoonTime: formatMinutesOfDay(solarNoonMin),
    civilDawnTime: formatMinutesOfDay(civilDawnMin),
    civilDuskTime: formatMinutesOfDay(civilDuskMin),
    morningGoldenHour,
    eveningGoldenHour,
    daylightHours,
    daylightMinutes,
    daylightTotalSec,
    daylightDeltaSec,
    sunProgress,
    isDaylightNow,
    currentElevationDeg,
    maxElevationDeg,
    currentAzimuthDeg,
  };
}

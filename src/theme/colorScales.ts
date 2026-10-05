// Single source of truth for data colours (maps, globe, cards, legends).
// UI colours live in index.css as tokens; these are for encoding values.
// Families are kept apart so layers never collide on the same surface:
// earthquakes = warm, flights = cool, markets = green/red (see hubApi UP/DOWN).

export interface ScaleStop {
  /** lower bound (inclusive) of the class */
  min: number;
  color: string;
  label: string;
}

const pick = (stops: ScaleStop[], v: number) => {
  let hit = stops[0];
  for (const s of stops) if (v >= s.min) hit = s;
  return hit;
};

/** Earthquake magnitude: sequential YlOrRd, one hue step per magnitude unit. */
export const QUAKE_SCALE: ScaleStop[] = [
  { min: -Infinity, color: '#bdbdbd', label: '< M2' },
  { min: 2, color: '#ffe08a', label: 'M2' },
  { min: 3, color: '#feb24c', label: 'M3' },
  { min: 4, color: '#fd8d3c', label: 'M4' },
  { min: 5, color: '#f03b20', label: 'M5' },
  { min: 6, color: '#d7191c', label: 'M6' },
  { min: 7, color: '#a50026', label: 'M7+' },
];
export const quakeColor = (mag: number) => pick(QUAKE_SCALE, mag).color;

/** Marker radius grows ~2x in area per magnitude unit (exponential, not linear). */
export const quakeRadius = (mag: number, base = 1) => base * 1.45 ** (Math.max(mag, 2) - 2);

/** Flight altitude bands: a cool family, distinct from quakes and markets. */
export const FLIGHT_ALT_SCALE: ScaleStop[] = [
  { min: -Infinity, color: '#9be7f0', label: '< FL100' },
  { min: 10000, color: '#4cb8e6', label: 'FL100–250' },
  { min: 25000, color: '#4c7be0', label: 'FL250–350' },
  { min: 35000, color: '#a98bf5', label: '> FL350' },
];
export const flightColor = (altFt: number) => pick(FLIGHT_ALT_SCALE, altFt).color;

/** UV index, official WHO colours. Classes use the rounded index (WHO convention). */
export const UV_SCALE: ScaleStop[] = [
  { min: -Infinity, color: '#4eb400', label: 'Basso' },
  { min: 3, color: '#f7e400', label: 'Moderato' },
  { min: 6, color: '#f85900', label: 'Alto' },
  { min: 8, color: '#d8001d', label: 'Molto alto' },
  { min: 11, color: '#6b49c8', label: 'Estremo' },
];
export const uvClass = (uv: number) => pick(UV_SCALE, Math.round(uv));

/** Air temperature (°C): diverging around 0 °C (ColorBrewer RdYlBu, extended). */
export const TEMP_SCALE: ScaleStop[] = [
  { min: -Infinity, color: '#313695', label: '≤ −10' },
  { min: -10, color: '#4575b4', label: '−10' },
  { min: -5, color: '#74add1', label: '−5' },
  { min: 0, color: '#abd9e9', label: '0' },
  { min: 5, color: '#e0f3f8', label: '5' },
  { min: 10, color: '#ffffbf', label: '10' },
  { min: 15, color: '#fee090', label: '15' },
  { min: 20, color: '#fdae61', label: '20' },
  { min: 25, color: '#f46d43', label: '25' },
  { min: 30, color: '#d73027', label: '30' },
  { min: 35, color: '#a50026', label: '35+' },
];
export const tempColor = (c: number) => pick(TEMP_SCALE, c).color;
/** Readable text colour on top of a temperature fill. */
export const tempTextColor = (c: number) => (c < -5 || c >= 30 ? '#ffffff' : '#0f172a');

/** Wind speed (km/h) aligned with the Beaufort scale; warm hues from Beaufort 6. */
export const WIND_SCALE: ScaleStop[] = [
  { min: -Infinity, color: '#c6dbef', label: 'B0–2' },
  { min: 12, color: '#9ecae1', label: 'B3' },
  { min: 20, color: '#6baed6', label: 'B4' },
  { min: 29, color: '#3182bd', label: 'B5' },
  { min: 39, color: '#fdd049', label: 'B6' },
  { min: 50, color: '#fd8d3c', label: 'B7' },
  { min: 62, color: '#e6550d', label: 'B8' },
  { min: 75, color: '#c2185b', label: 'B9' },
  { min: 89, color: '#6a1b9a', label: 'B10+' },
];
export const windColor = (kmh: number) => pick(WIND_SCALE, kmh).color;

/** Readable text on a solid quake-magnitude fill. */
export const quakeTextColor = (mag: number) => (mag >= 5 ? '#ffffff' : '#0f172a');

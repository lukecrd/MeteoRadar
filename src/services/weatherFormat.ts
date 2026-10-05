// Shared formatting & meteorological conventions used across the app.

const MINUS = '−';

/**
 * Formats a temperature value. Negative values use the typographic minus,
 * positive values never get a forced "+" (avoids "+-5°C" and "+0°C").
 */
export function formatTemp(value: number | null | undefined, opts: { decimals?: number; unit?: boolean } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const { decimals = 0, unit = true } = opts;
  const rounded = Number(value.toFixed(decimals));
  const abs = Math.abs(rounded).toFixed(decimals);
  const sign = rounded < 0 ? MINUS : '';
  return `${sign}${abs}${unit ? '°C' : '°'}`;
}

/**
 * Meteorological wind direction is where the wind comes FROM.
 * Arrows/particles must show where it blows TO: direction + 180°.
 */
export function windFlowBearing(fromDeg: number): number {
  return (fromDeg + 180) % 360;
}

const ITALIAN_WIND_ROSE = ['Tramontana', 'Grecale', 'Levante', 'Scirocco', 'Ostro', 'Libeccio', 'Ponente', 'Maestrale'];
const COMPASS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

/** Traditional Italian wind name for a provenance direction (8-point rose). */
export function italianWindName(fromDeg: number): string {
  return ITALIAN_WIND_ROSE[Math.round((((fromDeg % 360) + 360) % 360) / 45) % 8];
}

/** 8-point compass label for a provenance direction (Italian abbreviations). */
export function compassLabel(fromDeg: number): string {
  return COMPASS_8[Math.round((((fromDeg % 360) + 360) % 360) / 45) % 8];
}

/**
 * RainViewer "Universal Blue" (color scheme 2) legend, taken from the official
 * color table (rainviewer.com/files/rainviewer_api_colors_table.csv).
 * mm/h derived with Marshall-Palmer Z = 200·R^1.6.
 */
export const RADAR_RAIN_LEGEND: Array<{ dbz: number; color: string; mmh: string }> = [
  { dbz: 15, color: '#88ddee', mmh: '0.3' },
  { dbz: 20, color: '#00a3e0', mmh: '0.6' },
  { dbz: 25, color: '#0077aa', mmh: '1.3' },
  { dbz: 30, color: '#005588', mmh: '2.7' },
  { dbz: 35, color: '#ffee00', mmh: '5.6' },
  { dbz: 40, color: '#ffaa00', mmh: '12' },
  { dbz: 45, color: '#ff4400', mmh: '24' },
  { dbz: 50, color: '#c10000', mmh: '49' },
  { dbz: 55, color: '#ffaaff', mmh: '100' },
  { dbz: 60, color: '#ff77ff', mmh: '205' },
  { dbz: 65, color: '#ffffff', mmh: '>400' },
];

export const RADAR_SNOW_LEGEND: Array<{ dbz: number; color: string }> = [
  { dbz: 15, color: '#9fdfff' },
  { dbz: 25, color: '#5f9fff' },
  { dbz: 35, color: '#3f7fff' },
  { dbz: 45, color: '#1f5fff' },
  { dbz: 55, color: '#003fff' },
];

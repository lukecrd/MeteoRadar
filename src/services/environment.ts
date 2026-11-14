// Pollen and sea-state readings straight from Open-Meteo (CORS-enabled, no key):
// no /api function needed, so the 12-function Vercel Hobby limit is untouched.

export const POLLEN_TYPES = [
  { key: 'grass_pollen', label: 'Graminacee' },
  { key: 'birch_pollen', label: 'Betulla' },
  { key: 'alder_pollen', label: 'Ontano' },
  { key: 'olive_pollen', label: 'Olivo' },
  { key: 'mugwort_pollen', label: 'Artemisia' },
  { key: 'ragweed_pollen', label: 'Ambrosia' },
] as const;

export const pollenUrl = (lat: number, lon: number) =>
  `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=${POLLEN_TYPES.map((p) => p.key).join(',')}`;

export const marineUrl = (lat: number, lon: number) =>
  `https://marine-api.open-meteo.com/v1/marine?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=wave_height,wave_direction,wave_period,sea_surface_temperature&timezone=auto`;

export type PollenLevel = 'assente' | 'basso' | 'moderato' | 'alto' | 'molto alto';

// shortcut: one generic grains/m³ scale for every species; per-species thresholds (e.g. ragweed is allergenic at far lower counts) if users ask
export function pollenLevel(grains: number): PollenLevel {
  if (grains < 1) return 'assente';
  if (grains < 10) return 'basso';
  if (grains < 50) return 'moderato';
  if (grains < 200) return 'alto';
  return 'molto alto';
}

/** Douglas sea scale (WMO) from significant wave height in metres. */
const DOUGLAS: Array<[number, string]> = [
  [0, 'Calmo'], [0.1, 'Quasi calmo'], [0.5, 'Poco mosso'], [1.25, 'Mosso'], [2.5, 'Molto mosso'],
  [4, 'Agitato'], [6, 'Molto agitato'], [9, 'Grosso'], [14, 'Molto grosso'],
];

export function seaState(waveHeightM: number): { force: number; label: string } {
  const force = DOUGLAS.findIndex(([max]) => waveHeightM <= max);
  return force === -1 ? { force: 9, label: 'Tempestoso' } : { force, label: DOUGLAS[force][1] };
}

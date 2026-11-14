import React from 'react';
import { Flower2, Waves } from 'lucide-react';
import { LocationInfo } from '../types';
import { usePolledJson } from '../hooks/usePolledJson';
import { POLLEN_TYPES, pollenUrl, marineUrl, pollenLevel, seaState, PollenLevel } from '../services/environment';

const REFRESH_MS = 30 * 60_000;

const LEVEL_COLOR: Record<PollenLevel, string> = {
  assente: 'text-fg-muted',
  basso: 'text-emerald-400',
  moderato: 'text-amber-400',
  alto: 'text-orange-500',
  'molto alto': 'text-rose-500',
};

const Header: React.FC<{ icon: React.ReactNode; title: string; subtitle: string }> = ({ icon, title, subtitle }) => (
  <div className="flex items-center gap-3 mb-4">
    {icon}
    <div className="min-w-0">
      <h2 className="font-display text-lg text-fg">{title}</h2>
      <p className="text-sm text-fg-muted">{subtitle}</p>
    </div>
  </div>
);

/** Pollen concentrations (Open-Meteo / CAMS, Europe only). */
export const PollenCard: React.FC<{ location: LocationInfo }> = ({ location }) => {
  const feed = usePolledJson<{ current?: Record<string, number | null> }>(
    pollenUrl(location.latitude, location.longitude),
    REFRESH_MS,
  );
  const current = feed.data?.current;
  const rows = POLLEN_TYPES.map((p) => ({ ...p, value: current?.[p.key] })).filter((r) => r.value != null);

  return (
    <div className="p-5 sm:p-6">
      <Header
        icon={<Flower2 className="w-5 h-5 text-fg-muted shrink-0" aria-hidden />}
        title="Pollini e allergeni"
        subtitle={`Concentrazione attuale a ${location.name} (granuli/m³)`}
      />
      {rows.length > 0 ? (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {rows.map((r) => {
            const level = pollenLevel(r.value!);
            return (
              <li key={r.key} className="hub-3d-subcard p-3">
                <div className="text-sm font-semibold text-fg">{r.label}</div>
                <div className="font-hud text-xl text-fg">{Math.round(r.value!)}</div>
                <div className={`text-xs font-semibold capitalize ${LEVEL_COLOR[level]}`}>{level}</div>
              </li>
            );
          })}
        </ul>
      ) : feed.isLoading ? (
        <div className="hub-skeleton h-24" aria-busy="true" />
      ) : (
        <p className="text-sm text-fg-muted" role="status">
          {feed.error ? 'Dati pollinici non disponibili al momento.' : 'Nessun dato pollinico per questa zona (copertura solo Europa).'}
        </p>
      )}
      <p className="text-xs text-fg-muted mt-4">Fonte: Copernicus CAMS via Open-Meteo</p>
    </div>
  );
};

interface MarineCurrent {
  wave_height: number | null;
  wave_direction: number | null;
  wave_period: number | null;
  sea_surface_temperature: number | null;
}

/** Sea state at the nearest marine grid cell (Open-Meteo Marine). */
export const SeaStateCard: React.FC<{ location: LocationInfo }> = ({ location }) => {
  const feed = usePolledJson<{ current?: MarineCurrent }>(marineUrl(location.latitude, location.longitude), REFRESH_MS);
  const c = feed.data?.current;
  // Inland points come back as HTTP 400 or all-null values: both mean "no sea here".
  const sea = c?.wave_height != null ? seaState(c.wave_height) : null;

  return (
    <div className="p-5 sm:p-6">
      <Header
        icon={<Waves className="w-5 h-5 text-fg-muted shrink-0" aria-hidden />}
        title="Stato del mare"
        subtitle={`Mare più vicino a ${location.name}`}
      />
      {sea && c ? (
        <>
          <div className="font-display text-2xl text-fg">{sea.label}</div>
          <div className="text-sm text-fg-muted mb-4">Forza {sea.force} della scala Douglas</div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Onda', `${c.wave_height!.toFixed(1)} m`],
              ['Periodo', c.wave_period != null ? `${c.wave_period.toFixed(0)} s` : '—'],
              ['Direzione', c.wave_direction != null ? `${Math.round(c.wave_direction)}°` : '—'],
              ['Acqua', c.sea_surface_temperature != null ? `${c.sea_surface_temperature.toFixed(1)} °C` : '—'],
            ].map(([label, value]) => (
              <div key={label} className="hub-3d-subcard p-3">
                <dt className="hub-label">{label}</dt>
                <dd className="font-hud text-lg text-fg">{value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : feed.isLoading ? (
        <div className="hub-skeleton h-24" aria-busy="true" />
      ) : (
        <p className="text-sm text-fg-muted" role="status">
          {feed.error && !feed.error.includes('400')
            ? 'Dati marini non disponibili al momento.'
            : 'Nessun dato marino: la località è lontana dal mare.'}
        </p>
      )}
      <p className="text-xs text-fg-muted mt-4">Fonte: Open-Meteo Marine</p>
    </div>
  );
};

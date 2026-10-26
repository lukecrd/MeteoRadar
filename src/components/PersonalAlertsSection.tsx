import React, { useState } from 'react';
import { BellRing, Loader2, MapPin, Plus, X } from 'lucide-react';
import { LocationInfo } from '../types';
import type { PersonalAlerts } from '../hooks/usePersonalAlerts';
import type { AlertRules } from '../alerts/personalAlerts';

interface Props {
  alerts: PersonalAlerts;
  currentLocation: LocationInfo;
  isDark: boolean;
}

/** id for a saved place: rounded coordinates, so the same city is not added twice. */
const placeId = (l: LocationInfo) => `${l.latitude.toFixed(2)},${l.longitude.toFixed(2)}`;

const ChipRow: React.FC<{
  label: string;
  value: number;
  options: number[];
  format: (v: number) => string;
  onChange: (v: number) => void;
}> = ({ label, value, options, format, onChange }) => (
  <div>
    <div className="text-xs text-slate-600 dark:text-slate-300 mb-1.5">{label}</div>
    <div className="grid grid-cols-4 gap-2" role="group" aria-label={label}>
      {[0, ...options].map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`py-1.5 rounded-lg text-xs font-bold border transition-colors ${
            value === v
              ? 'bg-teal-500 text-white dark:text-slate-950 border-teal-400'
              : 'bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
          }`}
        >
          {v === 0 ? 'No' : format(v)}
        </button>
      ))}
    </div>
  </div>
);

export const PersonalAlertsSection: React.FC<Props> = ({ alerts, currentLocation, isDark }) => {
  const { config, native } = alerts;
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const currentId = placeId(currentLocation);
  const hasCurrent = config.places.some((p) => p.id === currentId);
  const r = config.rules;
  const set = (patch: Partial<AlertRules>) => alerts.updateRules(patch);

  const toggle = async () => {
    if (config.enabled) return alerts.disable();
    const granted = await alerts.enable();
    setPermissionDenied(!granted);
  };

  const checkNow = async () => {
    setChecking(true);
    setCheckResult(await alerts.checkNow());
    setChecking(false);
  };

  return (
    <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
      <h3 className="text-xs font-bold text-teal-400 mb-3 flex items-center gap-2">
        <BellRing className="w-4 h-4" />
        Allerte personali
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Avvisami per i luoghi salvati</div>
            <div className="text-xs text-slate-500 dark:text-slate-300">
              {native
                ? 'Controllo ogni 15 minuti circa, anche ad app chiusa.'
                : "Controllo ogni 15 minuti mentre l'app è aperta. Ad app chiusa funziona solo nell'app Android."}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={config.enabled}
            aria-label="Allerte personali"
            onClick={toggle}
            className={`w-12 h-6 shrink-0 rounded-full p-1 transition-colors duration-200 ${config.enabled ? 'bg-teal-500' : 'bg-slate-400 dark:bg-slate-700'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white dark:bg-slate-950 transition-transform duration-200 ${config.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>

        {permissionDenied && (
          <p role="alert" className="text-xs text-rose-400">
            {native
              ? 'Notifiche non consentite. Attivale per WorldHub nelle impostazioni di Android, poi riprova.'
              : 'Il browser non consente le notifiche: le allerte compariranno dentro l’app.'}
          </p>
        )}

        <div>
          <div className="text-xs text-slate-600 dark:text-slate-300 mb-1.5">Luoghi</div>
          {config.places.length === 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Nessun luogo salvato. Aggiungi la città che stai guardando.</p>
          )}
          <ul className="flex flex-wrap gap-2 mb-2">
            {config.places.map((p) => (
              <li key={p.id} className="inline-flex items-center gap-1.5 h-8 pl-3 pr-1 rounded-full border border-slate-300 dark:border-slate-700 text-xs font-semibold">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                {p.name}
                <button
                  type="button"
                  onClick={() => alerts.removePlace(p.id)}
                  className="w-6 h-6 grid place-items-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
                  aria-label={`Rimuovi ${p.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={hasCurrent}
            onClick={() =>
              alerts.addPlace({ id: currentId, name: currentLocation.name, lat: currentLocation.latitude, lon: currentLocation.longitude })
            }
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold border border-slate-300 dark:border-slate-700 disabled:opacity-50 hover:border-slate-500"
          >
            <Plus className="w-3.5 h-3.5" />
            {hasCurrent ? `${currentLocation.name} è già salvata` : `Aggiungi ${currentLocation.name}`}
          </button>
        </div>

        <ChipRow label="Pioggia oltre" value={r.rainMmH} options={[2, 5, 10]} format={(v) => `${v} mm/h`} onChange={(v) => set({ rainMmH: v })} />
        <ChipRow label="Raffiche oltre" value={r.gustKmh} options={[50, 60, 80]} format={(v) => `${v} km/h`} onChange={(v) => set({ gustKmh: v })} />
        <ChipRow label="Temperatura oltre" value={r.heatC} options={[33, 35, 38]} format={(v) => `${v} °C`} onChange={(v) => set({ heatC: v })} />
        <ChipRow label="Terremoti di magnitudo almeno" value={r.quakeMinMag} options={[2.5, 3, 4]} format={(v) => `M${String(v).replace('.', ',')}`} onChange={(v) => set({ quakeMinMag: v })} />
        {r.quakeMinMag > 0 && (
          <div>
            <div className="text-xs text-slate-600 dark:text-slate-300 mb-1.5">Entro</div>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Distanza massima del terremoto">
              {[50, 100, 200].map((km) => (
                <button
                  key={km}
                  type="button"
                  aria-pressed={r.quakeRadiusKm === km}
                  onClick={() => set({ quakeRadiusKm: km })}
                  className={`py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    r.quakeRadiusKm === km
                      ? 'bg-teal-500 text-white dark:text-slate-950 border-teal-400'
                      : 'bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                  }`}
                >
                  {km} km
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-900 dark:text-white">
          Temporali previsti
          <input type="checkbox" checked={r.storms} onChange={(e) => set({ storms: e.target.checked })} className="w-4 h-4 accent-teal-500" />
        </label>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={checkNow}
            disabled={checking || !config.enabled || config.places.length === 0}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-bold bg-teal-500 text-white dark:text-slate-950 disabled:opacity-40"
          >
            {checking && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Controlla ora
          </button>
          {checkResult && (
            <span role="status" className="text-xs text-slate-600 dark:text-slate-300">
              {checkResult}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

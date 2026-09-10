import React, { useState } from 'react';
import {
  Zap,
  Droplets,
  X,
  Bell,
  ChevronDown,
  ChevronUp,
  VolumeX,
  EyeOff,
  AlertTriangle,
  Radio
} from 'lucide-react';
import { HumidityAlertState, LightningStrike } from '../types';

interface AlertBannerProps {
  humidityAlert: HumidityAlertState;
  onDismissHumidityAlert: () => void;
  closestStrike: LightningStrike | null;
  proximityThreshold: number;
  isLightningDismissed: boolean;
  onDismissLightningAlert: () => void;
  onSnoozeLightningAlert?: (minutes: number) => void;
  testToastMessage: string | null;
  onDismissTestToast: () => void;
  isDark: boolean;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  humidityAlert,
  onDismissHumidityAlert,
  closestStrike,
  proximityThreshold,
  isLightningDismissed,
  onDismissLightningAlert,
  onSnoozeLightningAlert,
  testToastMessage,
  onDismissTestToast,
  isDark
}) => {
  const [isLightningMinimized, setIsLightningMinimized] = useState(false);
  const [isHumidityMinimized, setIsHumidityMinimized] = useState(false);

  const isLightningAlert =
    !isLightningDismissed &&
    closestStrike !== null &&
    closestStrike.distanceKm <= proximityThreshold;

  // If nothing to show, return null
  if (!testToastMessage && !humidityAlert.isSpikeActive && !isLightningAlert) {
    return null;
  }

  return (
    <div
      id="floating-alert-banner-container"
      className="fixed bottom-5 right-4 sm:right-6 z-50 flex flex-col gap-2.5 max-w-md w-[calc(100vw-2rem)] sm:w-auto sm:min-w-[360px] pointer-events-none transition-all duration-300"
    >
      {/* 1. Test Toast Notification */}
      {testToastMessage && (
        <div
          id="toast-test-notification"
          className="pointer-events-auto p-4 rounded-2xl bg-teal-500 text-white shadow-2xl border border-teal-400 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-5 duration-300 backdrop-blur-md"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">Test Notifica Sistema</div>
              <div className="text-sm font-medium">{testToastMessage}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismissTestToast}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            title="Chiudi notifica"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Humidity Sudden Spike Alert */}
      {humidityAlert.isSpikeActive && (
        <>
          {isHumidityMinimized ? (
            /* Minimized Humidity Pill */
            <div
              id="humidity-alert-pill-minimized"
              className="pointer-events-auto px-3.5 py-2 rounded-2xl bg-rose-950/90 border border-rose-500/80 text-rose-200 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom-3 duration-200"
            >
              <div
                onClick={() => setIsHumidityMinimized(false)}
                className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors flex-1"
                title="Clicca per espandere l'avviso umidità"
              >
                <Droplets className="w-4 h-4 text-rose-400 animate-pulse shrink-0" />
                <span className="text-xs font-bold truncate">
                  Avviso Umidità ({humidityAlert.direction === 'rising' ? '+' : '-'}{humidityAlert.changeRate.toFixed(1)}%/h)
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsHumidityMinimized(false)}
                  className="p-1 rounded-lg hover:bg-white/15 text-rose-300 hover:text-white transition-colors"
                  title="Espandi avviso"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onDismissHumidityAlert}
                  className="p-1 rounded-lg hover:bg-white/15 text-rose-300 hover:text-white transition-colors"
                  title="Chiudi avviso"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Expanded Humidity Alert Card */
            <div
              id="humidity-alert-card-expanded"
              className="pointer-events-auto p-4 rounded-2xl bg-gradient-to-r from-rose-950/95 to-slate-950/95 text-white shadow-2xl border border-rose-500/80 flex flex-col gap-2.5 backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 mt-0.5 shrink-0 animate-pulse">
                    <Droplets className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                      <span>Avviso Sensore Igrometrico</span>
                      <span className="px-1.5 py-0.2 rounded bg-rose-500 text-white text-[9px] font-extrabold">
                        CRITICO
                      </span>
                    </div>
                    <div className="text-sm font-bold mt-0.5">{humidityAlert.message}</div>
                    <div className="text-xs text-slate-300 mt-1">
                      Tasso di variazione: {humidityAlert.changeRate > 0 ? '+' : ''}
                      {humidityAlert.changeRate.toFixed(1)}%/h. Possibile fronte convettivo.
                    </div>
                  </div>
                </div>

                {/* Minimize & Close Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsHumidityMinimized(true)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                    title="Abbassa / Minimizza avviso"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onDismissHumidityAlert}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                    title="Elimina / Chiudi avviso"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Bottom Quick Controls */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-500/20">
                <button
                  type="button"
                  onClick={() => setIsHumidityMinimized(true)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-slate-200 flex items-center gap-1 transition-colors"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Abbassa</span>
                </button>
                <button
                  type="button"
                  onClick={onDismissHumidityAlert}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1 transition-colors shadow-sm"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Elimina Avviso</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 3. Lightning Proximity Warning (With Dismiss & Minimize controls) */}
      {isLightningAlert && closestStrike && (
        <>
          {isLightningMinimized ? (
            /* Minimized Lightning Pill (Compact Floating Badge) */
            <div
              id="lightning-alert-pill-minimized"
              className={`pointer-events-auto px-3.5 py-2.5 rounded-2xl shadow-2xl border backdrop-blur-xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom-3 duration-200 ${
                closestStrike.distanceKm <= 5
                  ? 'bg-rose-950/95 border-rose-500/90 text-rose-100'
                  : 'bg-amber-950/95 border-amber-500/90 text-amber-100'
              }`}
            >
              <div
                onClick={() => setIsLightningMinimized(false)}
                className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity flex-1"
                title="Clicca per espandere l'avviso lampi"
              >
                <div
                  className={`p-1 rounded-lg shrink-0 ${
                    closestStrike.distanceKm <= 5 ? 'bg-rose-500/30 text-rose-300' : 'bg-amber-500/30 text-amber-300'
                  }`}
                >
                  <Zap className="w-4 h-4 fill-current animate-bounce" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black tracking-tight flex items-center gap-1.5">
                    <span>Allerta Lampi: {closestStrike.distanceKm} km</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase text-slate-950 ${
                        closestStrike.distanceKm <= 5 ? 'bg-rose-400' : 'bg-amber-400'
                      }`}
                    >
                      {closestStrike.distanceKm <= 5 ? 'Imminente' : 'In Avvicinamento'}
                    </span>
                  </span>
                </div>
              </div>

              {/* Action buttons on minimized pill */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  id="btn-expand-lightning-alert"
                  onClick={() => setIsLightningMinimized(false)}
                  className="p-1 rounded-lg hover:bg-white/15 transition-colors"
                  title="Espandi avviso per dettagli completi"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  id="btn-dismiss-lightning-alert-pill"
                  onClick={onDismissLightningAlert}
                  className="p-1 rounded-lg hover:bg-white/15 transition-colors"
                  title="Elimina e chiudi avviso"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Expanded Full Lightning Warning Card */
            <div
              id="lightning-alert-card-expanded"
              className={`pointer-events-auto p-4 rounded-3xl shadow-2xl border flex flex-col gap-3 backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-300 ${
                closestStrike.distanceKm <= 5
                  ? 'bg-rose-950/95 border-rose-500/90 text-rose-100'
                  : 'bg-amber-950/95 border-amber-500/90 text-amber-100'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2.5 rounded-2xl mt-0.5 shrink-0 shadow-lg ${
                      closestStrike.distanceKm <= 5
                        ? 'bg-rose-500/30 text-rose-300 shadow-rose-500/20'
                        : 'bg-amber-500/30 text-amber-300 shadow-amber-500/20'
                    }`}
                  >
                    <Zap className="w-5 h-5 fill-current animate-bounce" />
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                      <span>Allerta Radar Lampi</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-slate-950 text-[10px] font-black ${
                          closestStrike.distanceKm <= 5 ? 'bg-rose-400' : 'bg-amber-400'
                        }`}
                      >
                        {closestStrike.distanceKm <= 5 ? '< 5 KM IMMINENTE' : `${closestStrike.distanceKm} KM`}
                      </span>
                    </div>
                    <div className="text-sm font-bold mt-0.5 leading-snug">
                      {closestStrike.distanceKm <= 5
                        ? 'Scariche elettriche rilevate nelle immediate vicinanze!'
                        : `Attività elettrica convettiva rilevata a ${closestStrike.distanceKm} km.`}
                    </div>
                    <div className="text-xs opacity-90 mt-1 flex flex-wrap gap-2">
                      <span>Corrente: <strong>{closestStrike.peakCurrentKa} kA</strong></span>
                      <span>•</span>
                      <span>Direzione: <strong>{closestStrike.bearingDeg}°</strong></span>
                      <span>•</span>
                      <span>Tipo: <strong>{closestStrike.type === 'CG' ? 'Terra-Nube' : 'Nube-Nube'}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Header Actions: Minimize & Close */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    id="btn-minimize-lightning-alert"
                    onClick={() => setIsLightningMinimized(true)}
                    className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                    title="Abbassa / Riduci a barra"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    id="btn-dismiss-lightning-alert-header"
                    onClick={onDismissLightningAlert}
                    className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                    title="Elimina e chiudi avviso"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Bottom Quick Actions Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/15 text-xs">
                <div className="text-[11px] opacity-75">
                  Protezione automatica attiva
                </div>

                <div className="flex items-center gap-2">
                  {onSnoozeLightningAlert && (
                    <button
                      type="button"
                      id="btn-snooze-lightning-alert"
                      onClick={() => onSnoozeLightningAlert(15)}
                      className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold flex items-center gap-1 transition-colors"
                      title="Silenzia l'avviso per 15 minuti"
                    >
                      <VolumeX className="w-3.5 h-3.5" />
                      <span>Silenzia 15m</span>
                    </button>
                  )}

                  <button
                    type="button"
                    id="btn-lower-lightning-alert"
                    onClick={() => setIsLightningMinimized(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold flex items-center gap-1 transition-colors"
                    title="Riduci l'avviso a una piccola barra inferiore"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Abbassa</span>
                  </button>

                  <button
                    type="button"
                    id="btn-close-lightning-alert"
                    onClick={onDismissLightningAlert}
                    className={`px-3 py-1.5 rounded-xl font-black text-white flex items-center gap-1 transition-all shadow-md ${
                      closestStrike.distanceKm <= 5
                        ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                        : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                    }`}
                    title="Elimina definitivamente questo avviso"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Elimina Avviso</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

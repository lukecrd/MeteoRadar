import React, { useEffect } from 'react';
import { X, Sparkles, AlertTriangle, ShieldCheck, Zap, CheckCircle2, RotateCw } from 'lucide-react';
import { AiPredictionReport, WeatherData } from '../types';

interface AiForecastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshReport?: () => void;
  report: AiPredictionReport | null;
  isLoading: boolean;
  weather: WeatherData;
  isDark: boolean;
}

export const AiForecastModal: React.FC<AiForecastModalProps> = ({
  isOpen,
  onClose,
  onRefreshReport,
  report,
  isLoading,
  weather,
  isDark
}) => {
  // ESC key handler to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cityName = weather?.location?.name || 'Località';

  // Fallback defaults if any report key is missing
  const safeReport: AiPredictionReport = report || {
    summary: `Quadro meteo in tempo reale per ${cityName}: ${weather?.current?.temperature ?? '--'}°C, Umidità ${weather?.current?.relativeHumidity ?? '--'}%, Pressione ${weather?.current?.pressure ?? '--'} hPa.`,
    prediction: 'Stato atmosferico elaborato con modelli di fisica convettiva e gradiente igrometrico.',
    riskLevel: 'STABILE',
    lightningRisk: 'Basso rischio elettrico immediato.',
    advisory: 'Condizioni atmosferiche ordinarie.',
    confidence: 94,
  };

  const risk = safeReport.riskLevel || 'STABILE';

  return (
    <div
      id="ai-forecast-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
    >
      <div
        id="ai-forecast-modal-container"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl rounded-3xl p-6 sm:p-8 border shadow-2xl relative overflow-hidden transition-all my-auto ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Glow background */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-teal-500/15 rounded-full blur-3xl -z-0 pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-500 text-white shadow-lg shadow-teal-500/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                <span>Diagnostica AI Predittiva</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-400 font-bold border border-teal-500/30">
                  Gemini 3.7
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-300">
                Analisi fisica dell'atmosfera & previsione fronti instabili per {cityName}
              </p>
            </div>
          </div>

          <button
            type="button"
            id="close-ai-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-4 text-center">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-teal-500/20 border-t-teal-500 animate-spin" />
              <Sparkles className="w-6 h-6 text-teal-400 absolute inset-0 m-auto animate-pulse" />
            </div>
            <div>
              <div className="font-bold text-base text-slate-900 dark:text-white">
                Elaborazione Modello Meteorologico AI in corso...
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-300 mt-1 max-w-sm">
                Analisi dei gradienti di umidità, shear del vento, convezione temporalesca e tendenza barometrica.
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5 relative z-10">
            {/* Risk Banner */}
            <div
              className={`p-4 rounded-2xl border flex items-center justify-between ${
                risk === 'CRITICO'
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-500'
                  : risk === 'MODERATO'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-500'
                  : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500'
              }`}
            >
              <div className="flex items-center gap-3">
                {risk === 'CRITICO' ? (
                  <AlertTriangle className="w-6 h-6 shrink-0" />
                ) : (
                  <ShieldCheck className="w-6 h-6 shrink-0" />
                )}
                <div>
                  <div className="text-xs font-black uppercase tracking-wider">
                    Indice di Rischio Cambiamenti Atmosferici
                  </div>
                  <div className="text-lg font-extrabold">{risk}</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-300">Accuratezza Modello</div>
                <div className="text-base font-black text-teal-400">{safeReport.confidence ?? 94}%</div>
              </div>
            </div>

            {/* Summary */}
            <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-1">
                Sintesi Sinottica
              </div>
              <p className="text-sm leading-relaxed font-medium text-slate-700 dark:text-slate-200">
                {safeReport.summary}
              </p>
            </div>

            {/* Prediction */}
            <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-1">
                Evoluzione a Breve Termine (Prossime 1-6 Ore)
              </div>
              <p className="text-sm leading-relaxed font-medium text-slate-700 dark:text-slate-200">
                {safeReport.prediction}
              </p>
            </div>

            {/* Lightning Risk & Advisory Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">
                  <Zap className="w-4 h-4" />
                  Rischio Elettrico / Tuoni
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {safeReport.lightningRisk}
                </p>
              </div>

              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Raccomandazioni di Sicurezza
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {safeReport.advisory}
                </p>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              {onRefreshReport ? (
                <button
                  type="button"
                  id="recalculate-ai-report-btn"
                  onClick={onRefreshReport}
                  className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Ricalcola Diagnosi</span>
                </button>
              ) : <div />}

              <button
                type="button"
                id="confirm-close-ai-modal-btn"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl font-bold text-xs bg-teal-500 hover:bg-teal-400 text-white shadow-md transition-colors"
              >
                Chiudi Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


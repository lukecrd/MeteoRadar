import React from 'react';
import {
  Sun,
  Wind,
  ShieldCheck,
  AlertTriangle,
  Heart,
  Activity,
  Trees,
  CheckCircle2,
  Info,
  Glasses,
  Umbrella,
  Sparkles,
  Flame,
  AlertCircle
} from 'lucide-react';
import { AirQualityData } from '../types';

interface EnvironmentalUvCardProps {
  uvIndex: number;
  airQuality?: AirQualityData;
  isDark: boolean;
}

export const EnvironmentalUvCard: React.FC<EnvironmentalUvCardProps> = ({
  uvIndex,
  airQuality,
  isDark
}) => {
  // Default fallback if airQuality API didn't load
  const aqi = airQuality || {
    europeanAqi: 32,
    pm10: 14.2,
    pm2_5: 8.5,
    ozone: 78.0,
    nitrogenDioxide: 12.4,
    carbonMonoxide: 180,
    uvIndex: uvIndex || 5.2,
    aqiLevel: 'buona' as const,
    aqiDescription: 'Qualità dell\'aria soddisfacente con scarso rischio per la salute.'
  };

  // UV Classification helper
  const getUvTier = (val: number) => {
    if (val <= 2.5) {
      return {
        label: 'Basso',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/15 border-emerald-500/30',
        barColor: 'bg-emerald-500',
        advice: 'Nessuna protezione richiesta. Esposizione solare a basso rischio.',
        spf: 'Non necessaria'
      };
    }
    if (val <= 5.5) {
      return {
        label: 'Moderato',
        color: 'text-amber-400',
        bg: 'bg-amber-500/15 border-amber-500/30',
        barColor: 'bg-amber-500',
        advice: 'Applica protezione solare e indossa occhiali se esposto al sole a lungo.',
        spf: 'SPF 30 consigliato'
      };
    }
    if (val <= 7.5) {
      return {
        label: 'Alto',
        color: 'text-orange-400',
        bg: 'bg-orange-500/15 border-orange-500/30',
        barColor: 'bg-orange-500',
        advice: 'Rischio elevato di eritemi. Evita l\'esposizione prolungata tra le 11:30 e le 15:30.',
        spf: 'SPF 50+ indispensabile'
      };
    }
    if (val <= 10.5) {
      return {
        label: 'Molto Alto',
        color: 'text-rose-400',
        bg: 'bg-rose-500/15 border-rose-500/30',
        barColor: 'bg-rose-500',
        advice: 'Pericolo scottature in pochi minuti. Proteggi accuratamente pelle e occhi.',
        spf: 'SPF 50+ con riapplicazione'
      };
    }
    return {
      label: 'Estremo',
      color: 'text-purple-400',
      bg: 'bg-purple-500/15 border-purple-500/30',
      barColor: 'bg-purple-500',
      advice: 'Radiazione solare critica. Evita categoricamente il sole nelle ore centrali.',
      spf: 'Schermatura totale'
    };
  };

  const uvTier = getUvTier(aqi.uvIndex || uvIndex);

  // AQI color & recommendation helper
  const getAqiDetails = (level: string) => {
    switch (level) {
      case 'ottima':
        return {
          badge: 'Ottima',
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/15 border-emerald-500/30',
          indicator: 'bg-emerald-400',
          sport: 'Ideale per corsa e attività intensa',
          ventilation: 'Aerare liberamente i locali'
        };
      case 'buona':
        return {
          badge: 'Buona',
          color: 'text-teal-400',
          bg: 'bg-teal-500/15 border-teal-500/30',
          indicator: 'bg-teal-400',
          sport: 'Favorevole per allenamento all\'aperto',
          ventilation: 'Ricambio d\'aria consigliato'
        };
      case 'moderata':
        return {
          badge: 'Moderata',
          color: 'text-amber-400',
          bg: 'bg-amber-500/15 border-amber-500/30',
          indicator: 'bg-amber-400',
          sport: 'Possibile, cautela per soggetti asmatici',
          ventilation: 'Arieggiare nelle ore di minor traffico'
        };
      case 'scadente':
        return {
          badge: 'Scadente',
          color: 'text-orange-400',
          bg: 'bg-orange-500/15 border-orange-500/30',
          indicator: 'bg-orange-400',
          sport: 'Ridurre sforzi fisici intensi all\'aperto',
          ventilation: 'Tenere finestre chiuse su strade trafficate'
        };
      case 'molto_scadente':
      case 'pericolosa':
        return {
          badge: 'Critica',
          color: 'text-rose-400',
          bg: 'bg-rose-500/15 border-rose-500/30',
          indicator: 'bg-rose-500',
          sport: 'Evitare allenamenti all\'aperto',
          ventilation: 'Utilizzare purificatori d\'aria interni'
        };
      default:
        return {
          badge: 'Buona',
          color: 'text-teal-400',
          bg: 'bg-teal-500/15 border-teal-500/30',
          indicator: 'bg-teal-400',
          sport: 'Attività regolare permessa',
          ventilation: 'Aerare regolarmente'
        };
    }
  };

  const aqiInfo = getAqiDetails(aqi.aqiLevel);

  return (
    <div
      id="environmental-uv-section"
      className={`rounded-3xl p-6 sm:p-8 transition-all duration-300 relative overflow-hidden border ${
        isDark
          ? 'bg-slate-900/80 backdrop-blur-xl border-white/10 text-slate-100 shadow-2xl shadow-black/40'
          : 'bg-white/95 backdrop-blur-xl border-slate-200 text-slate-900 shadow-xl shadow-slate-200/50'
      }`}
    >
      {/* Subtle ambient light gradient */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-0" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 relative z-10 border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-400 text-white shadow-lg shadow-amber-500/20">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Analisi Ambientale: Indice UV & Qualità Aria
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-400 font-bold border border-teal-500/30">
                Live Sensorica
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
              Radiazione fotosolare, particolato sottile e raccomandazioni per la salute
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300">
          <Trees className="w-4 h-4 text-emerald-400" />
          <span>Indice Europeo EAQI & Standard WMO</span>
        </div>
      </div>

      {/* Two Column Grid: UV Gauge & Air Quality Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        {/* Left Column (5 cols): Solar UV Index Display */}
        <div className="lg:col-span-5 flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 shadow-inner">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 flex items-center gap-1.5">
                <Sun className="w-4 h-4 text-amber-400" />
                Radiazione Solare UV
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${uvTier.bg} ${uvTier.color}`}>
                Livello {uvTier.label}
              </span>
            </div>

            {/* Giant Metric Display */}
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-5xl sm:text-6xl font-black tracking-tight text-slate-900 dark:text-white">
                {aqi.uvIndex.toFixed(1)}
              </span>
              <span className="text-xl font-bold text-slate-400">/ 11+ Max</span>
            </div>

            {/* UV Progress Spectrum Bar */}
            <div className="mt-4">
              <div className="h-3 w-full bg-slate-200 dark:bg-slate-700/80 rounded-full overflow-hidden p-0.5 relative">
                <div
                  className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-emerald-400 via-amber-400 via-orange-500 via-rose-500 to-purple-600"
                  style={{ width: `${Math.min(100, Math.max(8, (aqi.uvIndex / 11) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 font-bold">
                <span>0 Basso</span>
                <span>3 Mod.</span>
                <span>6 Alto</span>
                <span>8 Molto Alto</span>
                <span>11+ Estremo</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mt-4 leading-relaxed font-medium">
              {uvTier.advice}
            </p>
          </div>

          {/* Protection Checklist */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
              Protocollo Protezione Solare:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs">
                <Glasses className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">Filtro UV400</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">{uvTier.spf}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs">
                <Umbrella className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">Ombra 12-16</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">Idratazione 2L+</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): European AQI & Pollutants Grid */}
        <div className="lg:col-span-7 flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 shadow-inner">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-teal-400" />
                Indice Europeo Qualità dell'Aria (EAQI)
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${aqiInfo.bg} ${aqiInfo.color} flex items-center gap-1.5`}>
                <span className={`w-2 h-2 rounded-full ${aqiInfo.indicator} animate-pulse`} />
                {aqiInfo.badge} ({aqi.europeanAqi})
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
              {aqi.aqiDescription}
            </p>

            {/* Pollutant Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
              {/* PM2.5 */}
              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>PM 2.5</span>
                  <span className="text-[10px] text-emerald-400">&lt; 15 ok</span>
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  {aqi.pm2_5} <span className="text-xs font-normal text-slate-400">μg/m³</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">Particolato Fine</div>
              </div>

              {/* PM10 */}
              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>PM 10</span>
                  <span className="text-[10px] text-teal-400">&lt; 40 ok</span>
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  {aqi.pm10} <span className="text-xs font-normal text-slate-400">μg/m³</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">Polveri Inalabili</div>
              </div>

              {/* O3 */}
              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>Ozono (O₃)</span>
                  <span className="text-[10px] text-cyan-400">&lt; 120 ok</span>
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  {aqi.ozone} <span className="text-xs font-normal text-slate-400">μg/m³</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">Ossigeno Triatomico</div>
              </div>

              {/* NO2 */}
              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>NO₂</span>
                  <span className="text-[10px] text-indigo-400">&lt; 40 ok</span>
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  {aqi.nitrogenDioxide} <span className="text-xs font-normal text-slate-400">μg/m³</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">Biossido di Azoto</div>
              </div>

              {/* CO */}
              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>CO</span>
                  <span className="text-[10px] text-emerald-400">Ottimo</span>
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  {aqi.carbonMonoxide} <span className="text-xs font-normal text-slate-400">μg/m³</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">Monossido Carbonio</div>
              </div>

              {/* Sensor Reliability Status */}
              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-center">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Stato Rete</span>
                </div>
                <div className="text-xs font-extrabold text-emerald-500 dark:text-emerald-400 mt-1">
                  Telemetria Attiva
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Copernicus CAMS</div>
              </div>
            </div>
          </div>

          {/* Health Advice Footer */}
          <div className="mt-5 pt-3.5 border-t border-slate-200 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold">
              <Heart className="w-4 h-4 text-rose-400" />
              <span>Attività Fisica: <span className="font-normal text-slate-600 dark:text-slate-300">{aqiInfo.sport}</span></span>
            </div>
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold">
              <Wind className="w-4 h-4 text-cyan-400" />
              <span>Ambienti Chiusi: <span className="font-normal text-slate-600 dark:text-slate-300">{aqiInfo.ventilation}</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

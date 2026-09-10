import React, { useState } from 'react';
import {
  Calendar,
  Sun,
  SunMedium,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudLightning,
  Droplets,
  Wind,
  Compass,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';
import { DailyForecastItem, HourlyForecastItem } from '../types';
import { getWindDirectionLabel } from '../services/weatherApi';

interface ForecastFiveDaysProps {
  daily: DailyForecastItem[];
  hourly?: HourlyForecastItem[];
  isDark: boolean;
}

export const ForecastFiveDays: React.FC<ForecastFiveDaysProps> = ({
  daily,
  hourly = [],
  isDark
}) => {
  // Take exactly 5 days for the 5-day forecast
  const fiveDays = daily.slice(0, 5);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);

  const selectedDay = fiveDays[selectedDayIndex] || fiveDays[0];

  // Helper for weather icons
  const getWeatherIcon = (code: number, sizeClass = 'w-8 h-8') => {
    if (code === 0) return <Sun className={`${sizeClass} text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]`} />;
    if (code === 1) return <SunMedium className={`${sizeClass} text-amber-300`} />;
    if (code === 2) return <CloudSun className={`${sizeClass} text-amber-300`} />;
    if (code === 3) return <Cloud className={`${sizeClass} text-slate-300`} />;
    if (code >= 45 && code <= 48) return <CloudFog className={`${sizeClass} text-teal-300`} />;
    if (code >= 51 && code <= 55) return <CloudDrizzle className={`${sizeClass} text-sky-400`} />;
    if (code >= 61 && code <= 65) return <CloudRain className={`${sizeClass} text-sky-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]`} />;
    if (code >= 71 && code <= 75) return <CloudSnow className={`${sizeClass} text-cyan-200`} />;
    if (code >= 80 && code <= 82) return <CloudRainWind className={`${sizeClass} text-sky-400`} />;
    if (code >= 95) return <CloudLightning className={`${sizeClass} text-amber-300 animate-pulse drop-shadow-[0_0_12px_rgba(251,191,36,0.7)]`} />;
    return <CloudSun className={`${sizeClass} text-amber-300`} />;
  };

  // Helper for formatted day label
  const getFullDayName = (dateStr: string, idx: number) => {
    if (idx === 0) return 'Oggi';
    if (idx === 1) return 'Domani';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('it-IT', { weekday: 'long' });
    } catch {
      return `Giorno ${idx + 1}`;
    }
  };

  const getFormattedDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  // Min and max across all 5 days for the relative bar
  const globalMin = Math.min(...fiveDays.map((d) => d.minTemp), 0);
  const globalMax = Math.max(...fiveDays.map((d) => d.maxTemp), 35);
  const tempRange = Math.max(1, globalMax - globalMin);

  return (
    <div
      id="five-day-forecast-section"
      className={`rounded-2xl p-6 transition-all duration-300 border ${
        isDark
          ? 'bg-slate-900/90 border-slate-800/90 text-slate-100 shadow-xl shadow-black/30'
          : 'bg-white/95 border-slate-200 text-slate-900 shadow-lg shadow-slate-200/50'
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-500/15 text-teal-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Previsioni a 5 Giorni
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                PROSSIMI 5 GIORNI
              </span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Evoluzione termica, precipitazioni, vento e indici atmosferici giornalieri
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-300">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Aggiornamento ECMWF & GFS</span>
        </div>
      </div>

      {/* 5-Day Interactive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 mb-6">
        {fiveDays.map((day, idx) => {
          const isSelected = selectedDayIndex === idx;
          const dayName = getFullDayName(day.date, idx);
          const dateFormatted = getFormattedDate(day.date);

          // Calculate temperature range bar percentages
          const leftPercent = Math.max(0, ((day.minTemp - globalMin) / tempRange) * 100);
          const barWidthPercent = Math.max(12, (((day.maxTemp - day.minTemp) || 4) / tempRange) * 100);

          return (
            <button
              key={`day-${day.date}-${idx}`}
              onClick={() => setSelectedDayIndex(idx)}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 relative overflow-hidden flex flex-col justify-between group ${
                isSelected
                  ? isDark
                    ? 'bg-gradient-to-b from-slate-800 to-slate-850 border-teal-500/80 shadow-lg shadow-teal-500/10 ring-2 ring-teal-500/50'
                    : 'bg-teal-50/70 border-teal-500 shadow-md ring-2 ring-teal-500/40'
                  : isDark
                  ? 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600 text-slate-200'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300 text-slate-800'
              }`}
            >
              {/* Day & Date Header */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-black uppercase tracking-wider capitalize ${
                    isSelected ? 'text-teal-400 dark:text-teal-300' : 'text-slate-700 dark:text-slate-200'
                  }`}>
                    {dayName}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                    {dateFormatted}
                  </span>
                </div>

                {/* Weather Icon & Condition */}
                <div className="my-3 flex items-center justify-between">
                  <div className="p-2 rounded-xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60">
                    {getWeatherIcon(day.weatherCode, 'w-7 h-7')}
                  </div>
                  
                  {/* Rain badge if rain > 0 */}
                  {day.precipitationProbability > 0 ? (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/30 text-xs font-bold">
                      <Droplets className="w-3 h-3 text-sky-400" />
                      <span>{day.precipitationProbability}%</span>
                    </div>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                      Sereno (0%)
                    </span>
                  )}
                </div>

                <div className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 mb-3">
                  {day.weatherDescription}
                </div>
              </div>

              {/* Temperatures and Range Bar */}
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-amber-500 dark:text-amber-400">
                      +{day.maxTemp}°
                    </span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-300">Max</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-bold text-cyan-500 dark:text-cyan-300">
                      +{day.minTemp}°
                    </span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-300">Min</span>
                  </div>
                </div>

                {/* Visual Temperature Bar */}
                <div className="w-full bg-slate-200/80 dark:bg-slate-700/60 h-1.5 rounded-full overflow-hidden relative">
                  <div
                    className="absolute h-full rounded-full bg-gradient-to-r from-cyan-400 via-teal-400 to-amber-400"
                    style={{
                      left: `${leftPercent}%`,
                      width: `${barWidthPercent}%`,
                    }}
                  />
                </div>

                {/* Wind snippet */}
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/40 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1">
                    <Wind className="w-3 h-3 text-teal-400" />
                    <span>{day.maxWindSpeed} km/h</span>
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    UV {day.uvMax}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Day Deep Dive Panel */}
      {selectedDay && (
        <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          isDark
            ? 'bg-slate-800/60 border-slate-700/80 text-slate-100'
            : 'bg-slate-50 border-slate-200 text-slate-900'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-teal-500/15 text-teal-400">
                {getWeatherIcon(selectedDay.weatherCode, 'w-6 h-6')}
              </div>
              <div>
                <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                  Dettaglio Previsione: <span className="capitalize text-teal-400">{getFullDayName(selectedDay.date, selectedDayIndex)}</span> ({getFormattedDate(selectedDay.date)})
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {selectedDay.weatherDescription} • Escursione termica: <span className="font-bold text-slate-800 dark:text-slate-100">{selectedDay.maxTemp - selectedDay.minTemp}°C</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold">
                Max: +{selectedDay.maxTemp}°C
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold">
                Min: +{selectedDay.minTemp}°C
              </span>
            </div>
          </div>

          {/* 4 Multi-Metric Cards for the Selected Day */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className={`p-3 rounded-xl border ${
              isDark ? 'bg-slate-900/60 border-slate-700/60' : 'bg-white border-slate-200'
            }`}>
              <div className="text-slate-500 dark:text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-sky-400" />
                <span>Rischio Pioggia</span>
              </div>
              <div className="text-lg font-black text-sky-400">
                {selectedDay.precipitationProbability}%
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5">
                {selectedDay.precipitationProbability > 50
                  ? 'Precipitazioni probabili'
                  : selectedDay.precipitationProbability > 20
                  ? 'Possibilità di rovesci'
                  : 'Condizioni asciutte'}
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${
              isDark ? 'bg-slate-900/60 border-slate-700/60' : 'bg-white border-slate-200'
            }`}>
              <div className="text-slate-500 dark:text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-teal-400" />
                <span>Vento Massimo</span>
              </div>
              <div className="text-lg font-black text-slate-900 dark:text-white">
                {selectedDay.maxWindSpeed} <span className="text-xs font-normal">km/h</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5">
                {getWindDirectionLabel(selectedDay.dominantWindDirection)}
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${
              isDark ? 'bg-slate-900/60 border-slate-700/60' : 'bg-white border-slate-200'
            }`}>
              <div className="text-slate-500 dark:text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Indice UV Max</span>
              </div>
              <div className="text-lg font-black text-amber-400">
                {selectedDay.uvMax} <span className="text-xs font-normal">/ 11</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5">
                {selectedDay.uvMax > 7 ? 'Molto Alto (Protezione)' : selectedDay.uvMax > 4 ? 'Moderato' : 'Basso'}
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${
              isDark ? 'bg-slate-900/60 border-slate-700/60' : 'bg-white border-slate-200'
            }`}>
              <div className="text-slate-500 dark:text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Attività all'Aperto</span>
              </div>
              <div className="text-lg font-black text-emerald-400">
                {selectedDay.precipitationProbability > 60
                  ? 'Sconsigliate'
                  : selectedDay.precipitationProbability > 30
                  ? 'Variabili'
                  : 'Favorevoli'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5">
                Indice outdoor
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

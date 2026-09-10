import React, { useState } from 'react';
import {
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
  Eye,
  Gauge,
  Droplets,
  Sparkles,
  MapPin,
  RefreshCw,
  Compass,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  Clock,
  Wind,
  Zap
} from 'lucide-react';
import { WeatherData, WeatherAlertInfo } from '../types';

interface WeatherHeroProps {
  weather: WeatherData;
  isDark: boolean;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenAiReport: () => void;
}

export const WeatherHero: React.FC<WeatherHeroProps> = ({
  weather,
  isDark,
  isLoading,
  onRefresh,
  onOpenAiReport
}) => {
  const { current, location, hourly = [], daily = [], alerts = [], lastUpdated } = weather;
  const [selectedAlertIdx, setSelectedAlertIdx] = useState<number>(0);
  const [isAlertExpanded, setIsAlertExpanded] = useState<boolean>(false);

  // Today's min and max
  const todayDaily = daily[0];
  const todayMin = todayDaily ? todayDaily.minTemp : Math.round(current.temperature - 4);
  const todayMax = todayDaily ? todayDaily.maxTemp : Math.round(current.temperature + 5);

  // Primary alert
  const activeAlert = alerts[selectedAlertIdx] || alerts[0];

  // Helper for weather icons
  const getWeatherIcon = (code: number, size = 'w-16 h-16') => {
    if (code === 0) return <Sun className={`${size} text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.6)]`} />;
    if (code === 1) return <SunMedium className={`${size} text-amber-300 drop-shadow-[0_0_15px_rgba(252,211,77,0.5)]`} />;
    if (code === 2) return <CloudSun className={`${size} text-amber-300 drop-shadow-[0_0_15px_rgba(252,211,77,0.4)]`} />;
    if (code === 3) return <Cloud className={`${size} text-slate-300 drop-shadow-[0_0_15px_rgba(203,213,225,0.3)]`} />;
    if (code >= 45 && code <= 48) return <CloudFog className={`${size} text-teal-300`} />;
    if (code >= 51 && code <= 55) return <CloudDrizzle className={`${size} text-sky-400`} />;
    if (code >= 61 && code <= 65) return <CloudRain className={`${size} text-sky-400 drop-shadow-[0_0_20px_rgba(56,189,248,0.6)]`} />;
    if (code >= 71 && code <= 75) return <CloudSnow className={`${size} text-indigo-200`} />;
    if (code >= 80 && code <= 82) return <CloudRainWind className={`${size} text-sky-500`} />;
    if (code >= 95) return <CloudLightning className={`${size} text-amber-300 animate-pulse drop-shadow-[0_0_25px_rgba(251,191,36,0.9)]`} />;
    return <CloudSun className={`${size} text-amber-300`} />;
  };

  // Alert styling helper
  const getAlertColor = (level: string) => {
    switch (level) {
      case 'red':
        return {
          badge: 'Allerta Rossa (Criticità Elevata)',
          border: 'border-rose-500/50',
          bg: 'bg-rose-500/15',
          text: 'text-rose-400',
          indicator: 'bg-rose-500',
          icon: AlertTriangle
        };
      case 'orange':
        return {
          badge: 'Allerta Arancione (Criticità Moderata)',
          border: 'border-orange-500/50',
          bg: 'bg-orange-500/15',
          text: 'text-orange-400',
          indicator: 'bg-orange-500',
          icon: AlertTriangle
        };
      case 'yellow':
        return {
          badge: 'Allerta Gialla (Ordinaria / Attenzione)',
          border: 'border-amber-500/50',
          bg: 'bg-amber-500/15',
          text: 'text-amber-400',
          indicator: 'bg-amber-500',
          icon: ShieldAlert
        };
      default:
        return {
          badge: 'Verde (Nessuna Criticità)',
          border: 'border-emerald-500/30',
          bg: 'bg-emerald-500/10',
          text: 'text-emerald-400',
          indicator: 'bg-emerald-500',
          icon: ShieldCheck
        };
    }
  };

  const alertStyle = activeAlert ? getAlertColor(activeAlert.level) : getAlertColor('green');
  const AlertIcon = alertStyle.icon;

  return (
    <div
      id="weather-hero-card"
      className={`rounded-3xl p-6 sm:p-8 transition-all duration-300 relative overflow-hidden border ${
        isDark
          ? 'bg-slate-900/80 backdrop-blur-xl border-white/10 text-slate-100 shadow-2xl shadow-black/50'
          : 'bg-white/95 backdrop-blur-xl border-slate-200 text-slate-900 shadow-xl shadow-slate-200/60'
      }`}
    >
      {/* Decorative Atmospheric Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/15 rounded-full blur-3xl pointer-events-none -z-0" />

      {/* Top Header: Location, Badges & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 relative z-10 border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-teal-500/15 text-teal-400 border border-teal-500/30 shadow-inner">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                {location.name}
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border border-slate-300 dark:border-slate-700">
                {location.country} {location.admin1 ? `• ${location.admin1}` : ''}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-400 font-bold border border-teal-500/30">
                Stazione Live
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5 font-medium flex items-center gap-2">
              <span>Aggiornato alle {lastUpdated}</span>
              <span>•</span>
              <span className="text-teal-500 dark:text-teal-400 font-semibold">Coordinate: {location.latitude.toFixed(2)}°N, {location.longitude.toFixed(2)}°E</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="open-ai-report-btn"
            onClick={(e) => {
              e.preventDefault();
              onOpenAiReport();
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 hover:from-teal-400 hover:to-cyan-400 text-white shadow-lg shadow-teal-500/25 transition-transform active:scale-95"
            title="Diagnostica previsionale AI avanzata Gemini"
          >
            <Sparkles className="w-4 h-4 animate-spin" style={{ animationDuration: '4s' }} />
            <span>Diagnostica AI</span>
          </button>

          <button
            id="refresh-weather-btn"
            onClick={onRefresh}
            disabled={isLoading}
            className={`p-2.5 rounded-xl border transition-colors ${
              isDark
                ? 'border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200'
                : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
            }`}
            title="Ricarica dati meteo e telemetria"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Temperature & Weather Display */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
        {/* Left: Giant Temp & Condition & Min/Max */}
        <div className="lg:col-span-7 flex flex-wrap sm:flex-nowrap items-center gap-6">
          <div className="shrink-0 p-4 rounded-3xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 shadow-xl">
            {getWeatherIcon(current.weatherCode)}
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-6xl sm:text-7xl font-black tracking-tighter text-slate-900 dark:text-white">
                {current.temperature > 0 ? `+${current.temperature}` : current.temperature}
              </span>
              <span className="text-4xl font-light text-cyan-400">°C</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 mt-1 flex items-center gap-2">
              <span>{current.weatherDescription}</span>
            </div>
            
            {/* Min / Max & Perceived Range Bar */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700">
                Percepita: <span className="font-bold text-slate-900 dark:text-white">{current.apparentTemperature}°C</span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 flex items-center gap-1.5">
                <span className="text-cyan-400 font-bold">Min {todayMin}°</span>
                <span className="text-slate-400">•</span>
                <span className="text-amber-400 font-bold">Max {todayMax}°</span>
              </span>
              {todayDaily && (
                <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/30">
                  Pioggia: {todayDaily.precipitationProbability}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Key Atmospheric Metrics Grid */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-3">
          {/* Umidità */}
          <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700/60' : 'bg-white/80 border-slate-200'} shadow-sm`}>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-semibold">
              <Droplets className="w-3.5 h-3.5 text-cyan-400" />
              <span>Umidità Rel.</span>
            </div>
            <div className="text-2xl font-black mt-1 text-cyan-500 dark:text-cyan-300">{current.relativeHumidity}%</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-300">Punto rugiada {current.dewPoint}°C</div>
          </div>

          {/* Pressione */}
          <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700/60' : 'bg-white/80 border-slate-200'} shadow-sm`}>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-semibold">
              <Gauge className="w-3.5 h-3.5 text-indigo-400" />
              <span>Pressione Atm.</span>
            </div>
            <div className="text-2xl font-black mt-1 text-slate-900 dark:text-white">
              {current.pressure} <span className="text-xs font-normal">hPa</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-300">
              {current.pressure < 1010 ? 'Bassa (Depressione)' : current.pressure > 1020 ? 'Alta (Anticiclone)' : 'Pressione Stabile'}
            </div>
          </div>

          {/* Indice UV */}
          <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700/60' : 'bg-white/80 border-slate-200'} shadow-sm`}>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-semibold">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>Indice UV</span>
            </div>
            <div className="text-2xl font-black mt-1 text-amber-500 dark:text-amber-300">
              {current.uvIndex} <span className="text-xs font-normal text-slate-400">/ 11</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-300">
              {current.uvIndex > 6 ? 'Esposizione Alta' : current.uvIndex > 3 ? 'Esposizione Moderata' : 'Basso'}
            </div>
          </div>

          {/* Vento & Raffiche */}
          <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700/60' : 'bg-white/80 border-slate-200'} shadow-sm`}>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-semibold">
              <Wind className="w-3.5 h-3.5 text-teal-400" />
              <span>Vento & Raffiche</span>
            </div>
            <div className="text-2xl font-black mt-1 text-slate-900 dark:text-white">
              {current.windSpeed} <span className="text-xs font-normal">km/h</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-300 truncate">
              Raffiche fino a {current.windGusts} km/h
            </div>
          </div>
        </div>
      </div>

      {/* Protezione Civile & Severe Weather Alert Section (matching meteo_oggi_condizioni_e_allerte) */}
      {activeAlert && (
        <div
          className={`mt-6 p-4 sm:p-5 rounded-2xl border ${alertStyle.border} ${alertStyle.bg} transition-all relative z-10`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl bg-slate-900/60 border ${alertStyle.border} ${alertStyle.text} shrink-0 mt-0.5`}>
                <AlertIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${alertStyle.border} ${alertStyle.text} bg-slate-950/40`}>
                    {alertStyle.badge}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {activeAlert.issuer} • Valida fino a: {activeAlert.validTo}
                  </span>
                </div>
                <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mt-1">
                  {activeAlert.title}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {activeAlert.description}
                </p>
                {isAlertExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-300">
                    <p className="font-bold text-amber-300 mb-1">Indicazioni di sicurezza per la popolazione:</p>
                    <p>{activeAlert.instructions}</p>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAlertExpanded(!isAlertExpanded)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                isDark
                  ? 'border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200'
                  : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700'
              }`}
            >
              {isAlertExpanded ? 'Riduci Allerta' : 'Dettagli & Precauzioni'}
            </button>
          </div>
        </div>
      )}

      {/* Hourly Timeline (Next 24 Hours) Horizontal Slider */}
      {hourly.length > 0 && (
        <div className="mt-6 pt-5 border-t border-slate-200/80 dark:border-slate-800/80 relative z-10">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Previsione Oraria Dettagliata (Prossime 24 Ore)</span>
            </div>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Scorri orizzontalmente per vedere tutte le ore
            </span>
          </div>

          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
            {hourly.slice(0, 24).map((item, idx) => (
              <div
                key={idx}
                className={`shrink-0 p-3 rounded-2xl border flex flex-col items-center min-w-[78px] transition-all hover:scale-105 ${
                  idx === 0
                    ? 'bg-gradient-to-b from-cyan-500/20 to-teal-500/10 border-cyan-500/40 text-cyan-300 shadow-md shadow-cyan-500/10'
                    : isDark
                    ? 'bg-slate-800/60 border-slate-700/70 text-slate-200 hover:border-slate-600'
                    : 'bg-white/85 border-slate-200 text-slate-800 hover:border-slate-300'
                }`}
              >
                <span className="text-xs font-extrabold tracking-tight">
                  {idx === 0 ? 'Adesso' : item.hourLabel}
                </span>

                <div className="my-2 p-1">
                  {getWeatherIcon(item.weatherCode, 'w-7 h-7')}
                </div>

                <span className="text-sm font-black text-slate-900 dark:text-white">
                  {item.temperature > 0 ? `+${item.temperature}` : item.temperature}°
                </span>

                {/* Rain probability bar */}
                <div className="w-full mt-2 pt-1 border-t border-slate-200 dark:border-slate-700/60 flex flex-col items-center">
                  <div className="flex items-center gap-0.5 text-[10px] text-sky-400 font-bold">
                    <Droplets className="w-2.5 h-2.5" />
                    <span>{item.precipitationProbability}%</span>
                  </div>
                </div>

                {/* CAPE thunderstorm warning pill if risk exists */}
                {item.cape > 500 && (
                  <div className="mt-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5">
                    <Zap className="w-2 h-2" />
                    <span>CAPE</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

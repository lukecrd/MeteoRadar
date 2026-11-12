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
    if (code === 0) return <Sun className={`${size} text-amber-400`} />;
    if (code === 1) return <SunMedium className={`${size} text-amber-400`} />;
    if (code === 2) return <CloudSun className={`${size} text-amber-400`} />;
    if (code === 3) return <Cloud className={`${size} text-slate-300`} />;
    if (code >= 45 && code <= 48) return <CloudFog className={`${size} text-teal-400`} />;
    if (code >= 51 && code <= 55) return <CloudDrizzle className={`${size} text-sky-400`} />;
    if (code >= 61 && code <= 65) return <CloudRain className={`${size} text-sky-400`} />;
    if (code >= 71 && code <= 75) return <CloudSnow className={`${size} text-sky-400`} />;
    if (code >= 80 && code <= 82) return <CloudRainWind className={`${size} text-sky-500`} />;
    if (code >= 95) return <CloudLightning className={`${size} text-amber-400`} />;
    return <CloudSun className={`${size} text-amber-400`} />;
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

      {/* Top Header: Location, Clean Unboxed Metadata & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 relative z-10 border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
        <div className="flex items-center gap-3.5">
          <div className="hub-3d-subcard p-3 text-cyan-400">
            <MapPin className="w-5 h-5 relative" />
          </div>
          <div>
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {location.name}
              </h2>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {location.country} {location.admin1 ? `· ${location.admin1}` : ''}
              </span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="text-xs font-semibold text-cyan-400 inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Telemetria 3D Live
              </span>
            </div>
            <p className="font-hud text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
              <span>Aggiornato alle {lastUpdated}</span>
              <span aria-hidden="true">·</span>
              <span className="text-cyan-500 dark:text-cyan-400">{location.latitude.toFixed(2)}°N, {location.longitude.toFixed(2)}°E</span>
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
            className="hub-icon-btn !px-3.5 text-xs font-bold !border-cyan-500/40"
            title="Diagnostica previsionale AI avanzata Gemini"
          >
            <Sparkles className="w-4 h-4 text-cyan-400" aria-hidden="true" />
            <span>Diagnostica AI</span>
          </button>

          <button
            id="refresh-weather-btn"
            onClick={onRefresh}
            disabled={isLoading}
            className="hub-icon-btn"
            title="Ricarica dati meteo e telemetria"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Temperature & 3D Volumetric Weather Display */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
        {/* Left: 3D Orbital Weather Stage & Giant Temp */}
        <div className="lg:col-span-7 flex flex-wrap sm:flex-nowrap items-center gap-6">
          <div className="relative shrink-0 w-28 h-28 flex items-center justify-center rounded-3xl hub-3d-subcard bg-slate-950/60 overflow-hidden">
            {/* 3D Perspective Orbital Rings */}
            <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
              <ellipse
                cx="60"
                cy="60"
                rx="50"
                ry="18"
                fill="none"
                stroke="rgba(56, 189, 248, 0.28)"
                strokeWidth="1.2"
                strokeDasharray="4 3"
                transform="rotate(-24 60 60)"
              />
              <ellipse
                cx="60"
                cy="60"
                rx="46"
                ry="15"
                fill="none"
                stroke="rgba(251, 191, 36, 0.22)"
                strokeWidth="1"
                transform="rotate(32 60 60)"
              />
            </svg>
            <div className="relative z-10 drop-shadow-[0_8px_16px_rgba(56,189,248,0.28)]">
              {getWeatherIcon(current.weatherCode)}
            </div>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-hud text-6xl sm:text-7xl font-bold tracking-tighter text-slate-900 dark:text-white tabular-nums">
                {current.temperature > 0 ? `+${current.temperature}` : current.temperature}
              </span>
              <span className="text-4xl font-light text-cyan-400">°C</span>
            </div>
            <div className="font-display text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1 flex items-center gap-2">
              <span>{current.weatherDescription}</span>
            </div>

            {/* Clean Unboxed Telemetry Line */}
            <div className="flex flex-wrap items-center gap-2.5 mt-2.5 text-xs font-hud text-slate-600 dark:text-slate-300">
              <span>
                Percepita <strong className="text-slate-900 dark:text-white">{current.apparentTemperature}°C</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Min <strong className="text-cyan-400">{todayMin}°</strong> / Max <strong className="text-amber-400">{todayMax}°</strong>
              </span>
              {todayDaily && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Prob. Pioggia <strong className="text-sky-400">{todayDaily.precipitationProbability}%</strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: 3D Extruded Atmospheric Metric Pods */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-3.5">
          {/* Umidità */}
          <div className="hub-3d-subcard p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                Umidità Rel.
              </span>
              <span className="font-hud text-[11px] text-cyan-400">IGRO</span>
            </div>
            <div className="font-hud text-2xl font-bold mt-1.5 text-cyan-500 dark:text-cyan-300 tabular-nums">
              {current.relativeHumidity}%
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Punto rugiada {current.dewPoint}°C
            </div>
          </div>

          {/* Pressione */}
          <div className="hub-3d-subcard p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-indigo-400" />
                Pressione Atm.
              </span>
              <span className="font-hud text-[11px] text-indigo-400">BARO</span>
            </div>
            <div className="font-hud text-2xl font-bold mt-1.5 text-slate-900 dark:text-white tabular-nums">
              {current.pressure} <span className="text-xs font-normal text-slate-400">hPa</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {current.pressure < 1010 ? 'Bassa (Depressione)' : current.pressure > 1020 ? 'Alta (Anticiclone)' : 'Pressione Stabile'}
            </div>
          </div>

          {/* Indice UV */}
          <div className="hub-3d-subcard p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                Indice UV
              </span>
              <span className="font-hud text-[11px] text-amber-400">RAD</span>
            </div>
            <div className="font-hud text-2xl font-bold mt-1.5 text-amber-500 dark:text-amber-300 tabular-nums">
              {current.uvIndex} <span className="text-xs font-normal text-slate-400">/ 11</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {current.uvIndex > 6 ? 'Esposizione Alta' : current.uvIndex > 3 ? 'Esposizione Moderata' : 'Basso'}
            </div>
          </div>

          {/* Vento & Raffiche */}
          <div className="hub-3d-subcard p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-teal-400" />
                Vento & Raffiche
              </span>
              <span className="font-hud text-[11px] text-teal-400">ANEMO</span>
            </div>
            <div className="font-hud text-2xl font-bold mt-1.5 text-slate-900 dark:text-white tabular-nums">
              {current.windSpeed} <span className="text-xs font-normal text-slate-400">km/h</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
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
              <div className={`p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border ${alertStyle.border} ${alertStyle.text} shrink-0 mt-0.5`}>
                <AlertIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${alertStyle.border} ${alertStyle.text} bg-white/70 dark:bg-slate-950/40`}>
                    {alertStyle.badge}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {activeAlert.issuer} • Valida fino a: {activeAlert.validTo}
                  </span>
                </div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-1">
                  {activeAlert.title}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {activeAlert.description}
                </p>
                {isAlertExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-300">
                    <p className="font-bold text-amber-400 mb-1">Indicazioni di sicurezza per la popolazione:</p>
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
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Previsione Oraria Dettagliata (Prossime 24 Ore)</span>
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Scorri orizzontalmente per vedere tutte le ore
            </span>
          </div>

          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
            {hourly.slice(0, 24).map((item, idx) => (
              <div
                key={idx}
                className={`shrink-0 p-3 rounded-2xl border flex flex-col items-center min-w-[78px] transition-all hover:scale-105 ${
                  idx === 0
                    ? 'bg-gradient-to-b from-cyan-500/20 to-teal-500/10 border-cyan-500/40 text-cyan-400 shadow-md shadow-cyan-500/10'
                    : isDark
                    ? 'bg-slate-800/60 border-slate-700/70 text-slate-200 hover:border-slate-600'
                    : 'bg-white/85 border-slate-200 text-slate-800 hover:border-slate-300'
                }`}
              >
                <span className="text-xs font-bold tracking-tight">
                  {idx === 0 ? 'Adesso' : item.hourLabel}
                </span>

                <div className="my-2 p-1">
                  {getWeatherIcon(item.weatherCode, 'w-7 h-7')}
                </div>

                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {item.temperature > 0 ? `+${item.temperature}` : item.temperature}°
                </span>

                {/* Rain probability bar */}
                <div className="w-full mt-2 pt-1 border-t border-slate-200 dark:border-slate-700/60 flex flex-col items-center">
                  <div className="flex items-center gap-0.5 text-xs text-sky-400 font-bold">
                    <Droplets className="w-2.5 h-2.5" />
                    <span>{item.precipitationProbability}%</span>
                  </div>
                </div>

                {/* CAPE thunderstorm warning pill if risk exists */}
                {item.cape > 500 && (
                  <div className="mt-1 px-1.5 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-0.5">
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

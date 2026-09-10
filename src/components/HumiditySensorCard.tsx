import React, { useState } from 'react';
import { Droplets, AlertTriangle, Activity, Zap, RotateCcw, CheckCircle2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { HumiditySensorReading, HumidityAlertState } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

interface HumiditySensorCardProps {
  currentHumidity: number;
  dewPoint: number;
  temperature: number;
  readings: HumiditySensorReading[];
  alertState: HumidityAlertState;
  onSimulateSpike: (delta: number) => void;
  onCalibrate: () => void;
  isDark: boolean;
  spikeThreshold: number;
}

export const HumiditySensorCard: React.FC<HumiditySensorCardProps> = ({
  currentHumidity,
  dewPoint,
  temperature,
  readings,
  alertState,
  onSimulateSpike,
  onCalibrate,
  isDark,
  spikeThreshold
}) => {
  const [isCalibrating, setIsCalibrating] = useState(false);

  const handleCalibrateClick = () => {
    setIsCalibrating(true);
    setTimeout(() => {
      onCalibrate();
      setIsCalibrating(false);
    }, 800);
  };

  // Comfort index calculation
  const getComfortStatus = (rh: number, temp: number) => {
    if (rh < 30) return { label: 'Aria Troppo Secca', color: 'text-amber-500', bg: 'bg-amber-500/10' };
    if (rh > 70 && temp > 22) return { label: 'Afoso / Elevata Instabilità', color: 'text-rose-500', bg: 'bg-rose-500/10' };
    if (rh > 80) return { label: 'Saturazione (Pre-Pioggia)', color: 'text-sky-500', bg: 'bg-sky-500/10' };
    return { label: 'Livello Comfort Ideale', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
  };

  const comfort = getComfortStatus(currentHumidity, temperature);

  // Gauge circumference & dashoffset calculation (semi-circle gauge)
  const radius = 68;
  const circumference = Math.PI * radius; // 180 deg arc
  const normalizedValue = Math.min(100, Math.max(0, currentHumidity));
  const strokeDashoffset = circumference - (normalizedValue / 100) * circumference;

  return (
    <div
      id="humidity-sensor-card"
      className={`rounded-2xl p-6 transition-all duration-300 relative overflow-hidden border ${
        isDark
          ? 'bg-slate-900/90 border-slate-800/90 text-slate-100 shadow-xl shadow-black/20'
          : 'bg-white/95 border-slate-200 text-slate-900 shadow-lg shadow-slate-200/50'
      } ${alertState.isSpikeActive ? 'ring-2 ring-rose-500/80' : ''}`}
    >
      {/* Background ambient glow for alert */}
      {alertState.isSpikeActive && (
        <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/15 rounded-full blur-3xl -z-0 pointer-events-none animate-pulse" />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400">
            <Droplets className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Sensore Igrometrico Digitale
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
              </span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">Monitoraggio variazione igrometrica in tempo reale</p>
          </div>
        </div>

        <button
          id="calibrate-sensor-btn"
          onClick={handleCalibrateClick}
          disabled={isCalibrating}
          title="Ricalibra il sensore igrometrico"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
            isDark
              ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200'
              : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isCalibrating ? 'animate-spin text-cyan-400' : ''}`} />
          {isCalibrating ? 'Calibrazione...' : 'Calibra'}
        </button>
      </div>

      {/* Alert Banner if spike detected */}
      {alertState.isSpikeActive && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-3 text-rose-400 animate-in fade-in slide-in-from-top duration-300">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 animate-bounce" />
          <div className="text-xs">
            <div className="font-bold uppercase tracking-wider text-[11px]">Allarme Variazione Rapida Rilevata</div>
            <div className="text-slate-800 dark:text-slate-100 font-bold mt-0.5">{alertState.message}</div>
            <div className="text-[11px] text-rose-300 font-semibold mt-1">
              Variazione: {alertState.changeRate > 0 ? '+' : ''}{alertState.changeRate.toFixed(1)}%/h (Soglia di allerta: ±{spikeThreshold}%)
            </div>
          </div>
        </div>
      )}

      {/* Main Gauge & Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center mb-5 relative z-10">
        {/* Gauge Visual */}
        <div className="md:col-span-5 flex flex-col items-center justify-center pt-2">
          <div className="relative w-44 h-28 flex items-end justify-center">
            <svg viewBox="0 0 160 90" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="humidityGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="60%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#0284c7" />
                </linearGradient>
              </defs>
              {/* Background Arc */}
              <path
                d="M 12 80 A 68 68 0 0 1 148 80"
                fill="none"
                stroke={isDark ? '#1e293b' : '#e2e8f0'}
                strokeWidth="12"
                strokeLinecap="round"
              />
              {/* Active Arc */}
              <path
                d="M 12 80 A 68 68 0 0 1 148 80"
                fill="none"
                stroke="url(#humidityGradient)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
              <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                {Math.round(currentHumidity)}
                <span className="text-lg font-bold text-cyan-400">%</span>
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                Umidità Relativa
              </span>
            </div>
          </div>

          <div className={`mt-3 px-3 py-1 rounded-full text-xs font-bold ${comfort.bg} ${comfort.color}`}>
            {comfort.label}
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="md:col-span-7 grid grid-cols-2 gap-3">
          <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800/60 border-slate-700/70' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[11px] text-slate-500 dark:text-slate-300 font-semibold">Punto di Rugiada (Dew Pt)</div>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {dewPoint > 0 ? `+${dewPoint}` : dewPoint}°C
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Condensazione vapore</div>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800/60 border-slate-700/70' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[11px] text-slate-500 dark:text-slate-300 font-semibold">Rate di Variazione (ΔH)</div>
            <div className="flex items-center gap-1 text-lg font-black mt-0.5">
              {alertState.direction === 'rising' ? (
                <TrendingUp className="w-4 h-4 text-rose-400" />
              ) : alertState.direction === 'falling' ? (
                <TrendingDown className="w-4 h-4 text-sky-400" />
              ) : (
                <Minus className="w-4 h-4 text-emerald-400" />
              )}
              <span className={alertState.isSpikeActive ? 'text-rose-400' : 'text-slate-900 dark:text-white'}>
                {alertState.changeRate > 0 ? `+${alertState.changeRate.toFixed(1)}` : alertState.changeRate.toFixed(1)}%/h
              </span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Gradiente instabilità</div>
          </div>

          <div className={`col-span-2 p-3 rounded-xl border flex items-center justify-between ${
            isDark ? 'bg-slate-800/60 border-slate-700/70' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Frequenza campionamento:</span>
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">1.0 Hz (Continuo)</span>
          </div>
        </div>
      </div>

      {/* Micro-Telemetry History Graph */}
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Cronologia Telemetrica Recente
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-300 font-medium">Ultimi {readings.length} campioni</span>
        </div>
        
        <div className="h-24 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={readings} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="areaHumidity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="timeLabel" tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }} />
              <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  borderColor: isDark ? '#475569' : '#cbd5e1',
                  borderRadius: '0.5rem',
                  fontSize: '11px',
                  color: isDark ? '#f8fafc' : '#0f172a'
                }}
                formatter={(val: number) => [`${val}%`, 'Umidità']}
              />
              <Area
                type="monotone"
                dataKey="humidity"
                stroke="#06b6d4"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#areaHumidity)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Interactive Spike Simulation Bar */}
      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          Test Sensore & Variazioni Improvvise:
        </span>
        <div className="flex items-center gap-1.5">
          <button
            id="spike-plus-btn"
            onClick={() => onSimulateSpike(12)}
            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-colors"
          >
            +12% Fronte Pioggia
          </button>
          <button
            id="spike-minus-btn"
            onClick={() => onSimulateSpike(-10)}
            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/30 transition-colors"
          >
            -10% Aria Secca
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { Zap, ShieldAlert, Radio, Volume2, Timer, AlertOctagon, Activity, Trash2 } from 'lucide-react';
import { LightningStrike } from '../types';
import { playLightningAlertSound, triggerVibration } from '../services/audioAlerts';

interface LightningMonitorProps {
  strikes: LightningStrike[];
  capeIndex: number;
  onSimulateStrike: (distanceKm?: number) => void;
  onClearStrikes?: () => void;
  isDark: boolean;
  proximityThreshold: number;
  enableAudio: boolean;
  audioVolume: number;
}

export const LightningMonitor: React.FC<LightningMonitorProps> = ({
  strikes,
  capeIndex,
  onSimulateStrike,
  onClearStrikes,
  isDark,
  proximityThreshold,
  enableAudio,
  audioVolume,
}) => {
  const [selectedStrike, setSelectedStrike] = useState<LightningStrike | null>(null);
  
  // Flash-to-Bang Acoustic Delay Calculator State
  const [timerState, setTimerState] = useState<'idle' | 'running' | 'calculated'>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [calculatedDistanceKm, setCalculatedDistanceKm] = useState<number | null>(null);
  const timerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);

  const startFlashTimer = () => {
    startTimeRef.current = Date.now();
    setTimerState('running');
    setElapsedSeconds(0);
    setCalculatedDistanceKm(null);

    timerRef.current = setInterval(() => {
      const sec = (Date.now() - startTimeRef.current) / 1000;
      setElapsedSeconds(sec);
    }, 50);
  };

  const stopThunderTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const finalSec = (Date.now() - startTimeRef.current) / 1000;
    setElapsedSeconds(finalSec);
    // Speed of sound: 343 m/s = 0.343 km/s
    const distanceKm = Math.round((finalSec * 0.343) * 10) / 10;
    setCalculatedDistanceKm(distanceKm);
    setTimerState('calculated');

    // Automatically trigger simulated strike at this acoustic distance
    onSimulateStrike(distanceKm);
  };

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerState('idle');
    setElapsedSeconds(0);
    setCalculatedDistanceKm(null);
  };

  // Find closest strike
  const closestStrike = strikes.length > 0
    ? strikes.reduce((min, s) => (s.distanceKm < min.distanceKm ? s : min), strikes[0])
    : null;

  const isSevere = closestStrike ? closestStrike.distanceKm <= 5 : false;
  const isWarning = closestStrike ? closestStrike.distanceKm <= proximityThreshold : false;

  // Radar canvas rendering
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let sweepAngle = 0;

    const renderRadar = () => {
      const w = (canvas.width = canvas.parentElement?.clientWidth || 320);
      const h = (canvas.height = canvas.parentElement?.clientHeight || 280);
      const cx = w / 2;
      const cy = h / 2;
      const maxRadius = Math.min(cx, cy) - 15;

      ctx.clearRect(0, 0, w, h);

      // 1. Draw Colored Convective Zones
      // Red Zone (< 5 km)
      const rRed = (5 / 40) * maxRadius;
      ctx.beginPath();
      ctx.arc(cx, cy, rRed, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.18)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Orange Zone (5 - 15 km)
      const rOrange = (15 / 40) * maxRadius;
      ctx.beginPath();
      ctx.arc(cx, cy, rOrange, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? 'rgba(249, 115, 22, 0.15)' : 'rgba(249, 115, 22, 0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.6)';
      ctx.stroke();

      // Yellow Zone (15 - 30 km)
      const rYellow = (30 / 40) * maxRadius;
      ctx.beginPath();
      ctx.arc(cx, cy, rYellow, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? 'rgba(234, 179, 8, 0.08)' : 'rgba(234, 179, 8, 0.06)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.5)';
      ctx.stroke();

      // Green Zone (30 - 40 km max range)
      const rGreen = maxRadius;
      ctx.beginPath();
      ctx.arc(cx, cy, rGreen, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
      ctx.stroke();

      // 2. Crosshair Axes
      ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.35)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, cy - maxRadius);
      ctx.lineTo(cx, cy + maxRadius);
      ctx.moveTo(cx - maxRadius, cy);
      ctx.lineTo(cx + maxRadius, cy);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Radar Sweep Line
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(sweepAngle);

      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, maxRadius);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.3)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, maxRadius, 0, Math.PI / 4);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(maxRadius, 0);
      ctx.stroke();
      ctx.restore();

      sweepAngle += 0.035;

      // 4. Render Detected Strikes
      strikes.forEach((s) => {
        const rad = ((s.bearingDeg - 90) * Math.PI) / 180;
        const distRatio = Math.min(1, s.distanceKm / 40);
        const sx = cx + Math.cos(rad) * (distRatio * maxRadius);
        const sy = cy + Math.sin(rad) * (distRatio * maxRadius);

        // Flash pulse
        const age = (Date.now() - s.timestamp) / 1000;
        const pulse = Math.max(0, 1 - age / 12);

        ctx.beginPath();
        ctx.arc(sx, sy, 4 + pulse * 6, 0, Math.PI * 2);
        if (s.distanceKm <= 5) ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + pulse * 0.6})`;
        else if (s.distanceKm <= 15) ctx.fillStyle = `rgba(249, 115, 22, ${0.4 + pulse * 0.6})`;
        else if (s.distanceKm <= 30) ctx.fillStyle = `rgba(234, 179, 8, ${0.4 + pulse * 0.6})`;
        else ctx.fillStyle = `rgba(34, 197, 94, ${0.4 + pulse * 0.6})`;
        ctx.fill();

        // Icon dot
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      });

      // Center Station Marker (You)
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();

      animId = requestAnimationFrame(renderRadar);
    };

    renderRadar();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [strikes, isDark]);

  return (
    <div
      id="lightning-monitor-card"
      className={`rounded-2xl p-6 transition-all duration-300 relative overflow-hidden border ${
        isDark
          ? 'bg-slate-900/90 border-slate-800/90 text-slate-100 shadow-xl shadow-black/20'
          : 'bg-white/95 border-slate-200 text-slate-900 shadow-lg shadow-slate-200/50'
      } ${isSevere ? 'ring-2 ring-rose-500/90' : isWarning ? 'ring-2 ring-amber-500/70' : ''}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Monitor Tuoni & Lampi Convettivi
              {strikes.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                  {strikes.length} SCARICHE
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Rilevamento elettrico atmosferico & zone di pericolosità a colori
            </p>
          </div>
        </div>

        {/* Action buttons: Simulate & Clear */}
        <div className="flex items-center gap-2">
          {strikes.length > 0 && onClearStrikes && (
            <button
              id="clear-lightning-btn"
              onClick={onClearStrikes}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-500/15 hover:bg-slate-500/25 text-slate-300 hover:text-white border border-slate-700/50 transition-colors"
              title="Azzera e cancella tutte le scariche registrate"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Azzera</span>
            </button>
          )}

          <button
            id="simulate-lightning-btn"
            onClick={() => onSimulateStrike()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 transition-colors"
            title="Genera un lampo simulato per testare radar e allarmi"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Simula Scarica</span>
          </button>
        </div>
      </div>

      {/* Zone Color Legend Bar */}
      <div className="grid grid-cols-4 gap-1.5 mb-4 text-center text-[10px] font-bold">
        <div className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
          🟢 &gt;30 km: Sicura
        </div>
        <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
          🟡 15-30 km: Monitor
        </div>
        <div className="p-1.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400">
          🟠 5-15 km: Allarme
        </div>
        <div className="p-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 animate-pulse">
          🔴 &lt;5 km: Imminente
        </div>
      </div>

      {/* Main Radar & Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Radar Screen Canvas */}
        <div className="lg:col-span-7 relative h-72 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950/90 flex items-center justify-center">
          <canvas ref={radarCanvasRef} className="w-full h-full" />
          
          <div className="absolute top-2 left-3 text-[10px] font-mono font-bold text-cyan-300 bg-slate-900/90 px-2 py-0.5 rounded border border-cyan-500/40">
            RAGGIO RADAR: 40 KM
          </div>

          {closestStrike && (
            <div className="absolute bottom-2 right-3 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-900/95 border border-slate-700 text-slate-100 backdrop-blur-md">
              Più vicina: <span className={closestStrike.distanceKm < 15 ? 'text-rose-400' : 'text-amber-400'}>{closestStrike.distanceKm} km</span>
            </div>
          )}
        </div>

        {/* Doppler dBZ Reflectivity Scale Bar matching Stitch radar */}
        <div className="lg:col-span-12 -mt-2 p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1.5">
            <span>Scala Riflettività Radar Doppler (dBZ) & Tipo Precipitazione:</span>
            <span className="text-cyan-400 font-mono">15 - 65+ dBZ</span>
          </div>
          <div className="h-2.5 w-full rounded-full overflow-hidden bg-gradient-to-r from-emerald-500 via-amber-400 via-orange-500 via-rose-600 to-purple-600" />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-semibold">
            <span className="text-emerald-400">15-30: Debole</span>
            <span className="text-amber-400">30-40: Moderata</span>
            <span className="text-orange-400">40-50: Rovesci Forti</span>
            <span className="text-rose-400">50-60: Nubifragio</span>
            <span className="text-purple-400 font-bold">&gt;60: Grandine</span>
          </div>
        </div>

        {/* Right Section: Telemetry & Flash-to-Bang Timer */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {/* Active Status Box */}
          <div className={`p-4 rounded-xl border ${
            isSevere
              ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
              : isWarning
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
              : isDark
              ? 'bg-slate-800/70 border-slate-700/80 text-slate-100'
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">Stato Attività Temporalesca</span>
              <Radio className="w-4 h-4 animate-pulse text-amber-400" />
            </div>
            <div className="text-base font-black mt-1">
              {isSevere
                ? 'ALLERTA ROSSA: FULMINI RAVVICINATI (<5 KM)'
                : isWarning
                ? 'ALLERTA ARANCIONE: ATTIVITÀ IN AVVICINAMENTO'
                : strikes.length > 0
                ? 'ATTIVITÀ ELETTRICA MODERATA'
                : 'NESSUN FULMINE RILEVATO NEL RAGGIO DI 40 KM'}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              Indice CAPE Instabilità: <span className="font-bold text-slate-800 dark:text-slate-100">{capeIndex} J/kg</span> {capeIndex > 1000 ? '(Elevato potenziale)' : '(Basso)'}
            </div>
          </div>

          {/* Flash-to-Bang Acoustic Delay Tool (Calcolatore Lampo-Tuono) */}
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/60 border-slate-700/70' : 'bg-slate-50/80 border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold flex items-center gap-1.5 text-slate-900 dark:text-slate-100">
                <Timer className="w-4 h-4 text-cyan-400" />
                Cronometro Lampo-Tuono Acustico
              </span>
              {timerState !== 'idle' && (
                <button
                  onClick={resetTimer}
                  className="text-[10px] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline font-semibold"
                >
                  Azzera
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-300 mb-3">
              Premi quando vedi il lampo, poi premi quando senti il tuono per calcolare la distanza acustica (v = 343 m/s).
            </p>

            {timerState === 'idle' && (
              <button
                id="start-flash-timer-btn"
                onClick={startFlashTimer}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95"
              >
                <Zap className="w-4 h-4 fill-current" />
                1. Ho Visto il Lampo (Avvia Timer)
              </button>
            )}

            {timerState === 'running' && (
              <div className="flex flex-col gap-2">
                <div className="text-center py-2 bg-slate-900 rounded-xl font-mono text-2xl font-black text-amber-400 animate-pulse border border-amber-500/50">
                  {elapsedSeconds.toFixed(2)} s
                </div>
                <button
                  id="stop-thunder-timer-btn"
                  onClick={stopThunderTimer}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 animate-bounce"
                >
                  <Volume2 className="w-4 h-4" />
                  2. Ho Sentito il Tuono! (Calcola Distanza)
                </button>
              </div>
            )}

            {timerState === 'calculated' && calculatedDistanceKm !== null && (
              <div className="p-3 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-center animate-in zoom-in-95 duration-200">
                <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">Distanza Calcolata dal Fronte:</div>
                <div className="text-2xl font-black text-cyan-400 mt-0.5">
                  {calculatedDistanceKm} km
                </div>
                <div className="text-[11px] text-slate-700 dark:text-slate-200 mt-1 font-semibold">
                  Ritardo: {elapsedSeconds.toFixed(2)} secondi (Distanza = {elapsedSeconds.toFixed(1)}s × 343 m/s)
                </div>
              </div>
            )}
          </div>

          {/* Recent Strikes Log Mini List */}
          {strikes.length > 0 && (
            <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Ultime Scariche Registrate:</div>
              {strikes.slice(0, 3).map((s) => (
                <div
                  key={s.id}
                  className={`p-2 rounded-lg text-xs flex items-center justify-between border ${
                    s.distanceKm <= 5
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                      : s.distanceKm <= 15
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-200'
                  }`}
                >
                  <span className="font-mono font-bold">
                    {s.polarity}{s.peakCurrentKa} kA ({s.type === 'CG' ? 'Terra-Nube' : 'Nube-Nube'})
                  </span>
                  <span className="font-bold">{s.distanceKm} km</span>
                  <span className="text-[10px] opacity-80">{s.bearingDeg}°</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

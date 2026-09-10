import React, { useState, useEffect, useRef } from 'react';
import { Compass, Wind, Navigation, Layers, Rotate3d, ArrowUpRight, Gauge, MapPin } from 'lucide-react';
import { getWindDirectionLabel, getBeaufortScale } from '../services/weatherApi';
import { LocationInfo } from '../types';

interface WindCompassMapProps {
  windSpeed: number; // km/h
  windDirection: number; // degrees (0-360)
  windGusts: number; // km/h
  location: LocationInfo;
  isDark: boolean;
}

export const WindCompassMap: React.FC<WindCompassMapProps> = ({
  windSpeed,
  windDirection,
  windGusts,
  location,
  isDark
}) => {
  const [unit, setUnit] = useState<'kmh' | 'knots' | 'ms'>('kmh');
  const [is3DMode, setIs3DMode] = useState<boolean>(true);
  const [mapLayer, setMapLayer] = useState<'wind' | 'temp' | 'radar'>('wind');
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [useGyro, setUseGyro] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Speed unit conversion
  const formatSpeed = (speedKmh: number) => {
    if (unit === 'knots') return `${(speedKmh * 0.539957).toFixed(1)} kn`;
    if (unit === 'ms') return `${(speedKmh / 3.6).toFixed(1)} m/s`;
    return `${speedKmh} km/h`;
  };

  const beaufort = getBeaufortScale(windSpeed);
  const windDirLabel = getWindDirectionLabel(windDirection);

  // Device orientation support (Compass gyro)
  useEffect(() => {
    if (!useGyro) return;
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null) {
        setDeviceHeading(Math.round(e.alpha));
      } else if ((e as any).webkitCompassHeading) {
        setDeviceHeading(Math.round((e as any).webkitCompassHeading));
      }
    };

    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [useGyro]);

  // Wind Particles Animation on the Map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 400);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 320);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Wind Streamline particle model
    const numParticles = Math.min(100, Math.max(30, Math.floor(windSpeed * 1.5 + 25)));
    const particles: Array<{ x: number; y: number; age: number; maxAge: number; speed: number }> = [];

    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        age: Math.random() * 80,
        maxAge: 40 + Math.random() * 60,
        speed: 1 + (windSpeed / 20) + Math.random() * 1.5,
      });
    }

    // Direction vector (wind flows towards direction + 180 or meteorological standard from angle)
    const rad = ((windDirection - 90) * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);

    const render = () => {
      // Semi-transparent clear for smooth trail effect
      ctx.fillStyle = isDark ? 'rgba(11, 15, 25, 0.22)' : 'rgba(241, 245, 249, 0.25)';
      ctx.fillRect(0, 0, width, height);

      // Draw Grid / Radar rings
      ctx.strokeStyle = isDark ? 'rgba(51, 65, 85, 0.3)' : 'rgba(203, 213, 225, 0.4)';
      ctx.lineWidth = 1;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.beginPath();
      ctx.arc(centerX, centerY, 50, 0, Math.PI * 2);
      ctx.arc(centerX, centerY, 100, 0, Math.PI * 2);
      ctx.arc(centerX, centerY, 150, 0, Math.PI * 2);
      ctx.stroke();

      // Draw Wind Particles
      ctx.lineWidth = 1.8;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const progress = p.age / p.maxAge;
        const opacity = Math.sin(progress * Math.PI) * 0.75;

        // Color based on wind intensity
        let strokeColor = `rgba(56, 189, 248, ${opacity})`;
        if (windSpeed > 40) strokeColor = `rgba(249, 115, 22, ${opacity})`;
        if (windSpeed > 65) strokeColor = `rgba(239, 68, 68, ${opacity})`;

        ctx.strokeStyle = strokeColor;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - dx * 10, p.y - dy * 10);
        ctx.stroke();

        // Move particle
        p.x += dx * p.speed;
        p.y += dy * p.speed;
        p.age++;

        if (p.age >= p.maxAge || p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
          p.x = Math.random() * width;
          p.y = Math.random() * height;
          p.age = 0;
          p.maxAge = 40 + Math.random() * 60;
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [windSpeed, windDirection, isDark, mapLayer]);

  const effectiveRotation = useGyro && deviceHeading !== null ? deviceHeading : 0;

  return (
    <div
      id="wind-compass-map-card"
      className={`rounded-2xl p-6 transition-all duration-300 relative overflow-hidden border ${
        isDark
          ? 'bg-slate-900/80 border-slate-800/90 text-slate-100 shadow-xl shadow-black/20'
          : 'bg-white/90 border-slate-200 text-slate-900 shadow-lg shadow-slate-200/50'
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-500/15 text-teal-500">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Bussola & Vettori del Vento
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-300">
              Dinamica e direzione anemometrica su mappa
            </p>
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setIs3DMode(!is3DMode)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
              is3DMode
                ? 'bg-teal-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
            title="Attiva/Disattiva prospettiva 3D della rosa dei venti"
          >
            <Rotate3d className="w-3.5 h-3.5" />
            3D Dial
          </button>
          <button
            onClick={() => setUseGyro(!useGyro)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
              useGyro
                ? 'bg-cyan-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
            title="Sincronizza con orientamento giroscopio"
          >
            <Navigation className="w-3.5 h-3.5" />
            Giroscopio
          </button>
        </div>
      </div>

      {/* Main Interactive Map & 3D Compass Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left / Center Map with Integrated 3D Compass Overlay */}
        <div className="lg:col-span-7 relative h-72 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950/40 flex items-center justify-center">
          {/* Animated Canvas Map Streamlines */}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

          {/* Map Location Badge */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md border border-slate-700/80 text-[11px] text-slate-200 shadow-md">
            <MapPin className="w-3.5 h-3.5 text-teal-400" />
            <span className="font-semibold">{location.name}</span>
            <span className="text-slate-400">({location.latitude.toFixed(2)}°, {location.longitude.toFixed(2)}°)</span>
          </div>

          {/* 3D Compass Rose Dial */}
          <div
            className={`relative z-10 w-52 h-52 transition-transform duration-500 ${
              is3DMode ? 'transform [transform:perspective(600px)_rotateX(25deg)]' : ''
            }`}
            style={{
              transform: is3DMode
                ? `perspective(600px) rotateX(25deg) rotate(${effectiveRotation}deg)`
                : `rotate(${effectiveRotation}deg)`,
            }}
          >
            {/* Outer Ring with Degrees & Cardinal Points */}
            <div className="absolute inset-0 rounded-full border-2 border-teal-500/40 bg-slate-900/60 backdrop-blur-md shadow-2xl flex items-center justify-center">
              {/* Cardinal Labels */}
              <span className="absolute top-2 font-black text-rose-500 text-xs tracking-wider">N</span>
              <span className="absolute right-2.5 font-bold text-slate-300 text-xs">E</span>
              <span className="absolute bottom-2 font-bold text-slate-300 text-xs">S</span>
              <span className="absolute left-2.5 font-bold text-slate-300 text-xs">W</span>

              {/* Intercardinal Labels */}
              <span className="absolute top-5 right-6 font-semibold text-[10px] text-teal-400/80">NE</span>
              <span className="absolute bottom-5 right-6 font-semibold text-[10px] text-slate-400">SE</span>
              <span className="absolute bottom-5 left-6 font-semibold text-[10px] text-slate-400">SW</span>
              <span className="absolute top-5 left-6 font-semibold text-[10px] text-slate-400">NW</span>

              {/* Dial Ticks (every 30 deg) */}
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                <div
                  key={deg}
                  className="absolute w-0.5 h-2 bg-slate-500/40 origin-bottom"
                  style={{
                    top: '4px',
                    left: 'calc(50% - 1px)',
                    transformOrigin: '50% 100px',
                    transform: `rotate(${deg}deg)`,
                  }}
                />
              ))}

              {/* Center Hub */}
              <div className="w-16 h-16 rounded-full bg-slate-800/90 border border-teal-400/30 flex flex-col items-center justify-center z-20 shadow-inner">
                <span className="text-sm font-extrabold text-teal-400">{windDirection}°</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Gradi</span>
              </div>

              {/* Wind Vector Pointer Arrow */}
              <div
                className="absolute inset-0 flex items-center justify-center transition-transform duration-700 ease-out z-10 pointer-events-none"
                style={{ transform: `rotate(${windDirection}deg)` }}
              >
                {/* Needle pointing in wind direction */}
                <div className="relative w-2 h-44 flex flex-col items-center justify-between">
                  {/* Arrow Head (Wind Origin / Direction Indicator) */}
                  <div className="w-0 h-0 border-x-[8px] border-x-transparent border-b-[24px] border-b-teal-400 drop-shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
                  {/* Opposite Tail */}
                  <div className="w-0 h-0 border-x-[5px] border-x-transparent border-t-[14px] border-t-slate-500/50" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Wind Telemetry & Beaufort Info */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {/* Main Direction Box */}
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/70 border-slate-700/80' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 flex items-center justify-between">
              <span>Direzione Vento (Rosa Nautica)</span>
              <span className="text-teal-400 font-bold">{windDirection}°</span>
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-teal-400" style={{ transform: `rotate(${windDirection}deg)` }} />
              {windDirLabel}
            </div>
          </div>

          {/* Speed & Gusts with Unit Toggle */}
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/70 border-slate-700/80' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-teal-400" />
                Velocità & Raffiche
              </span>
              {/* Unit Switcher */}
              <div className="flex items-center gap-1 text-[10px] font-bold bg-slate-200 dark:bg-slate-700 p-0.5 rounded-md">
                <button
                  onClick={() => setUnit('kmh')}
                  className={`px-1.5 py-0.5 rounded font-bold ${unit === 'kmh' ? 'bg-teal-500 text-white' : 'text-slate-600 dark:text-slate-200'}`}
                >
                  km/h
                </button>
                <button
                  onClick={() => setUnit('knots')}
                  className={`px-1.5 py-0.5 rounded font-bold ${unit === 'knots' ? 'bg-teal-500 text-white' : 'text-slate-600 dark:text-slate-200'}`}
                >
                  kn
                </button>
                <button
                  onClick={() => setUnit('ms')}
                  className={`px-1.5 py-0.5 rounded font-bold ${unit === 'ms' ? 'bg-teal-500 text-white' : 'text-slate-600 dark:text-slate-200'}`}
                >
                  m/s
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-1">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-300 font-semibold">Velocità Media</div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {formatSpeed(windSpeed)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-300 font-semibold">Raffiche Max</div>
                <div className="text-2xl font-black text-amber-400">
                  {formatSpeed(windGusts)}
                </div>
              </div>
            </div>
          </div>

          {/* Beaufort Scale Indicator */}
          <div className={`p-3 rounded-xl border flex items-center justify-between ${
            isDark ? 'bg-slate-800/60 border-slate-700/70' : 'bg-slate-50/80 border-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-teal-400" />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Scala Beaufort {beaufort.scale} / 12
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-300 font-medium">{beaufort.description}</div>
              </div>
            </div>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((lvl) => (
                <div
                  key={lvl}
                  className={`w-1.5 h-5 rounded-sm ${
                    lvl <= beaufort.scale
                      ? lvl > 8
                        ? 'bg-rose-500'
                        : lvl > 5
                        ? 'bg-amber-500'
                        : 'bg-teal-500'
                      : isDark
                      ? 'bg-slate-800'
                      : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

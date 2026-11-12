import React, { useMemo, useState } from 'react';
import { Compass, Moon, RotateCcw, Sun, Sunrise, Sunset } from 'lucide-react';
import { DailyForecastItem, LocationInfo } from '../types';
import { computeLunarEphemeris, computeSolarEphemeris } from '../services/astronomy';

interface AstronomicalEphemerisCardProps {
  location: LocationInfo;
  daily: DailyForecastItem[];
  isDark?: boolean;
}

/**
 * Renders a 3D volumetric lunar orb with terminator curve, crater relief, and orbital inclination ring.
 */
export const MoonDiskSvg: React.FC<{ phaseValue: number; size?: number; showOrbitRing?: boolean }> = ({
  phaseValue,
  size = 116,
  showOrbitRing = false,
}) => {
  const r = 38;
  const cx = 50;
  const cy = 50;

  const p = ((phaseValue % 1) + 1) % 1;
  const isWaxing = p <= 0.5;
  const cosPhase = Math.cos(2 * Math.PI * p);
  const rx = Math.abs(cosPhase) * r;

  let litPath = '';
  if (p > 0.01 && p < 0.99) {
    if (Math.abs(p - 0.5) < 0.015) {
      litPath = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
    } else if (isWaxing) {
      const termSweep = p < 0.25 ? 0 : 1;
      litPath = `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} A ${rx.toFixed(2)} ${r} 0 0 ${termSweep} ${cx} ${cy - r} Z`;
    } else {
      const termSweep = p < 0.75 ? 0 : 1;
      litPath = `M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} A ${rx.toFixed(2)} ${r} 0 0 ${termSweep} ${cx} ${cy - r} Z`;
    }
  }

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="shrink-0 select-none overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="moonLit3D" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#fef08a" />
          <stop offset="72%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#92400e" />
        </radialGradient>
        <radialGradient id="moonDark3D" cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="70%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
        <radialGradient id="moonSphereShade" cx="32%" cy="28%" r="72%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
          <stop offset="65%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.52)" />
        </radialGradient>
        <clipPath id="moonDiskClip3D">
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>

      {/* Back half of 3D orbital ring */}
      {showOrbitRing && (
        <path
          d="M 4 50 A 46 15 0 0 1 96 50"
          fill="none"
          stroke="rgba(56, 189, 248, 0.25)"
          strokeWidth="1.2"
          strokeDasharray="3 3"
          transform="rotate(-16 50 50)"
        />
      )}

      {/* Volumetric outer corona glow */}
      <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke="rgba(251, 191, 36, 0.14)" strokeWidth="4" />
      <circle cx={cx} cy={cy} r={r + 2.5} fill="none" stroke="rgba(56, 189, 248, 0.28)" strokeWidth="1" />

      {/* Dark unlit lunar sphere */}
      <circle cx={cx} cy={cy} r={r} fill="url(#moonDark3D)" />

      {/* Illuminated portion */}
      {litPath && <path d={litPath} fill="url(#moonLit3D)" clipPath="url(#moonDiskClip3D)" />}

      {/* Lunar Maria & Crater 3D Relief */}
      <g clipPath="url(#moonDiskClip3D)" opacity="0.26" fill="#334155">
        <ellipse cx="37" cy="35" rx="9" ry="7" transform="rotate(-18 37 35)" />
        <ellipse cx="57" cy="31" rx="7" ry="5.5" transform="rotate(14 57 31)" />
        <ellipse cx="62" cy="46" rx="10" ry="8" transform="rotate(8 62 46)" />
        <ellipse cx="34" cy="55" rx="8" ry="11" transform="rotate(-10 34 55)" />
        <circle cx="48" cy="68" r="5" />
        <circle cx="51" cy="42" r="3.5" />
      </g>

      {/* 3D Spherical Specular & Rim Vignette Overlay */}
      <circle cx={cx} cy={cy} r={r} fill="url(#moonSphereShade)" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255, 255, 255, 0.32)" strokeWidth="1" />

      {/* Front half of 3D orbital ring */}
      {showOrbitRing && (
        <path
          d="M 96 50 A 46 15 0 0 1 4 50"
          fill="none"
          stroke="rgba(56, 189, 248, 0.65)"
          strokeWidth="1.4"
          transform="rotate(-16 50 50)"
        />
      )}
    </svg>
  );
};

export const AstronomicalEphemerisCard: React.FC<AstronomicalEphemerisCardProps> = ({
  location,
  daily,
}) => {
  const [dayOffset, setDayOffset] = useState<number>(0);

  const targetDate = useMemo(() => {
    const d = new Date();
    if (dayOffset !== 0) {
      d.setTime(d.getTime() + dayOffset * 86_400_000);
    }
    return d;
  }, [dayOffset]);

  const solar = useMemo(() => computeSolarEphemeris(location, daily, new Date()), [location, daily]);
  const lunar = useMemo(() => computeLunarEphemeris(targetDate), [targetDate]);

  // 3D Celestial Dome coordinates (horizon center at 190, 110; rx=112, ry=26)
  const clampedSunProg = Math.max(0, Math.min(1, solar.sunProgress));
  // Sun moves from East (left: x=78) through South (center: x=190) to West (right: x=302)
  const angleRad = Math.PI * (1 - clampedSunProg); // pi (left) -> 0 (right)
  const groundX = 190 - Math.cos(angleRad) * 112;
  const groundY = 110 + Math.sin(angleRad) * 26;
  const sunArcHeight = solar.isDaylightNow ? Math.sin(Math.PI * clampedSunProg) * 74 : -14;
  const sunX = groundX;
  const sunY = groundY - sunArcHeight;

  const deltaMin = Math.floor(Math.abs(solar.daylightDeltaSec) / 60);
  const deltaSecRem = Math.abs(solar.daylightDeltaSec) % 60;
  const deltaSign = solar.daylightDeltaSec >= 0 ? '+' : '−';
  const deltaLabel = `${deltaSign}${deltaMin}m ${deltaSecRem.toString().padStart(2, '0')}s rispetto a ieri`;

  return (
    <div className="p-5 sm:p-6 space-y-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--hub-line)] pb-4">
        <div className="min-w-0">
          <div className="hub-label flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-[var(--hub-amber)] shrink-0" />
            <span className="truncate">Sfera Celeste 3D & Osservatorio · {location.name}</span>
          </div>
          <h2 className="font-display text-lg sm:text-xl font-bold mt-0.5">
            Effemeridi Solari, Golden Hour & Fase Lunare
          </h2>
        </div>
        <div className="text-xs text-[var(--hub-dim)] font-hud tabular-nums shrink-0">
          Lat {location.latitude.toFixed(2)}° · Lon {location.longitude.toFixed(2)}°
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: 3D Celestial Solar Dome */}
        <div className="hub-3d-subcard p-4 sm:p-5 flex flex-col justify-between space-y-4 min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="hub-label flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-[var(--hub-amber)] shrink-0" />
                <span>Cupola Solare 3D & Luce Diurna</span>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <span className="font-display text-2xl font-bold tabular-nums">
                  {solar.daylightHours}h {solar.daylightMinutes.toString().padStart(2, '0')}m
                </span>
                <span className="text-xs text-[var(--hub-dim)]">di luce · {deltaLabel}</span>
              </div>
            </div>
            <div className="text-right font-hud shrink-0">
              <div className="text-xs text-[var(--hub-dim)]">Elevazione 3D</div>
              <div className="text-base font-bold tabular-nums text-[var(--hub-amber)]">
                {solar.currentElevationDeg > 0 ? `+${solar.currentElevationDeg}°` : `${solar.currentElevationDeg}°`}
                <span className="text-xs font-normal text-[var(--hub-dim)] ml-1.5">Az {solar.currentAzimuthDeg}°</span>
              </div>
            </div>
          </div>

          {/* 3D Isometric Celestial Horizon Dome SVG */}
          <div className="relative rounded-xl bg-slate-950/85 border border-slate-800/80 p-3 overflow-hidden">
            <svg viewBox="0 0 380 162" className="w-full h-auto max-h-44 block select-none" role="img" aria-label="Sfera celeste 3D giornaliera">
              <defs>
                <radialGradient id="celestialFloor" cx="50%" cy="50%" r="55%">
                  <stop offset="0%" stopColor="rgba(56, 189, 248, 0.2)" />
                  <stop offset="100%" stopColor="rgba(15, 23, 42, 0.0)" />
                </radialGradient>
                <linearGradient id="eclipticRibbon" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(251, 191, 36, 0.32)" />
                  <stop offset="100%" stopColor="rgba(251, 191, 36, 0.0)" />
                </linearGradient>
              </defs>

              {/* 3D Celestial Sphere Upper Meridians */}
              <path
                d="M 78 110 A 112 90 0 0 1 302 110"
                fill="none"
                stroke="rgba(56, 189, 248, 0.18)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <line x1="190" y1="20" x2="190" y2="110" stroke="rgba(56, 189, 248, 0.16)" strokeWidth="1" strokeDasharray="2 3" />

              {/* 3D Tilted Horizon Ground Plane */}
              <ellipse cx="190" cy="110" rx="112" ry="26" fill="url(#celestialFloor)" stroke="rgba(56, 189, 248, 0.45)" strokeWidth="1.3" />
              <line x1="78" y1="110" x2="302" y2="110" stroke="rgba(56, 189, 248, 0.22)" strokeWidth="1" />
              <line x1="190" y1="84" x2="190" y2="136" stroke="rgba(56, 189, 248, 0.22)" strokeWidth="1" />

              {/* Ecliptic 3D Sun Trajectory Ribbon */}
              <path
                d="M 78 110 Q 190 10 302 110 L 302 110 A 112 26 0 0 1 78 110 Z"
                fill="url(#eclipticRibbon)"
              />
              <path
                d="M 78 110 Q 190 10 302 110"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
                strokeDasharray="4 3"
              />

              {/* Solar Noon Culmination Label */}
              <text x="190" y="15" textAnchor="middle" className="fill-amber-300 text-[10px] font-hud font-bold">
                Zenit {solar.solarNoonTime} ({solar.maxElevationDeg}°)
              </text>

              {/* Sunrise (East) & Sunset (West) Nodes on 3D Rim */}
              <circle cx="78" cy="110" r="4" fill="#fb923c" />
              <circle cx="302" cy="110" r="4" fill="#f97316" />

              {/* 3D Vertical Drop-Line from Sun to Ground Plane */}
              <ellipse cx={groundX} cy={groundY} rx="5" ry="2.2" fill="rgba(251, 191, 36, 0.45)" />
              <line
                x1={groundX}
                y1={groundY}
                x2={sunX}
                y2={sunY}
                stroke="rgba(251, 191, 36, 0.75)"
                strokeWidth="1.4"
                strokeDasharray="2 2"
              />

              {/* Volumetric 3D Sun Orb */}
              <g transform={`translate(${sunX.toFixed(1)}, ${sunY.toFixed(1)})`}>
                <circle r="13" fill="rgba(251, 191, 36, 0.26)" />
                <circle
                  r="6.5"
                  fill={solar.isDaylightNow ? '#fde047' : '#64748b'}
                  stroke="#0f172a"
                  strokeWidth="1.5"
                />
              </g>

              {/* 3D Compass Points */}
              <text x="70" y="113" textAnchor="end" className="fill-amber-300 text-[10px] font-hud font-bold">
                EST · {solar.sunriseTime}
              </text>
              <text x="190" y="150" textAnchor="middle" className="fill-cyan-300 text-[10px] font-hud">
                SUD · Orizzonte 3D
              </text>
              <text x="310" y="113" textAnchor="start" className="fill-orange-300 text-[10px] font-hud font-bold">
                {solar.sunsetTime} · OVEST
              </text>
            </svg>
          </div>

          {/* Ephemeris Details Grid */}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[var(--hub-line)] text-xs">
            <div>
              <dt className="text-[var(--hub-dim)] flex items-center gap-1">
                <Sunrise className="w-3.5 h-3.5 text-[var(--hub-amber)]" /> Crepuscolo Matt.
              </dt>
              <dd className="font-hud font-semibold text-sm mt-0.5 tabular-nums">{solar.civilDawnTime}</dd>
            </div>
            <div>
              <dt className="text-[var(--hub-dim)] flex items-center gap-1">
                <Sunset className="w-3.5 h-3.5 text-orange-400" /> Crepuscolo Serale
              </dt>
              <dd className="font-hud font-semibold text-sm mt-0.5 tabular-nums">{solar.civilDuskTime}</dd>
            </div>
            <div>
              <dt className="text-[var(--hub-dim)]">Golden Hour Mattina</dt>
              <dd className="font-hud font-semibold text-sm mt-0.5 tabular-nums text-[var(--hub-amber)]">{solar.morningGoldenHour}</dd>
            </div>
            <div>
              <dt className="text-[var(--hub-dim)]">Golden Hour Sera</dt>
              <dd className="font-hud font-semibold text-sm mt-0.5 tabular-nums text-orange-400">{solar.eveningGoldenHour}</dd>
            </div>
          </dl>
        </div>

        {/* RIGHT COLUMN: 3D Lunar Orb, Cycle Simulator & Upcoming Calendar */}
        <div className="hub-3d-subcard p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="hub-label flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-[var(--hub-cyan)]" />
                Sfera Lunare 3D & Ciclo Sinodico
              </div>
              <h3 className="font-display text-2xl font-bold mt-1">{lunar.phaseName}</h3>
              <p className="text-xs text-[var(--hub-dim)] mt-0.5">{lunar.phaseSubtitle}</p>
            </div>
            {dayOffset !== 0 && (
              <button
                type="button"
                onClick={() => setDayOffset(0)}
                className="hub-chip !h-7 text-xs shrink-0"
                title="Torna alla data di oggi"
              >
                <RotateCcw className="w-3 h-3" /> Oggi
              </button>
            )}
          </div>

          {/* 3D Lunar Orb + Key Telemetry */}
          <div className="flex flex-col sm:flex-row items-center gap-5 py-2 px-3 rounded-xl bg-slate-950/75 border border-slate-800/80 text-slate-100">
            <div className="relative flex items-center justify-center py-1">
              <MoonDiskSvg phaseValue={lunar.phaseValue} size={118} showOrbitRing />
            </div>

            <dl className="flex-1 w-full grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              <div className="border-b border-slate-800 pb-1.5">
                <dt className="text-slate-400">Illuminazione Disco</dt>
                <dd className="font-hud text-lg font-bold tabular-nums text-amber-300">
                  {lunar.illuminationPct.toFixed(1)}%
                </dd>
              </div>
              <div className="border-b border-slate-800 pb-1.5">
                <dt className="text-slate-400">Età della Luna</dt>
                <dd className="font-hud text-lg font-bold tabular-nums text-white">
                  {lunar.ageDays.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ 29.5 gg</span>
                </dd>
              </div>
              <div className="border-b border-slate-800 pb-1.5">
                <dt className="text-slate-400">Distanza Orbitale</dt>
                <dd className="font-hud text-sm font-semibold tabular-nums text-cyan-300">
                  {lunar.distanceKm.toLocaleString('it-IT')} km
                </dd>
              </div>
              <div className="border-b border-slate-800 pb-1.5">
                <dt className="text-slate-400">Elongazione / Fase</dt>
                <dd className="font-hud text-sm font-semibold tabular-nums text-slate-200">
                  {lunar.isWaxing ? 'Crescente' : 'Calante'} · {lunar.elongationDeg}°
                </dd>
              </div>
            </dl>
          </div>

          {/* Interactive Lunar Cycle Scrubber */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="lunar-day-scrubber" className="text-[var(--hub-dim)]">
                Simula rotazione fase nei prossimi 30 giorni
              </label>
              <span className="font-hud font-semibold tabular-nums">
                {dayOffset === 0
                  ? 'Oggi (Tempo Reale)'
                  : `+${dayOffset} gg (${targetDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })})`}
              </span>
            </div>
            <input
              id="lunar-day-scrubber"
              type="range"
              min={0}
              max={29}
              step={1}
              value={dayOffset}
              onChange={(e) => setDayOffset(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 rounded-lg"
            />
          </div>

          {/* Upcoming 4 Principal Phases */}
          <div className="pt-2 border-t border-[var(--hub-line)]">
            <div className="hub-label mb-2">Prossimi Appuntamenti Lunari</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {lunar.upcomingPhases.map((p) => {
                const phasePreviewVal =
                  p.type === 'new' ? 0 : p.type === 'first_quarter' ? 0.25 : p.type === 'full' ? 0.5 : 0.75;
                return (
                  <div key={p.type} className="flex items-center gap-2 py-1">
                    <MoonDiskSvg phaseValue={phasePreviewVal} size={26} />
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{p.name}</div>
                      <div className="text-[var(--hub-dim)] font-hud tabular-nums">
                        {p.date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useMemo } from 'react';
import { Flower2, ShieldCheck, AlertTriangle, Wind, Droplets, Sparkles, Activity } from 'lucide-react';
import { AirQualityData, LocationInfo } from '../types';

interface PollenBulletinCardProps {
  location: LocationInfo;
  airQuality?: AirQualityData;
  humidity: number;
  windSpeed: number;
  isDark: boolean;
}

interface AllergenSpec {
  id: 'grass' | 'olive' | 'birch' | 'ragweed' | 'alder' | 'mugwort';
  name: string;
  latin: string;
  season: string;
  color: string;
  moderateThreshold: number;
  highThreshold: number;
  value: number;
  peak24h: number;
}

function classifyAllergenLevel(val: number, mod: number, high: number): {
  label: 'Assente' | 'Basso' | 'Moderato' | 'Alto' | 'Molto Alto';
  badgeClass: string;
  barColor: string;
} {
  if (val <= 0.4) {
    return {
      label: 'Assente',
      badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      barColor: '#10b981',
    };
  }
  if (val < mod) {
    return {
      label: 'Basso',
      badgeClass: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
      barColor: '#2dd4bf',
    };
  }
  if (val < high) {
    return {
      label: 'Moderato',
      badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      barColor: '#f59e0b',
    };
  }
  if (val < high * 2.2) {
    return {
      label: 'Alto',
      badgeClass: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
      barColor: '#f97316',
    };
  }
  return {
    label: 'Molto Alto',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    barColor: '#f43f5e',
  };
}

export const PollenBulletinCard: React.FC<PollenBulletinCardProps> = ({
  location,
  airQuality,
  humidity,
  windSpeed,
}) => {
  const pollen = airQuality?.pollen;

  const allergens = useMemo<AllergenSpec[]>(() => {
    const h = pollen?.hourly ?? [];
    const peakOf = (key: AllergenSpec['id'], fallback: number) =>
      h.length > 0 ? Math.max(fallback, ...h.map((item) => item[key])) : fallback;

    return [
      {
        id: 'grass',
        name: 'Graminacee',
        latin: 'Poaceae',
        season: 'Apr – Lug',
        color: '#22c55e',
        moderateThreshold: 15,
        highThreshold: 50,
        value: pollen?.grass ?? 0,
        peak24h: peakOf('grass', pollen?.grass ?? 0),
      },
      {
        id: 'olive',
        name: 'Olivo',
        latin: 'Olea europaea',
        season: 'Mag – Giu',
        color: '#eab308',
        moderateThreshold: 20,
        highThreshold: 80,
        value: pollen?.olive ?? 0,
        peak24h: peakOf('olive', pollen?.olive ?? 0),
      },
      {
        id: 'birch',
        name: 'Betulla',
        latin: 'Betula',
        season: 'Mar – Mag',
        color: '#38bdf8',
        moderateThreshold: 15,
        highThreshold: 50,
        value: pollen?.birch ?? 0,
        peak24h: peakOf('birch', pollen?.birch ?? 0),
      },
      {
        id: 'ragweed',
        name: 'Ambrosia',
        latin: 'Ambrosia artemisiifolia',
        season: 'Ago – Ott',
        color: '#f43f5e',
        moderateThreshold: 10,
        highThreshold: 30,
        value: pollen?.ragweed ?? 0,
        peak24h: peakOf('ragweed', pollen?.ragweed ?? 0),
      },
      {
        id: 'alder',
        name: 'Ontano',
        latin: 'Alnus',
        season: 'Gen – Apr',
        color: '#a855f7',
        moderateThreshold: 15,
        highThreshold: 60,
        value: pollen?.alder ?? 0,
        peak24h: peakOf('alder', pollen?.alder ?? 0),
      },
      {
        id: 'mugwort',
        name: 'Artemisia',
        latin: 'Artemisia vulgaris',
        season: 'Lug – Ott',
        color: '#fb923c',
        moderateThreshold: 10,
        highThreshold: 35,
        value: pollen?.mugwort ?? 0,
        peak24h: peakOf('mugwort', pollen?.mugwort ?? 0),
      },
    ];
  }, [pollen]);

  const totalGrains = pollen?.totalGrains ?? 0;
  const maxPeak24h = Math.max(
    totalGrains,
    ...(pollen?.hourly?.map((h) => h.total) ?? [0])
  );

  // Combined respiratory sensitivity score (0-100): considers pollen + PM10/PM2.5 + wind dispersion
  const pm10 = airQuality?.pm10 ?? 15;
  const pm25 = airQuality?.pm2_5 ?? 8;
  const respiratoryIndex = Math.min(
    100,
    Math.round(totalGrains * 0.9 + pm25 * 1.1 + pm10 * 0.45 + (windSpeed > 25 ? 8 : 0))
  );

  const overallBadge = useMemo(() => {
    switch (pollen?.overallRisk) {
      case 'molto_alto':
        return { text: 'Critico / Molto Alto', color: 'text-rose-400 bg-rose-500/15 border-rose-500/35' };
      case 'alto':
        return { text: 'Rischio Alto', color: 'text-orange-400 bg-orange-500/15 border-orange-500/35' };
      case 'moderato':
        return { text: 'Rischio Moderato', color: 'text-amber-400 bg-amber-500/15 border-amber-500/35' };
      case 'basso':
        return { text: 'Concentrazione Bassa', color: 'text-teal-400 bg-teal-500/15 border-teal-500/35' };
      default:
        return { text: 'Quiescenza Pollinica (0 gr/m³)', color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/35' };
    }
  }, [pollen?.overallRisk]);

  return (
    <div className="hub-panel p-5 sm:p-7 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--hub-line)] pb-4">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-2xl grid place-items-center shrink-0 bg-emerald-500/15 border border-emerald-400/35 text-emerald-400 shadow-lg shadow-emerald-500/10">
            <Flower2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <span className="hub-label flex items-center gap-1.5">
                <span className="hub-live-dot" /> Copernicus CAMS · Aerobiologia Live
              </span>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${overallBadge.color}`}>
                {overallBadge.text}
              </span>
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-bold mt-0.5 truncate">
              Bollettino Pollini & Allergeni · {location.name}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="hub-label">Carica Pollinica Totale</div>
            <div className="font-hud text-2xl font-bold tabular-nums text-emerald-400">
              {totalGrains.toFixed(1)} <span className="text-xs font-normal text-[var(--hub-dim)]">granuli/m³</span>
            </div>
          </div>
          <div className="h-9 w-px bg-[var(--hub-line)]" />
          <div className="text-right">
            <div className="hub-label">Picco 24h Previsto</div>
            <div className="font-hud text-2xl font-bold tabular-nums text-amber-400">
              {maxPeak24h.toFixed(1)} <span className="text-xs font-normal text-[var(--hub-dim)]">gr/m³</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left 3D Isometric Bio-Prism Chart + Right 6 Species Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: 3D Extruded Bio-Aerosol Spectrum & Respiratory Index */}
        <div className="lg:col-span-5 hub-3d-subcard p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="hub-label flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Spettro 3D Famiglie Polliniche (CAMS)
              </span>
              <span className="font-hud text-xs text-[var(--hub-dim)]">Scala 0–100 gr/m³</span>
            </div>

            {/* 3D Isometric Prism Chart for 6 Allergens */}
            <svg viewBox="0 0 340 175" className="w-full h-auto rounded-xl bg-slate-950/75 border border-white/10 p-2">
              <defs>
                <linearGradient id="pollen-stage-grid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="#020617" stopOpacity="0.85" />
                </linearGradient>
              </defs>

              {/* 3D Isometric Pedestal Base */}
              <polygon
                points="20,142 42,126 322,126 300,142"
                fill="url(#pollen-stage-grid)"
                stroke="rgba(52,211,153,0.35)"
                strokeWidth="1"
              />
              {/* Reference lines */}
              {[35, 68, 102].map((y, idx) => (
                <line
                  key={idx}
                  x1="28"
                  y1={y}
                  x2="314"
                  y2={y}
                  stroke="rgba(148,163,184,0.14)"
                  strokeDasharray="3 3"
                />
              ))}

              {allergens.map((a, idx) => {
                const x = 36 + idx * 46;
                const baseY = 135;
                // Minimum visual 3D plinth height (10px) even at 0.0 gr/m³ so the 3D prism sits cleanly on the deck
                const ratio = Math.min(1, Math.max(a.value, a.peak24h * 0.5) / a.highThreshold);
                const h = Math.max(10, Math.round(ratio * 84));
                const topY = baseY - h;
                const w = 22;
                const dx = 8;
                const dy = -6;

                return (
                  <g key={a.id}>
                    {/* Front face */}
                    <rect
                      x={x}
                      y={topY}
                      width={w}
                      height={h}
                      fill={a.color}
                      fillOpacity={a.value > 0 ? 0.85 : 0.28}
                      stroke={a.color}
                      strokeWidth="1"
                    />
                    {/* Right extruded 3D face */}
                    <polygon
                      points={`${x + w},${topY} ${x + w + dx},${topY + dy} ${x + w + dx},${baseY + dy} ${x + w},${baseY}`}
                      fill={a.color}
                      fillOpacity={a.value > 0 ? 0.52 : 0.18}
                      stroke={a.color}
                      strokeWidth="0.8"
                    />
                    {/* Top illuminated 3D cap */}
                    <polygon
                      points={`${x},${topY} ${x + dx},${topY + dy} ${x + w + dx},${topY + dy} ${x + w},${topY}`}
                      fill="#ffffff"
                      fillOpacity={a.value > 0 ? 0.45 : 0.2}
                      stroke={a.color}
                      strokeWidth="0.8"
                    />
                    {/* Live value above prism */}
                    <text
                      x={x + w / 2 + 3}
                      y={topY - 9}
                      textAnchor="middle"
                      fill="#f8fafc"
                      fontSize="9.5"
                      fontWeight="700"
                    >
                      {a.value.toFixed(1)}
                    </text>
                    {/* Allergen short label */}
                    <text
                      x={x + w / 2 + 2}
                      y={158}
                      textAnchor="middle"
                      fill="#cbd5e1"
                      fontSize="9"
                      fontWeight="600"
                    >
                      {a.name.slice(0, 6)}.
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Combined Respiratory & Bio-Aerosol Index */}
          <div className="p-3.5 rounded-xl border border-[var(--hub-line)] bg-[var(--hub-panel)] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-cyan-400" />
                Indice Irritazione Respiratoria (Pollini + PM)
              </span>
              <span className="font-hud text-sm font-bold text-cyan-400">{respiratoryIndex}/100</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 transition-all duration-500"
                style={{ width: `${Math.max(6, respiratoryIndex)}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-[var(--hub-dim)]">
              <div className="flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Umidità: <strong className="text-[var(--hub-text)]">{humidity}%</strong> {humidity > 70 ? '(abbatte i pollini)' : '(dispersione attiva)'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Vento: <strong className="text-[var(--hub-text)]">{windSpeed} km/h</strong> {windSpeed > 20 ? '(trasporto anemofilo)' : '(calmo)'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: 6 Botanical Families Grid + 24h Trend */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {allergens.map((a) => {
              const tier = classifyAllergenLevel(a.value, a.moderateThreshold, a.highThreshold);
              const pct = Math.min(100, Math.max(4, (a.value / a.highThreshold) * 100));
              return (
                <div
                  key={a.id}
                  className="hub-3d-subcard p-3.5 flex flex-col justify-between gap-2.5"
                  style={{ borderTop: `2px solid ${a.color}` }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-display font-bold text-sm truncate">{a.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${tier.badgeClass}`}>
                        {tier.label}
                      </span>
                    </div>
                    <div className="text-[11px] italic text-[var(--hub-dim)]">{a.latin}</div>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-hud text-2xl font-bold tabular-nums">
                        {a.value.toFixed(1)}
                        <span className="text-xs font-normal text-[var(--hub-dim)] ml-1">gr/m³</span>
                      </div>
                      <span className="font-hud text-[11px] text-[var(--hub-dim)]">
                        Max 24h: {a.peak24h.toFixed(1)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800/80 mt-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: a.color }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[var(--hub-dim)] pt-1 border-t border-[var(--hub-line)]">
                    <span>Fioritura IT:</span>
                    <strong className="font-hud text-[var(--hub-text)]">{a.season}</strong>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Clinical & Seasonal Advisory Strip */}
          <div className="hub-3d-subcard p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              {totalGrains > 15 ? (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div className="text-xs space-y-0.5">
                <div className="font-bold text-sm">
                  {totalGrains > 15
                    ? `Allergene prevalente: ${pollen?.dominantAllergen}`
                    : 'Concentrazione pollinica minima o stagionalmente quiescente'}
                </div>
                <p className="text-[var(--hub-dim)] leading-relaxed">
                  {totalGrains > 15
                    ? 'Si consiglia ai soggetti allergici di indossare occhiali da sole all’aperto e ricambiare l’aria domestica solo dopo il tramonto o dopo la pioggia.'
                    : 'I sensori CAMS rilevano concentrazioni prossime allo zero per le 6 principali famiglie allergizzanti. Condizioni ottimali per soggetti allergici.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

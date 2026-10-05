import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Calendar,
  CloudRain,
  Wind,
  Droplets,
  Thermometer,
  BarChart3,
  Sun,
  Cloud,
  CloudLightning,
  CloudFog,
  Snowflake,
  Sparkles,
  Clock,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { HourlyForecastItem, DailyForecastItem } from '../types';
import { formatTemp } from '../services/weatherFormat';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { chartTheme, PHENOMENON_COLORS } from '../theme/chartTheme';

interface ForecastChartsProps {
  hourly: HourlyForecastItem[];
  daily: DailyForecastItem[];
  isDark: boolean;
}

interface PhenomenonGroup {
  name: string;
  categoryKey: string;
  hours: number;
  percentage: number;
  color: string;
  textColor: string;
  bgLight: string;
  icon: React.ComponentType<{ className?: string }>;
  timeSlots: string[];
}

export const ForecastCharts: React.FC<ForecastChartsProps> = ({ hourly, daily, isDark }) => {
  const [activeTab, setActiveTab] = useState<'hourly' | 'pie' | 'daily'>('hourly');
  const [dailyRange, setDailyRange] = useState<'5days' | '7days'>('5days');
  const [chartMetric, setChartMetric] = useState<'temp-rain' | 'humidity-cape'>('temp-rain');
  const ct = chartTheme(isDark);

  // Compute 24-hour weather phenomena breakdown
  const { phenomenaData, hourStrip, dominantPhenomenon, totalRainHours, totalDryHours } = useMemo(() => {
    const next24 = hourly.slice(0, 24);
    const totalCount = next24.length || 24;

    const groups: Record<string, {
      name: string;
      categoryKey: string;
      color: string;
      textColor: string;
      bgLight: string;
      icon: React.ComponentType<{ className?: string }>;
      timeSlots: string[];
    }> = {
      clear: {
        name: 'Sereno / Sole',
        categoryKey: 'clear',
        color: PHENOMENON_COLORS.clear,
        textColor: 'text-amber-400',
        bgLight: 'bg-amber-500/10 border-amber-500/30',
        icon: Sun,
        timeSlots: [],
      },
      cloudy: {
        name: 'Nuvoloso / Coperto',
        categoryKey: 'cloudy',
        color: PHENOMENON_COLORS.cloudy,
        textColor: 'text-slate-500 dark:text-slate-300',
        bgLight: 'bg-slate-500/10 border-slate-500/30',
        icon: Cloud,
        timeSlots: [],
      },
      rain: {
        name: 'Pioggia & Rovesci',
        categoryKey: 'rain',
        color: PHENOMENON_COLORS.rain,
        textColor: 'text-sky-400',
        bgLight: 'bg-sky-500/10 border-sky-500/30',
        icon: CloudRain,
        timeSlots: [],
      },
      storm: {
        name: 'Temporali & Lampi',
        categoryKey: 'storm',
        color: PHENOMENON_COLORS.storm,
        textColor: 'text-purple-400',
        bgLight: 'bg-purple-500/10 border-purple-500/30',
        icon: CloudLightning,
        timeSlots: [],
      },
      fog: {
        name: 'Nebbia / Foschia',
        categoryKey: 'fog',
        color: PHENOMENON_COLORS.fog,
        textColor: 'text-slate-500 dark:text-slate-300',
        bgLight: 'bg-teal-500/10 border-teal-500/30',
        icon: CloudFog,
        timeSlots: [],
      },
      snow: {
        name: 'Neve & Gelicidio',
        categoryKey: 'snow',
        color: PHENOMENON_COLORS.snow,
        textColor: 'text-sky-400',
        bgLight: 'bg-cyan-500/10 border-cyan-500/30',
        icon: Snowflake,
        timeSlots: [],
      },
    };

    let rainHours = 0;
    const strip: Array<{ hour: string; key: string }> = [];

    next24.forEach((item) => {
      const code = item.weatherCode;
      const hour = item.hourLabel;
      const before = Object.fromEntries(Object.entries(groups).map(([k, g]) => [k, g.timeSlots.length]));

      if (code === 0 || code === 1) {
        groups.clear.timeSlots.push(hour);
      } else if (code === 2 || code === 3) {
        groups.cloudy.timeSlots.push(hour);
      } else if (code === 45 || code === 48) {
        groups.fog.timeSlots.push(hour);
      } else if (code >= 51 && code <= 65 || code === 80 || code === 81) {
        groups.rain.timeSlots.push(hour);
        rainHours++;
      } else if (code >= 71 && code <= 77 || code === 85 || code === 86) {
        groups.snow.timeSlots.push(hour);
        rainHours++;
      } else if (code >= 82 && code <= 99) {
        groups.storm.timeSlots.push(hour);
        rainHours++;
      } else {
        groups.cloudy.timeSlots.push(hour);
      }
      const key = Object.keys(groups).find((k) => groups[k].timeSlots.length > before[k]) ?? 'cloudy';
      strip.push({ hour, key });
    });

    const activeList: PhenomenonGroup[] = Object.values(groups)
      .filter((g) => g.timeSlots.length > 0)
      .map((g) => ({
        name: g.name,
        categoryKey: g.categoryKey,
        hours: g.timeSlots.length,
        percentage: Math.round((g.timeSlots.length / totalCount) * 100),
        color: g.color,
        textColor: g.textColor,
        bgLight: g.bgLight,
        icon: g.icon,
        timeSlots: g.timeSlots,
      }))
      .sort((a, b) => b.hours - a.hours);

    const dominant = activeList.length > 0 ? activeList[0] : null;

    return {
      phenomenaData: activeList,
      hourStrip: strip,
      dominantPhenomenon: dominant,
      totalRainHours: rainHours,
      totalDryHours: totalCount - rainHours,
    };
  }, [hourly]);

  const displayedDaily = dailyRange === '5days' ? daily.slice(0, 5) : daily.slice(0, 7);

  return (
    <div
      id="forecast-charts-card"
      className={`rounded-2xl p-6 transition-all duration-300 border ${
        isDark
          ? 'bg-slate-900/90 border-slate-800/90 text-slate-100 shadow-xl shadow-black/20'
          : 'bg-white/95 border-slate-200 text-slate-900 shadow-lg shadow-slate-200/50'
      }`}
    >
      {/* Header with Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
              Grafici & Previsioni Elaborate
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Andamento orario, fenomeni delle prossime 24 ore e tendenza a 5-7 giorni
            </p>
          </div>
        </div>

        {/* View Switchers */}
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'hourly' && (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <button
                onClick={() => setChartMetric('temp-rain')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  chartMetric === 'temp-rain'
                    ? 'bg-indigo-500 text-white'
                    : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Temp / Pioggia
              </button>
              <button
                onClick={() => setChartMetric('humidity-cape')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  chartMetric === 'humidity-cape'
                    ? 'bg-cyan-500 text-white dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Umidità / CAPE
              </button>
            </div>
          )}

          {activeTab === 'daily' && (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <button
                onClick={() => setDailyRange('5days')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  dailyRange === '5days'
                    ? 'bg-teal-500 text-white dark:text-slate-950 shadow-sm'
                    : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                5 Giorni
              </button>
              <button
                onClick={() => setDailyRange('7days')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  dailyRange === '7days'
                    ? 'bg-teal-500 text-white dark:text-slate-950 shadow-sm'
                    : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                7 Giorni
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <button
              id="tab-hourly-forecast-btn"
              onClick={() => setActiveTab('hourly')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                activeTab === 'hourly'
                  ? 'bg-teal-500 text-white dark:text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              24 Ore
            </button>
            <button
              id="tab-pie-phenomena-btn"
              onClick={() => setActiveTab('pie')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'pie'
                  ? 'bg-teal-500 text-white dark:text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Fenomeni 24h</span>
            </button>
            <button
              id="tab-daily-forecast-btn"
              onClick={() => setActiveTab('daily')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                activeTab === 'daily'
                  ? 'bg-teal-500 text-white dark:text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {dailyRange === '5days' ? '5 Giorni' : '7 Giorni'}
            </button>
          </div>
        </div>
      </div>

      {/* Hourly Chart View */}
      {activeTab === 'hourly' && (
        <div className="space-y-6">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartMetric === 'temp-rain' ? (
                <ComposedChart data={hourly} margin={{ top: 10, right: 4, left: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={ct.grid} strokeDasharray="2 4" />
                  <XAxis dataKey="hourLabel" tick={{ fontSize: 12, fill: ct.axis, fontFamily: ct.font }} tickLine={false} axisLine={false} minTickGap={12} />
                  <YAxis yAxisId="left" width={44} domain={['auto', 'auto']} tick={{ fontSize: 12, fill: ct.axis, fontFamily: ct.font }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatTemp(v, { unit: false })} />
                  <YAxis yAxisId="right" orientation="right" width={44} domain={[0, 100]} tick={{ fontSize: 12, fill: ct.axis, fontFamily: ct.font }} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip
                    contentStyle={ct.tooltip}
                    labelFormatter={(l) => `Ore ${l}`}
                    formatter={(v: number, name: string) => [name.startsWith('Temperatura') ? formatTemp(v, { decimals: 1 }) : `${v}%`, name]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value: string) => <span style={{ color: ct.text }}>{value}</span>}
                  />
                  <Bar yAxisId="right" dataKey="precipitationProbability" name="Probabilità pioggia (%)" fill={ct.series.rain} fillOpacity={0.55} radius={[3, 3, 0, 0]} />
                  <Line yAxisId="left" type="monotone" dataKey="temperature" name="Temperatura (°C)" stroke={ct.series.temp} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </ComposedChart>
              ) : (
                <ComposedChart data={hourly} margin={{ top: 10, right: 4, left: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={ct.grid} strokeDasharray="2 4" />
                  <XAxis dataKey="hourLabel" tick={{ fontSize: 12, fill: ct.axis, fontFamily: ct.font }} tickLine={false} axisLine={false} minTickGap={12} />
                  <YAxis yAxisId="left" width={44} domain={[0, 100]} tick={{ fontSize: 12, fill: ct.axis, fontFamily: ct.font }} tickLine={false} axisLine={false} unit="%" />
                  <YAxis yAxisId="right" orientation="right" width={52} domain={[0, (max: number) => Math.max(3000, Math.ceil(max / 500) * 500)]} tick={{ fontSize: 12, fill: ct.axis, fontFamily: ct.font }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={ct.tooltip}
                    labelFormatter={(l) => `Ore ${l}`}
                    formatter={(v: number, name: string) => [name.startsWith('CAPE') ? `${Math.round(v)} J/kg` : `${v}%`, name]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value: string) => <span style={{ color: ct.text }}>{value}</span>}
                  />
                  {/* CAPE thresholds: >1000 moderate, >2500 strong convective instability */}
                  <ReferenceLine yAxisId="right" y={1000} stroke={ct.axis} strokeDasharray="4 4" label={{ value: 'Instabilità moderata', position: 'insideTopRight', fill: ct.axis, fontSize: 12 }} />
                  <ReferenceLine yAxisId="right" y={2500} stroke={ct.axis} strokeDasharray="4 4" label={{ value: 'Instabilità forte', position: 'insideTopRight', fill: ct.axis, fontSize: 12 }} />
                  <Bar yAxisId="right" dataKey="cape" name="CAPE – energia convettiva (J/kg)" fill={ct.series.cape} fillOpacity={0.5} radius={[3, 3, 0, 0]} />
                  <Line yAxisId="left" type="monotone" dataKey="humidity" name="Umidità (%)" stroke={ct.series.humidity} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Hourly Timeline Cards */}
          <div className="flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
            {hourly.slice(0, 14).map((item, idx) => (
              <div
                key={idx}
                className={`min-w-[88px] p-3 rounded-xl border flex flex-col items-center gap-1.5 shrink-0 ${
                  isDark ? 'bg-slate-800/70 border-slate-700/70 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <span className="text-xs font-bold text-slate-500 dark:text-slate-200">{item.hourLabel}</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{item.temperature}°C</span>
                <div className="flex items-center gap-1 text-xs text-cyan-500 dark:text-cyan-300 font-semibold">
                  <Droplets className="w-2.5 h-2.5" />
                  {item.humidity}%
                </div>
                {item.precipitationProbability > 0 ? (
                  <div className="flex items-center gap-1 text-xs text-sky-400 font-bold">
                    <CloudRain className="w-2.5 h-2.5" />
                    {item.precipitationProbability}%
                  </div>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-300 font-medium">0%</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 24 h weather phenomena: timeline + breakdown */}
      {activeTab === 'pie' && (
        <div className="space-y-6 animate-toast-in">
          {/* Top Summary Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {dominantPhenomenon && (
              <div
                className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
                  isDark ? 'bg-slate-800/70 border-slate-700/70' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className={`p-3 rounded-xl ${dominantPhenomenon.bgLight} ${dominantPhenomenon.textColor}`}>
                  <dominantPhenomenon.icon className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs uppercase font-bold text-slate-400 dark:text-slate-300 tracking-wider">
                    Fenomeno Prevalente 24h
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {dominantPhenomenon.name}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {dominantPhenomenon.hours} ore ({dominantPhenomenon.percentage}% della giornata)
                  </div>
                </div>
              </div>
            )}

            <div
              className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
                isDark ? 'bg-slate-800/70 border-slate-700/70' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="p-3 rounded-xl bg-sky-500/15 text-sky-400">
                <CloudRain className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs uppercase font-bold text-slate-400 dark:text-slate-300 tracking-wider">
                  Finestra Precipitazioni
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {totalRainHours > 0 ? `${totalRainHours} ore con pioggia / temporali` : 'Nessuna pioggia prevista'}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  {totalDryHours} ore asciutte su 24h
                </div>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
                isDark ? 'bg-slate-800/70 border-slate-700/70' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="p-3 rounded-xl bg-purple-500/15 text-purple-400">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs uppercase font-bold text-slate-400 dark:text-slate-300 tracking-wider">
                  Attività Convettiva CAPE
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {phenomenaData.some((p) => p.categoryKey === 'storm')
                    ? 'Rischio temporali attivo'
                    : 'Atmosfera stabile'}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  Stima dai codici meteo orari
                </div>
              </div>
            </div>
          </div>

          {/* 24-hour timeline: one cell per hour, coloured by phenomenon (shows *when*) */}
          <div>
            <div className="flex w-full h-8 rounded-lg overflow-hidden ring-1 ring-black/5 dark:ring-white/10" role="img"
              aria-label={phenomenaData.map((p) => `${p.name}: ${p.hours} ore`).join(', ')}>
              {hourStrip.map((c, i) => (
                <span key={i} className="flex-1 border-r border-white/40 dark:border-slate-900/40 last:border-r-0"
                  style={{ background: PHENOMENON_COLORS[c.key as keyof typeof PHENOMENON_COLORS] }}
                  title={`${c.hour} – ${phenomenaData.find((p) => p.categoryKey === c.key)?.name ?? ''}`} />
              ))}
            </div>
            <div className="flex justify-between mt-1.5 text-xs font-hud text-slate-500 dark:text-slate-300">
              {hourStrip.filter((_, i) => i % 6 === 0).map((c) => <span key={c.hour}>{c.hour}</span>)}
              <span>+24h</span>
            </div>
          </div>

          {/* Breakdown list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {phenomenaData.map((item) => {
              const IconComponent = item.icon;
              return (
                <div key={item.categoryKey} className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: item.color }} aria-hidden="true" />
                      <IconComponent className={`w-4 h-4 ${item.textColor} shrink-0`} />
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-100">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                      {item.hours} h <span className="font-semibold text-slate-500 dark:text-slate-300">({item.percentage}%)</span>
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1 text-xs text-slate-500 dark:text-slate-300">
                    {item.timeSlots.slice(0, 8).map((slot, sIdx) => (
                      <span key={sIdx} className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 font-semibold">{slot}</span>
                    ))}
                    {item.timeSlots.length > 8 && <span>+{item.timeSlots.length - 8} altre</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily Forecast View (5 or 7 Days) */}
      {activeTab === 'daily' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 px-1 pb-1">
            <span>Visualizzazione: <strong className="text-slate-900 dark:text-white">{dailyRange === '5days' ? 'Previsioni a 5 Giorni' : 'Previsioni a 7 Giorni'}</strong></span>
            <span>Temperature Max / Min • Rischio Pioggia</span>
          </div>

          {displayedDaily.map((item, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border flex items-center justify-between transition-colors ${
                isDark ? 'bg-slate-800/60 border-slate-700/70 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="w-24 font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span>{item.dayLabel}</span>
                {idx === 0 && <span className="text-xs px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-400">Oggi</span>}
              </div>

              <div className="flex-1 px-4 text-xs font-semibold text-slate-800 dark:text-slate-200">
                {item.weatherDescription}
              </div>

              {item.precipitationProbability > 0 ? (
                <div className="flex items-center gap-1 text-xs font-bold text-sky-400 w-20">
                  <CloudRain className="w-3.5 h-3.5" />
                  {item.precipitationProbability}%
                </div>
              ) : (
                <div className="w-20 text-xs text-slate-500 dark:text-slate-300 font-semibold">0%</div>
              )}

              <div className="flex items-center gap-2 text-sm font-bold w-28 justify-end">
                <span className="text-amber-500 dark:text-amber-400">{formatTemp(item.maxTemp, { unit: false })}</span>
                <span className="text-slate-500 dark:text-slate-300 font-normal">/</span>
                <span className="text-cyan-400 dark:text-cyan-300">{formatTemp(item.minTemp, { unit: false })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


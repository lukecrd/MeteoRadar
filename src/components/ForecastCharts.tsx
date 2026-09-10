import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Calendar,
  CloudRain,
  Wind,
  Droplets,
  Thermometer,
  PieChart as PieIcon,
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
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  Sector
} from 'recharts';

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
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);

  // Compute 24-hour weather phenomena breakdown
  const { phenomenaData, dominantPhenomenon, totalRainHours, totalDryHours } = useMemo(() => {
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
        color: '#f59e0b',
        textColor: 'text-amber-400',
        bgLight: 'bg-amber-500/10 border-amber-500/30',
        icon: Sun,
        timeSlots: [],
      },
      cloudy: {
        name: 'Nuvoloso / Coperto',
        categoryKey: 'cloudy',
        color: '#94a3b8',
        textColor: 'text-slate-300',
        bgLight: 'bg-slate-500/10 border-slate-500/30',
        icon: Cloud,
        timeSlots: [],
      },
      rain: {
        name: 'Pioggia & Rovesci',
        categoryKey: 'rain',
        color: '#38bdf8',
        textColor: 'text-sky-400',
        bgLight: 'bg-sky-500/10 border-sky-500/30',
        icon: CloudRain,
        timeSlots: [],
      },
      storm: {
        name: 'Temporali & Lampi',
        categoryKey: 'storm',
        color: '#c084fc',
        textColor: 'text-purple-400',
        bgLight: 'bg-purple-500/10 border-purple-500/30',
        icon: CloudLightning,
        timeSlots: [],
      },
      fog: {
        name: 'Nebbia / Foschia',
        categoryKey: 'fog',
        color: '#2dd4bf',
        textColor: 'text-teal-300',
        bgLight: 'bg-teal-500/10 border-teal-500/30',
        icon: CloudFog,
        timeSlots: [],
      },
      snow: {
        name: 'Neve & Gelicidio',
        categoryKey: 'snow',
        color: '#7dd3fc',
        textColor: 'text-cyan-300',
        bgLight: 'bg-cyan-500/10 border-cyan-500/30',
        icon: Snowflake,
        timeSlots: [],
      },
    };

    let rainHours = 0;

    next24.forEach((item) => {
      const code = item.weatherCode;
      const hour = item.hourLabel;

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
              Evoluzione atmosferica 24h, analisi a torta dei fenomeni & trend a 5-7 giorni
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
                    ? 'bg-cyan-500 text-white'
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
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                5 Giorni
              </button>
              <button
                onClick={() => setDailyRange('7days')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  dailyRange === '7days'
                    ? 'bg-teal-500 text-white shadow-sm'
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
                  ? 'bg-teal-500 text-white shadow-sm'
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
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5" />
              <span>Torta Fenomeni 24h</span>
            </button>
            <button
              id="tab-daily-forecast-btn"
              onClick={() => setActiveTab('daily')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                activeTab === 'daily'
                  ? 'bg-teal-500 text-white shadow-sm'
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
                <ComposedChart data={hourly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="hourLabel" tick={{ fontSize: 11, fill: isDark ? '#cbd5e1' : '#475569' }} />
                  <YAxis
                    yAxisId="left"
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 11, fill: isDark ? '#cbd5e1' : '#475569' }}
                    unit="°"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: isDark ? '#cbd5e1' : '#475569' }}
                    unit="%"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderColor: isDark ? '#475569' : '#cbd5e1',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                      color: isDark ? '#f8fafc' : '#0f172a'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', color: isDark ? '#e2e8f0' : '#1e293b' }} />
                  <Bar
                    yAxisId="right"
                    dataKey="precipitationProbability"
                    name="Prob. Pioggia (%)"
                    fill="#38bdf8"
                    opacity={0.7}
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="temperature"
                    name="Temperatura (°C)"
                    stroke="#f59e0b"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#f59e0b' }}
                  />
                </ComposedChart>
              ) : (
                <ComposedChart data={hourly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="hourLabel" tick={{ fontSize: 11, fill: isDark ? '#cbd5e1' : '#475569' }} />
                  <YAxis
                    yAxisId="left"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: isDark ? '#cbd5e1' : '#475569' }}
                    unit="%"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 11, fill: isDark ? '#cbd5e1' : '#475569' }}
                    unit="J"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderColor: isDark ? '#475569' : '#cbd5e1',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                      color: isDark ? '#f8fafc' : '#0f172a'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', color: isDark ? '#e2e8f0' : '#1e293b' }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="humidity"
                    name="Umidità (%)"
                    stroke="#06b6d4"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#06b6d4' }}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="cape"
                    name="Indice CAPE Fulmini (J/kg)"
                    fill="#a855f7"
                    opacity={0.6}
                    radius={[4, 4, 0, 0]}
                  />
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
                <span className="text-sm font-black text-slate-900 dark:text-white">{item.temperature}°C</span>
                <div className="flex items-center gap-1 text-[11px] text-cyan-500 dark:text-cyan-300 font-semibold">
                  <Droplets className="w-2.5 h-2.5" />
                  {item.humidity}%
                </div>
                {item.precipitationProbability > 0 ? (
                  <div className="flex items-center gap-1 text-[11px] text-sky-400 font-bold">
                    <CloudRain className="w-2.5 h-2.5" />
                    {item.precipitationProbability}%
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-500 dark:text-slate-300 font-medium">0%</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pie Chart Weather Phenomena Breakdown View (Recharts) */}
      {activeTab === 'pie' && (
        <div className="space-y-6 animate-in fade-in duration-300">
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
                  <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-300 tracking-wider">
                    Fenomeno Prevalente 24h
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
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
                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-300 tracking-wider">
                  Finestra Precipitazioni
                </div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">
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
                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-300 tracking-wider">
                  Attività Convettiva CAPE
                </div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {phenomenaData.some((p) => p.categoryKey === 'storm')
                    ? 'Rischio temporali attivo'
                    : 'Atmosfera stabile'}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  Monitoraggio scariche radar attivo
                </div>
              </div>
            </div>
          </div>

          {/* Main Pie Chart & Breakdown List */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Recharts Pie Chart */}
            <div className="lg:col-span-7 h-72 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    formatter={(value: any, name: any, item: any) => [
                      `${value} ore (${item?.payload?.percentage || 0}%)`,
                      name
                    ]}
                    contentStyle={{
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderColor: isDark ? '#475569' : '#cbd5e1',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                      color: isDark ? '#f8fafc' : '#0f172a',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
                    }}
                  />
                  <Pie
                    data={phenomenaData}
                    dataKey="hours"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                    cornerRadius={6}
                    onMouseEnter={(_, index) => setActivePieIndex(index)}
                    onMouseLeave={() => setActivePieIndex(null)}
                  >
                    {phenomenaData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke={isDark ? '#0f172a' : '#ffffff'}
                        strokeWidth={activePieIndex === index ? 3 : 1.5}
                        opacity={activePieIndex === null || activePieIndex === index ? 1 : 0.6}
                        className="transition-all duration-200 cursor-pointer"
                      />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: isDark ? '#e2e8f0' : '#334155' }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Donut Label */}
              <div className="absolute inset-0 m-auto w-24 h-24 rounded-full flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-300">Totale</span>
                <span className="text-xl font-black text-slate-900 dark:text-white">24h</span>
                <span className="text-[9px] text-teal-400 font-bold">Previsione</span>
              </div>
            </div>

            {/* Detailed Phenomenon List */}
            <div className="lg:col-span-5 space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-400" />
                Ripartizione & Fasce Orarie
              </h4>

              {phenomenaData.map((item, idx) => {
                const IconComponent = item.icon;
                const isHovered = activePieIndex === idx;

                return (
                  <div
                    key={item.categoryKey}
                    onMouseEnter={() => setActivePieIndex(idx)}
                    onMouseLeave={() => setActivePieIndex(null)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isHovered
                        ? isDark
                          ? 'bg-slate-800 border-teal-400/80 shadow-md'
                          : 'bg-slate-100 border-teal-500/80 shadow-md'
                        : isDark
                        ? 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <IconComponent className={`w-4 h-4 ${item.textColor} shrink-0`} />
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          {item.hours}h
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                          ({item.percentage}%)
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 dark:bg-slate-700/70 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>

                    {/* Time slots preview */}
                    <div className="mt-1.5 flex flex-wrap gap-1 text-[10px] text-slate-500 dark:text-slate-300">
                      <span>Ore:</span>
                      {item.timeSlots.slice(0, 8).map((slot, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 font-semibold"
                        >
                          {slot}
                        </span>
                      ))}
                      {item.timeSlots.length > 8 && (
                        <span className="text-slate-500 dark:text-slate-300">+{item.timeSlots.length - 8} altre</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
                {idx === 0 && <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300">Oggi</span>}
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

              <div className="flex items-center gap-2 text-sm font-extrabold w-28 justify-end">
                <span className="text-amber-500 dark:text-amber-400">+{item.maxTemp}°</span>
                <span className="text-slate-500 dark:text-slate-300 font-normal">/</span>
                <span className="text-cyan-400 dark:text-cyan-300">+{item.minTemp}°</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


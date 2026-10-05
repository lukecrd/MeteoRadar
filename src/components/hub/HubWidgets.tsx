import React, { useEffect, useId, useState } from 'react';

/** Tiny area sparkline; colour follows the first→last trend. */
export const Sparkline: React.FC<{ values: number[]; width?: number; height?: number; color?: string; className?: string }> = ({
  values,
  width = 96,
  height = 28,
  color,
  className,
}) => {
  const gid = useId();
  if (values.length < 2) return <svg width={width} height={height} className={className} aria-hidden />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 2 - ((v - min) / span) * (height - 4)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const stroke = color ?? (values[values.length - 1] >= values[0] ? '#34d399' : '#fb7185');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line}L${width},${height}L0,${height}Z`} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.2" fill={stroke} />
    </svg>
  );
};

/** Ticking clocks for the world's main trading cities. */
const CLOCKS: { city: string; tz: string }[] = [
  { city: 'New York', tz: 'America/New_York' },
  { city: 'Londra', tz: 'Europe/London' },
  { city: 'Milano', tz: 'Europe/Rome' },
  { city: 'Tokyo', tz: 'Asia/Tokyo' },
];

export const WorldClocks: React.FC = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-4 overflow-x-auto">
      {CLOCKS.map(({ city, tz }) => (
        <div key={city} className="leading-tight shrink-0">
          <div className="hub-label">{city}</div>
          <div className="font-hud text-sm font-semibold tabular-nums">
            {now.toLocaleTimeString('it-IT', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      ))}
    </div>
  );
};

export const PanelHeader: React.FC<{ code: string; title: string; icon: React.ReactNode; right?: React.ReactNode }> = ({ code, title, icon, right }) => (
  <div className="flex items-center justify-between gap-3 mb-3">
    <div className="min-w-0">
      <div className="hub-label">{code}</div>
      <h3 className="font-display text-base font-bold uppercase flex items-center gap-2 mt-0.5">
        {icon}
        <span className="truncate">{title}</span>
      </h3>
    </div>
    {right}
  </div>
);

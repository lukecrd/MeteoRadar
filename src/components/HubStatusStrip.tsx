import React, { useEffect, useState } from 'react';
import { WeatherData } from '../types';

interface HubStatusStripProps {
  weather: WeatherData | null;
  humidity: number;
  isLoading: boolean;
  hasError: boolean;
  alertCount: number;
}

const Readout: React.FC<{ label: string; value: React.ReactNode; tone?: string }> = ({ label, value, tone }) => (
  <div className="flex flex-col justify-center px-4 py-2.5 min-w-[104px] border-r border-[var(--hub-line)] last:border-r-0">
    <span className="hub-label !text-xs">{label}</span>
    <span className="font-hud text-sm font-semibold tabular-nums whitespace-nowrap" style={tone ? { color: tone } : undefined}>
      {value}
    </span>
  </div>
);

/** One-line telemetry bus: the "instrument cluster" of the hub. */
export const HubStatusStrip: React.FC<HubStatusStripProps> = ({ weather, humidity, isLoading, hasError, alertCount }) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const link = hasError ? { text: 'OFFLINE', tone: 'var(--hub-red)' } : isLoading ? { text: 'SYNC…', tone: 'var(--hub-amber)' } : { text: 'ONLINE', tone: 'var(--success)' };
  const c = weather?.current;
  const loc = weather?.location;

  return (
    <div className="hub-panel overflow-x-auto [scrollbar-width:none]" role="status" aria-live="off">
      <div className="flex items-stretch w-max min-w-full">
        <Readout label="Ora locale" value={now.toLocaleTimeString('it-IT')} />
        <Readout label="UTC" value={now.toISOString().slice(11, 19)} />
        <Readout
          label="Data link"
          tone={link.tone}
          value={
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: link.tone, boxShadow: `0 0 8px ${link.tone}` }} />
              {link.text}
            </span>
          }
        />
        {loc && (
          <Readout
            label="Nodo"
            value={`${loc.latitude.toFixed(2)}° ${loc.longitude.toFixed(2)}°`}
          />
        )}
        {c && (
          <>
            <Readout label="Temp" value={`${c.temperature.toFixed(1)} °C`} tone="var(--hub-cyan)" />
            <Readout label="Umidità" value={`${humidity.toFixed(1)} %`} />
            <Readout label="Vento" value={`${Math.round(c.windSpeed)} km/h`} />
            <Readout label="Pressione" value={`${Math.round(c.pressure)} hPa`} />
          </>
        )}
        <Readout
          label="Allerte"
          tone={alertCount > 0 ? 'var(--hub-red)' : '#34d399'}
          value={alertCount > 0 ? `${alertCount} ATTIVE` : 'NOMINALE'}
        />
      </div>
    </div>
  );
};

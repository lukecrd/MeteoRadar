import React from 'react';
import { CloudRain, Umbrella } from 'lucide-react';
import { RainStep } from '../types';
import { RAIN_STEP_MM, summarizeRain } from '../services/weatherApi';

// A 15-minute step at or above this is drawn as a full bar (10 mm/h, heavy rain).
const FULL_BAR_MM = 2.5;

/** "Will it rain soon?": one sentence plus the next 2 hours in 15-minute bars. */
export const RainNextStrip: React.FC<{ steps: RainStep[] }> = ({ steps }) => {
  if (steps.length === 0) return null;
  const raining = steps.some((s) => s.mm >= RAIN_STEP_MM);
  const Icon = raining ? CloudRain : Umbrella;

  return (
    <section aria-label="Pioggia nelle prossime ore" className="hub-panel px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className={`w-5 h-5 shrink-0 ${raining ? 'text-sky-400' : 'text-fg-muted'}`} aria-hidden />
        <div className="min-w-0">
          <div className="hub-label">Pioggia a breve</div>
          <p className="font-display text-base text-fg">{summarizeRain(steps)}</p>
        </div>
      </div>

      {/* The sentence carries the message; the bars are its picture. */}
      <ol aria-hidden className="flex items-end gap-1.5 ml-auto">
        {steps.map((s, i) => {
          const wet = s.mm >= RAIN_STEP_MM;
          const pct = wet ? Math.max(18, Math.min(100, (s.mm / FULL_BAR_MM) * 100)) : 6;
          return (
            <li key={s.time} className="flex flex-col items-center gap-1 w-9" title={`${s.time.slice(11, 16)} · ${s.mm.toFixed(1)} mm`}>
              <div className="h-9 w-full flex items-end">
                <div
                  className={`w-full rounded-sm ${wet ? 'bg-sky-400' : 'bg-line-strong'}`}
                  style={{ height: `${pct}%` }}
                />
              </div>
              <span className="font-hud text-[11px] text-fg-muted">{i === 0 ? 'Ora' : s.time.slice(11, 16)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

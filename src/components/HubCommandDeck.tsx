import React, { useEffect } from 'react';
import { Layers, Sun, Zap, Radio, Calendar, Wind, Trees, SatelliteDish, LucideIcon } from 'lucide-react';
import { AppTab } from '../types';

interface ModuleDef {
  id: AppTab;
  code: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: string;
}

// 'news' leads the deck: it is the WorldHub home view shown on launch.
const MODULES: ModuleDef[] = [
  { id: 'news', code: '01', label: 'Notizie', hint: 'Mappamondo e feed live', icon: SatelliteDish, tone: '#a78bfa' },
  { id: 'station', code: '02', label: 'Console', hint: 'Tutti i moduli', icon: Layers, tone: '#22d3ee' },
  { id: 'today', code: '03', label: 'Oggi', hint: 'Condizioni e allerte', icon: Sun, tone: '#fbbf24' },
  { id: 'radar', code: '04', label: 'Radar', hint: 'Fulmini e CAPE', icon: Zap, tone: '#fde047' },
  { id: 'italy_map', code: '05', label: 'Satellite', hint: 'Mappa Italia live', icon: Radio, tone: '#fb7185' },
  { id: 'forecast5', code: '06', label: '5 Giorni', hint: 'Previsioni estese', icon: Calendar, tone: '#818cf8' },
  { id: 'wind', code: '07', label: 'Vento', hint: 'Vento e umidità', icon: Wind, tone: '#67e8f9' },
  { id: 'ambient', code: '08', label: 'Ambiente', hint: 'UV e qualità aria', icon: Trees, tone: '#4ade80' },
];

interface HubCommandDeckProps {
  active: AppTab;
  onSelect: (tab: AppTab) => void;
  badges?: Partial<Record<AppTab, string | number>>;
}

export const HubCommandDeck: React.FC<HubCommandDeckProps> = ({ active, onSelect, badges = {} }) => {
  // Keep the active module visible when the deck scrolls horizontally (phones).
  useEffect(() => {
    document.getElementById(`hub-module-${active}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [active]);

  return (
  <nav className="hub-panel hub-panel--glow" aria-label="Moduli del hub">
    <div className="hub-deck">
      {MODULES.map(({ id, code, label, hint, icon: Icon, tone }) => {
        const isActive = active === id;
        const badge = badges[id];
        return (
          <button
            key={id}
            id={`hub-module-${id}`}
            type="button"
            className="hub-deck-btn"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelect(id)}
            title={hint}
          >
            <span className="flex items-center justify-between w-full">
              <span className="font-hud text-[10px] tracking-[0.2em] opacity-70">M-{code}</span>
              {badge !== undefined && (
                <span className="font-hud text-[10px] font-bold px-1.5 rounded bg-[var(--hub-red)] text-white leading-4">{badge}</span>
              )}
            </span>
            <span className="flex items-center gap-2">
              <Icon
                className="w-4 h-4 shrink-0"
                style={{ color: tone, filter: isActive ? `drop-shadow(0 0 6px ${tone})` : undefined }}
              />
              <span className="font-display text-sm font-semibold uppercase">{label}</span>
            </span>
            <span className="text-[11px] leading-tight opacity-70 hidden sm:block">{hint}</span>
          </button>
        );
      })}
    </div>
  </nav>
  );
};

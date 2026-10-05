import React from 'react';
import { CloudSun, Map as MapIcon, Globe2, Newspaper, LucideIcon } from 'lucide-react';
import { AppRoute } from '../types';

const DESTINATIONS: Array<{ id: AppRoute; label: string; icon: LucideIcon }> = [
  { id: 'meteo', label: 'Meteo', icon: CloudSun },
  { id: 'mappa', label: 'Mappa', icon: MapIcon },
  { id: 'mondo', label: 'Mondo', icon: Globe2 },
  { id: 'notizie', label: 'Notizie', icon: Newspaper },
];

interface AppNavProps {
  active: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

/** Desktop/tablet: tab bar under the header. */
export const AppTopNav: React.FC<AppNavProps> = ({ active, onNavigate }) => (
  <nav aria-label="Sezioni principali" className="hidden md:block border-b border-[var(--hub-line)] bg-[var(--hub-panel-strong)] backdrop-blur-xl">
    <ul className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 h-12">
      {DESTINATIONS.map(({ id, label, icon: Icon }) => {
        const isActive = id === active;
        return (
          <li key={id}>
            <a
              href={`#/${id}`}
              onClick={(e) => { e.preventDefault(); onNavigate(id); }}
              aria-current={isActive ? 'page' : undefined}
              className={`relative inline-flex items-center gap-2 h-12 px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--hub-cyan)] ${
                isActive ? 'text-[var(--hub-text)]' : 'text-[var(--hub-dim)] hover:text-[var(--hub-text)]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--hub-cyan)]' : ''}`} aria-hidden="true" />
              {label}
              {isActive && <span className="absolute left-3 right-3 bottom-0 h-0.5 rounded-full bg-[var(--hub-cyan)]" />}
            </a>
          </li>
        );
      })}
    </ul>
  </nav>
);

/** Mobile: thumb-reachable bottom bar, respects the gesture-bar safe area. */
export const AppBottomNav: React.FC<AppNavProps> = ({ active, onNavigate }) => (
  <nav
    aria-label="Sezioni principali"
    className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[var(--hub-line)] bg-[var(--hub-panel-strong)] backdrop-blur-xl"
    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
  >
    <ul className="grid grid-cols-4">
      {DESTINATIONS.map(({ id, label, icon: Icon }) => {
        const isActive = id === active;
        return (
          <li key={id}>
            <a
              href={`#/${id}`}
              onClick={(e) => { e.preventDefault(); onNavigate(id); }}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 h-14 text-xs font-semibold transition-colors ${
                isActive ? 'text-[var(--hub-text)]' : 'text-[var(--hub-dim)]'
              }`}
            >
              <span className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors ${
                isActive ? 'bg-[color-mix(in_srgb,var(--hub-cyan)_18%,transparent)]' : ''
              }`}>
                <Icon className={`w-5 h-5 ${isActive ? 'text-[var(--hub-cyan)]' : ''}`} aria-hidden="true" />
              </span>
              {label}
            </a>
          </li>
        );
      })}
    </ul>
  </nav>
);

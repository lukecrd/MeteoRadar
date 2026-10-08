import React from 'react';
import { Moon, Sun, Sliders, Globe2, Navigation, Smartphone } from 'lucide-react';
import { LocationInfo } from '../types';
import { CitySearch } from './CitySearch';

interface NavbarProps {
  currentLocation: LocationInfo;
  onSelectLocation: (loc: LocationInfo) => void;
  onUseGps: () => void;
  isGpsLoading: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenAndroid: () => void;
  onOpenVercel: () => void;
  hasActiveAlerts: boolean;
  /** Android/Vercel export buttons are developer tools, hidden unless developer mode is on */
  showDevTools?: boolean;
  /** Rendered inside the sticky header, below the main row (primary navigation) */
  children?: React.ReactNode;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentLocation,
  onSelectLocation,
  onUseGps,
  isGpsLoading,
  isDark,
  onToggleTheme,
  onOpenSettings,
  onOpenAndroid,
  onOpenVercel,
  hasActiveAlerts,
  showDevTools = false,
  children,
}) => {
  return (
    <header
      id="main-app-header"
      className="sticky top-0 z-40 backdrop-blur-xl border-b border-[var(--hub-line)] bg-[var(--hub-panel-strong)] text-[var(--hub-text)]"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative w-10 h-10 flex items-center justify-center">
            {isDark && <span className="hud-pulse-ring" />}
            <svg viewBox="0 0 40 40" className="absolute inset-0 w-10 h-10" aria-hidden>
              <defs>
                <linearGradient id="hub-brand-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#22d3ee" />
                  <stop offset="1" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
              <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="rgba(34,211,238,0.08)" stroke="url(#hub-brand-grad)" strokeWidth="1.5" />
            </svg>
            <Globe2 className="w-5 h-5 relative text-[var(--hub-cyan)]" />
          </div>
          <div className="leading-tight hidden sm:block">
            <div className="font-display font-bold text-lg sm:text-xl tracking-[0.08em] whitespace-nowrap hub-brand-text">
              WorldHub
            </div>
          </div>
        </div>

        {/* Center Search Bar */}
        <CitySearch
          inputId="city-search-input"
          currentLocation={currentLocation}
          onSelectLocation={onSelectLocation}
          showCurrent
          className="flex-1 max-w-md"
        />

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            id="gps-location-btn"
            onClick={onUseGps}
            disabled={isGpsLoading}
            className="hub-icon-btn"
            title="Rileva posizione GPS attuale"
            aria-label="Usa la mia posizione"
          >
            <Navigation className={`w-4 h-4 text-[var(--hub-cyan)] ${isGpsLoading ? 'animate-spin' : ''}`} />
            <span className="hidden lg:inline">GPS</span>
          </button>

          {showDevTools && (<>
          <button
            id="android-app-btn"
            onClick={onOpenAndroid}
            className="hub-icon-btn hidden sm:inline-flex"
            title="Installa o genera file per Android (PWA / APK)"
          >
            <Smartphone className="w-4 h-4" />
            <span className="hidden lg:inline">Android</span>
          </button>

          <button
            id="vercel-deploy-btn"
            onClick={onOpenVercel}
            className="hub-icon-btn hidden sm:inline-flex"
            title="Esporta e distribuisci questa app su Vercel"
          >
            <svg className="w-3 h-3 fill-current" viewBox="0 0 76 65" aria-hidden>
              <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
            </svg>
            <span className="hidden lg:inline">Vercel</span>
          </button>
          </>)}

          <button
            id="theme-toggle-btn"
            onClick={onToggleTheme}
            className="hub-icon-btn"
            title={isDark ? 'Passa alla modalità chiara' : 'Passa alla modalità scura per visione notturna'}
            aria-label={isDark ? 'Modalità chiara' : 'Modalità scura'}
          >
            {isDark ? <Sun className="w-4 h-4 text-[var(--hub-amber)]" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            id="open-settings-btn"
            onClick={onOpenSettings}
            className="hub-icon-btn relative"
            title="Impostazioni avanzate di sistema e notifiche"
            aria-label="Impostazioni"
          >
            <Sliders className="w-4 h-4" />
            {hasActiveAlerts && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--hub-red)] shadow-[0_0_10px_var(--hub-red)] animate-pulse" />
            )}
          </button>
        </div>
      </div>
      {children}
    </header>
  );
};

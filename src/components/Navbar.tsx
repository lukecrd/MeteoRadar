import React, { useEffect, useMemo, useState } from 'react';
import { Moon, Sun, Sliders, Navigation, Smartphone } from 'lucide-react';
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

/** UTC and the selected place's local time: the observatory's reference clock. */
const HeaderClock: React.FC<{ location: LocationInfo }> = ({ location }) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const local = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('it-IT', { timeZone: location.timezone, hour: '2-digit', minute: '2-digit' });
    } catch {
      // Unknown or missing zone: fall back to the device's time.
      return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
    }
  }, [location.timezone]);
  const utc = now.toISOString().slice(11, 19);
  return (
    <div className="hidden xl:flex items-baseline gap-4 shrink-0 font-hud text-[15px] font-semibold" aria-label={`Ora UTC ${utc}, ora di ${location.name} ${local.format(now)}`}>
      <span><span className="font-sans text-xs font-normal text-[var(--hub-dim)] mr-1.5">UTC</span>{utc}</span>
      <span><span className="font-sans text-xs font-normal text-[var(--hub-dim)] mr-1.5">{location.name}</span>{local.format(now)}</span>
    </div>
  );
};

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
          {/* Same globe as the app icon (public/icon.svg) */}
          <img src="/icon.svg" alt="WorldHub" width={40} height={40} className="w-10 h-10" />
          <div className="leading-tight hidden sm:block">
            <div className="font-display font-bold text-lg sm:text-xl whitespace-nowrap hub-brand-text">
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

        <HeaderClock location={currentLocation} />

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

import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Moon, Sun, Sliders, Globe2, Loader2, Navigation, Smartphone } from 'lucide-react';
import { LocationInfo } from '../types';
import { searchLocations } from '../services/weatherApi';

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
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Debounced city search
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchLocations(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
      setShowDropdown(true);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCity = (loc: LocationInfo) => {
    onSelectLocation(loc);
    setSearchQuery('');
    setShowDropdown(false);
  };

  return (
    <header
      id="main-app-header"
      className="sticky top-0 z-40 backdrop-blur-xl border-b border-[var(--hub-line)] bg-[var(--hub-panel-strong)] text-[var(--hub-text)]"
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
            <div className="font-display font-bold text-base tracking-[0.12em] flex items-center gap-1.5">
              <span>
                WORLD<span className="text-[var(--hub-cyan)]">HUB</span>
              </span>
            </div>
            <p className="hub-label !text-[9px] hidden sm:block">Notizie e meteo dal mondo</p>
          </div>
        </div>

        {/* Center Search Bar */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-md">
          <div className="flex items-center gap-2 px-3.5 h-10 rounded-xl border border-[var(--hub-line)] bg-[var(--hub-panel)] focus-within:border-[var(--hub-line-strong)] focus-within:shadow-[0_0_18px_-6px_var(--hub-cyan)] transition-all">
            <Search className="w-4 h-4 text-[var(--hub-dim)] shrink-0" />
            <input
              id="city-search-input"
              type="text"
              placeholder="Cerca località…"
              aria-label="Cerca città"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              className="w-full bg-transparent text-sm focus:outline-none placeholder:text-[var(--hub-dim)] text-[var(--hub-text)]"
            />
            {isSearching ? (
              <Loader2 className="w-4 h-4 text-[var(--hub-cyan)] animate-spin shrink-0" />
            ) : (
              <span className="font-hud text-[10px] text-[var(--hub-dim)] hidden md:inline truncate max-w-[110px]" title={currentLocation.name}>
                {currentLocation.name}
              </span>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-[var(--hub-line)] bg-[var(--hub-panel-strong)] backdrop-blur-xl shadow-2xl overflow-hidden z-50">
              <div className="p-1.5">
                {searchResults.map((loc, idx) => (
                  <button
                    key={`${loc.name}-${loc.latitude}-${idx}`}
                    onClick={() => handleSelectCity(loc)}
                    className="w-full text-left px-3.5 py-2.5 rounded-lg text-sm flex items-center justify-between transition-colors hover:bg-[color-mix(in_srgb,var(--hub-cyan)_10%,transparent)]"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[var(--hub-cyan)]" />
                      <span className="font-semibold">{loc.name}</span>
                      {loc.admin1 && <span className="text-[var(--hub-dim)] text-xs">({loc.admin1})</span>}
                    </div>
                    <span className="font-hud text-[10px] text-[var(--hub-dim)]">{loc.country}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            id="gps-location-btn"
            onClick={onUseGps}
            disabled={isGpsLoading}
            className="hub-icon-btn"
            title="Rileva posizione GPS attuale"
          >
            <Navigation className={`w-4 h-4 text-[var(--hub-cyan)] ${isGpsLoading ? 'animate-spin' : ''}`} />
            <span className="hidden lg:inline">GPS</span>
          </button>

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
    </header>
  );
};

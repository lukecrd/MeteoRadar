import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Moon, Sun, Sliders, CloudLightning, Loader2, Navigation, Radio, Activity, Smartphone } from 'lucide-react';
import { LocationInfo, AppTab } from '../types';
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
  activeAppTab: AppTab;
  onSelectAppTab: (tab: AppTab) => void;
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
  activeAppTab,
  onSelectAppTab,
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
      className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-colors ${
        isDark
          ? 'bg-slate-950/80 border-slate-800/80 text-slate-100'
          : 'bg-white/85 border-slate-200 text-slate-900'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-teal-500/25">
            <CloudLightning className="w-6 h-6" />
          </div>
          <div>
            <div className="font-black text-base tracking-tight flex items-center gap-1.5">
              <span>MeteoRadar</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400 font-bold border border-teal-500/30">
                3D
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-300 hidden sm:block">Previsioni & Sensori di Precisione</p>
          </div>
        </div>

        {/* Tab Switcher in Navbar for quick access */}
        <div className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border-2 border-slate-300 dark:border-slate-700 text-xs shrink-0">
          <button
            id="nav-tab-station-btn"
            onClick={() => onSelectAppTab('station')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 border ${
              activeAppTab !== 'italy_map'
                ? 'bg-teal-600 text-white border-teal-700 dark:border-teal-400 shadow-sm'
                : 'text-slate-700 dark:text-slate-200 border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Stazione Live</span>
          </button>
          <button
            id="nav-tab-italy-satellite-btn"
            onClick={() => onSelectAppTab('italy_map')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 border ${
              activeAppTab === 'italy_map'
                ? 'bg-teal-600 text-white border-teal-700 dark:border-teal-400 shadow-sm'
                : 'text-slate-700 dark:text-slate-200 border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Satellite Italia</span>
          </button>
        </div>

        {/* Center Search Bar */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-md">
          <div
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border transition-all ${
              isDark
                ? 'bg-slate-900/90 border-slate-700/80 focus-within:border-teal-500'
                : 'bg-slate-100/90 border-slate-200 focus-within:border-teal-500'
            }`}
          >
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              id="city-search-input"
              type="text"
              placeholder="Cerca città (es. Roma, Milano, Napoli, Londra...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              className="w-full bg-transparent text-xs sm:text-sm focus:outline-none placeholder:text-slate-400 text-slate-900 dark:text-slate-100"
            />
            {isSearching && <Loader2 className="w-4 h-4 text-teal-500 animate-spin shrink-0" />}
          </div>

          {/* Autocomplete Dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div
              className={`absolute left-0 right-0 top-full mt-2 rounded-2xl border shadow-2xl overflow-hidden z-50 animate-in fade-in-50 duration-150 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="p-1.5">
                {searchResults.map((loc, idx) => (
                  <button
                    key={`${loc.name}-${loc.latitude}-${idx}`}
                    onClick={() => handleSelectCity(loc)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm flex items-center justify-between transition-colors ${
                      isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-teal-400" />
                      <span className="font-semibold">{loc.name}</span>
                      {loc.admin1 && <span className="text-slate-400 text-xs">({loc.admin1})</span>}
                    </div>
                    <span className="text-xs text-slate-400 font-medium">{loc.country}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* GPS Button */}
          <button
            id="gps-location-btn"
            onClick={onUseGps}
            disabled={isGpsLoading}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              isDark
                ? 'border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-200'
                : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="Rileva posizione GPS attuale"
          >
            <Navigation className={`w-3.5 h-3.5 ${isGpsLoading ? 'animate-spin text-teal-500' : 'text-teal-400'}`} />
            <span className="hidden sm:inline">GPS</span>
          </button>

          {/* Android App Button */}
          <button
            id="android-app-btn"
            onClick={onOpenAndroid}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
              isDark
                ? 'border-teal-500/40 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300'
                : 'border-teal-400/50 bg-teal-50 hover:bg-teal-100 text-teal-700'
            }`}
            title="Installa o genera file per Android (PWA / APK)"
          >
            <Smartphone className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden sm:inline">Android</span>
          </button>

          {/* Vercel Deploy Button */}
          <button
            id="vercel-deploy-btn"
            onClick={onOpenVercel}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
              isDark
                ? 'border-slate-700 bg-black/70 hover:bg-black text-white hover:border-slate-500'
                : 'border-slate-300 bg-black text-white hover:bg-slate-800'
            }`}
            title="Esporta e distribuisci questa app su Vercel"
          >
            <svg className="w-3 h-3 fill-current" viewBox="0 0 76 65">
              <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
            </svg>
            <span className="hidden sm:inline">Vercel</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            id="theme-toggle-btn"
            onClick={onToggleTheme}
            className={`p-2.5 rounded-xl border transition-colors ${
              isDark
                ? 'border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-amber-300'
                : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title={isDark ? 'Passa alla modalità chiara' : 'Passa alla modalità scura per visione notturna'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Settings Button with Badge */}
          <button
            id="open-settings-btn"
            onClick={onOpenSettings}
            className={`relative p-2.5 rounded-xl border transition-colors ${
              isDark
                ? 'border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-200'
                : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="Impostazioni avanzate di sistema e notifiche"
          >
            <Sliders className="w-4 h-4" />
            {hasActiveAlerts && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-slate-900 animate-pulse" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

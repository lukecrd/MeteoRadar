import React, { useState, useEffect, useRef, useId } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { LocationInfo } from '../types';
import { searchLocations } from '../services/weatherApi';

interface CitySearchProps {
  currentLocation: LocationInfo;
  onSelectLocation: (loc: LocationInfo) => void;
  /** DOM id of the input (the navbar one is targeted elsewhere) */
  inputId?: string;
  placeholder?: string;
  /** Show the current city name at the right edge of the field (tablet and up) */
  showCurrent?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/**
 * City autocomplete over Open-Meteo geocoding (debounced). Enter picks the
 * highlighted result, arrows move the highlight, Escape closes the list.
 */
export const CitySearch: React.FC<CitySearchProps> = ({
  currentLocation,
  onSelectLocation,
  inputId,
  placeholder,
  showCurrent = false,
  autoFocus = false,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  // Debounced city search
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      const found = await searchLocations(query);
      if (cancelled) return;
      setResults(found);
      setHighlight(0);
      setIsSearching(false);
      setShowDropdown(true);
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const select = (loc: LocationInfo) => {
    onSelectLocation(loc);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
    } else if (e.key === 'ArrowDown' && results.length) {
      e.preventDefault();
      setShowDropdown(true);
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === 'ArrowUp' && results.length) {
      e.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && results.length) {
      e.preventDefault();
      select(results[Math.min(highlight, results.length - 1)]);
    }
  };

  const noResults = showDropdown && !isSearching && query.trim().length >= 2 && results.length === 0;

  return (
    <div ref={containerRef} className={`relative min-w-0 ${className}`}>
      <div className="flex items-center gap-2 px-3.5 h-10 rounded-xl border border-[var(--hub-line)] bg-[var(--hub-panel)] focus-within:border-[var(--hub-line-strong)] focus-within:shadow-[0_0_18px_-6px_var(--hub-cyan)] transition-all">
        <Search className="w-4 h-4 text-[var(--hub-dim)] shrink-0 hidden sm:block" aria-hidden="true" />
        <MapPin className="w-4 h-4 text-[var(--hub-cyan)] shrink-0 sm:hidden" aria-hidden="true" />
        <input
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={showDropdown && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          autoFocus={autoFocus}
          placeholder={placeholder ?? `${currentLocation.name} · cerca…`}
          aria-label={`Località attuale: ${currentLocation.name}. Cerca un'altra città`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          onKeyDown={onKeyDown}
          className="w-full min-w-0 bg-transparent text-sm focus:outline-none placeholder:text-[var(--hub-text)] sm:placeholder:text-[var(--hub-dim)] text-[var(--hub-text)]"
        />
        {isSearching ? (
          <Loader2 className="w-4 h-4 text-[var(--hub-cyan)] animate-spin shrink-0" />
        ) : (
          showCurrent && (
            <span className="font-hud text-xs text-[var(--hub-dim)] hidden md:inline truncate max-w-[110px]" title={currentLocation.name}>
              {currentLocation.name}
            </span>
          )
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {(showDropdown && results.length > 0) || noResults ? (
        <div className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-[var(--hub-line)] bg-[var(--hub-panel-strong)] backdrop-blur-xl shadow-2xl overflow-hidden z-50">
          {noResults ? (
            <div className="px-4 py-3 text-sm text-[var(--hub-dim)]">Nessuna città trovata per “{query.trim()}”</div>
          ) : (
            <ul id={listId} role="listbox" className="p-1.5">
              {results.map((loc, idx) => (
                <li key={`${loc.name}-${loc.latitude}-${idx}`} role="option" aria-selected={idx === highlight}>
                  <button
                    type="button"
                    onClick={() => select(loc)}
                    onMouseEnter={() => setHighlight(idx)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm flex items-center justify-between transition-colors hover:bg-[color-mix(in_srgb,var(--hub-cyan)_10%,transparent)] ${
                      idx === highlight ? 'bg-[color-mix(in_srgb,var(--hub-cyan)_10%,transparent)]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="w-4 h-4 text-[var(--hub-cyan)] shrink-0" />
                      <span className="font-semibold truncate">{loc.name}</span>
                      {loc.admin1 && <span className="text-[var(--hub-dim)] text-xs truncate">({loc.admin1})</span>}
                    </div>
                    <span className="font-hud text-xs text-[var(--hub-dim)] shrink-0 ml-2">{loc.country}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
};

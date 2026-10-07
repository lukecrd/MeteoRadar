import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Crosshair, Loader2, Plane, Search, Square, X } from 'lucide-react';
import { timeAgo } from '../services/newsApi';
import { AirportInfo, FlightDetail, FlightInfoResponse, FlightSearchResponse, WORLD_ENDPOINTS } from '../services/worldEventsApi';
import { describeFetchError } from '../hooks/usePolledJson';
import type { LatLon, TrackerStatus } from '../hooks/useFlightTracker';

const NA = 'non disponibile';
const fmt = (n: number, digits = 0) => n.toLocaleString('it-IT', { maximumFractionDigits: digits, minimumFractionDigits: digits });

function altitude(m: number | null) {
  return m == null ? NA : `${fmt(m)} m · ${fmt(m / 0.3048)} ft`;
}

const STATUS_LABEL: Record<TrackerStatus, { text: string; color: string }> = {
  idle: { text: '—', color: 'var(--hub-dim)' },
  loading: { text: 'Collegamento…', color: 'var(--hub-dim)' },
  live: { text: 'Live · adsb.lol', color: '#4ade80' },
  estimated: { text: 'Stimato · ultimo dato OpenSky', color: '#fbbf24' },
  lost: { text: 'Segnale perso / atterrato', color: 'var(--hub-red)' },
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex justify-between gap-3 py-1 border-b border-[var(--hub-line)] last:border-0">
    <dt className="text-[var(--hub-dim)] shrink-0">{label}</dt>
    <dd className="text-right font-medium tabular-nums min-w-0 break-words">{children}</dd>
  </div>
);

const AirportLine: React.FC<{ a: AirportInfo | null }> = ({ a }) =>
  a ? (
    <div className="min-w-0">
      <div className="font-hud text-base font-bold">{a.iata ?? a.icao ?? '—'}</div>
      <div className="text-[11px] text-[var(--hub-dim)] truncate" title={a.name}>
        {a.city ?? a.name}
      </div>
    </div>
  ) : (
    <div className="text-xs text-[var(--hub-dim)]">{NA}</div>
  );

interface FlightCardProps {
  flight: FlightDetail | null;
  position: LatLon | null;
  status: TrackerStatus;
  error: string | null;
  info: FlightInfoResponse | null;
  infoLoading: boolean;
  following: boolean;
  onFollow: () => void;
  onStopFollow: () => void;
  onClose: () => void;
}

/** Floating info card for one aircraft (opened from the globe, list or search). */
export const FlightCard: React.FC<FlightCardProps> = ({ flight, position, status, error, info, infoLoading, following, onFollow, onStopFollow, onClose }) => {
  const route = info?.route;
  const ac = info?.aircraft;
  const vr = flight?.verticalRateMs ?? null;
  const VrIcon = vr == null || Math.abs(vr) < 0.5 ? ArrowRight : vr > 0 ? ArrowUpRight : ArrowDownRight;
  const st = STATUS_LABEL[status];
  const title = route?.callsignIata && route.callsignIata !== flight?.callsign ? `${route.callsignIata} · ${flight?.callsign}` : flight?.callsign;

  return (
    <section
      role="dialog"
      aria-label={`Volo ${flight?.callsign ?? ''}`}
      className="hub-panel hub-panel--glow bg-[var(--hub-panel-strong)] flex flex-col max-h-full overflow-hidden text-xs"
    >
      <header className="flex items-start justify-between gap-2 px-3.5 pt-3 pb-2 border-b border-[var(--hub-line)]">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Plane className="w-4 h-4 text-[#38bdf8] shrink-0" style={{ transform: `rotate(${(flight?.trackDeg ?? 45) - 45}deg)` }} />
            <h3 className="font-display text-base font-bold truncate">{title ?? 'Volo'}</h3>
          </div>
          <div className="text-[var(--hub-dim)] truncate">{route?.airline?.name ?? (infoLoading ? 'Carico compagnia…' : 'Compagnia non disponibile')}</div>
          <div className="flex items-center gap-1.5 mt-1 font-hud text-[10px]" style={{ color: st.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />
            {st.text}
          </div>
        </div>
        <button type="button" onClick={onClose} className="hub-icon-btn !h-8 !px-2 shrink-0" aria-label="Chiudi scheda volo" title="Chiudi (Esc)">
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="overflow-y-auto overscroll-contain px-3.5 py-2.5 space-y-3">
        {/* Route */}
        <div className="flex items-center gap-2">
          <AirportLine a={route?.origin ?? null} />
          <div className="flex-1 h-px bg-[var(--hub-line-strong)] relative">
            <Plane className="w-3.5 h-3.5 absolute -top-[7px] left-1/2 -translate-x-1/2 text-[#38bdf8] rotate-45" />
          </div>
          <div className="text-right">
            <AirportLine a={route?.destination ?? null} />
          </div>
        </div>
        {!infoLoading && !route && <p className="text-[var(--hub-dim)]">Rotta non disponibile per questo nominativo.</p>}

        {ac?.photoThumb && (
          <img src={ac.photoThumb} alt={`Foto ${ac.registration ?? 'aeromobile'}`} loading="lazy" className="w-full h-24 object-cover rounded-lg border border-[var(--hub-line)]" referrerPolicy="no-referrer" />
        )}

        <dl>
          <Row label="ICAO24">{flight?.icao24.toUpperCase() ?? NA}</Row>
          <Row label="Paese">{flight?.country ?? ac?.country ?? NA}</Row>
          <Row label="Aeromobile">{ac?.type ?? flight?.aircraftType ?? NA}</Row>
          <Row label="Registrazione">{ac?.registration ?? flight?.registration ?? NA}</Row>
          <Row label="Operatore">{ac?.owner ?? NA}</Row>
          <Row label="Quota baro">{flight?.onGround ? 'A terra' : altitude(flight?.baroAltM ?? null)}</Row>
          <Row label="Quota GPS">{altitude(flight?.geoAltM ?? null)}</Row>
          <Row label="Velocità">
            {flight?.speedMs != null ? `${fmt(flight.speedMs * 3.6)} km/h · ${fmt(flight.speedMs / 0.514444)} kt` : NA}
          </Row>
          <Row label="Rotta">{flight?.trackDeg != null ? `${fmt(flight.trackDeg)}°` : NA}</Row>
          <Row label="Variometro">
            {vr == null ? (
              NA
            ) : (
              <span className="inline-flex items-center gap-1">
                <VrIcon className="w-3 h-3" />
                {Math.abs(vr) < 0.5 ? 'Livellato' : `${vr > 0 ? 'Sale' : 'Scende'} ${fmt(Math.abs(vr) * 196.85)} ft/min`}
              </span>
            )}
          </Row>
          <Row label="Squawk">{flight?.squawk ?? NA}</Row>
          <Row label="Al suolo">{flight ? (flight.onGround ? 'Sì' : 'No') : NA}</Row>
          <Row label="Ultimo contatto">{flight?.lastContact ? timeAgo(flight.lastContact) : NA}</Row>
          <Row label="Posizione">{position ? `${position.lat.toFixed(3)}°, ${position.lon.toFixed(3)}°` : NA}</Row>
        </dl>

        {(error || info?.error) && <p className="text-[var(--hub-red)]">{error ?? info?.error}</p>}
        <p className="text-[10px] text-[var(--hub-dim)]">Dati: OpenSky, adsb.lol (ODbL), adsbdb. Posizione stimata tra un aggiornamento e l'altro.</p>
      </div>

      <footer className="px-3.5 py-2.5 border-t border-[var(--hub-line)]">
        {following ? (
          <button type="button" onClick={onStopFollow} className="hub-icon-btn w-full !h-9 text-xs font-semibold">
            <Square className="w-3.5 h-3.5" /> Smetti di seguire
          </button>
        ) : (
          <button
            type="button"
            onClick={onFollow}
            disabled={status === 'lost' && !flight}
            className="w-full h-9 rounded-xl bg-[var(--hub-cyan)] text-slate-950 text-xs font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Crosshair className="w-4 h-4" /> Segui volo
          </button>
        )}
      </footer>
    </section>
  );
};

interface FlightSearchProps {
  onSelect: (flight: FlightDetail) => void;
  compact?: boolean;
}

/**
 * Search by flight number (AZ610, FR 1234), ICAO callsign (ITY610), ICAO24
 * hex or registration. The server searches the full OpenSky snapshot.
 */
export const FlightSearch: React.FC<FlightSearchProps> = ({ onSelect, compact = false }) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<FlightSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!compact || !open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [compact, open]);

  const run = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setLoading(true);
    setError(null);
    setOpen(true);
    try {
      const res = await fetch(WORLD_ENDPOINTS.flightSearch(q));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (err) {
      setResult(null);
      setError(describeFetchError(err));
    } finally {
      setLoading(false);
    }
  };

  const pick = (f: FlightDetail) => {
    onSelect(f);
    if (compact) setOpen(false);
  };

  const results = result?.results ?? [];
  const showPanel = open && (loading || error || result);

  return (
    <div ref={boxRef} className={compact ? 'relative' : ''}>
      <form onSubmit={run} role="search" aria-label="Cerca volo" className="flex items-center gap-2">
        <label className={`flex-1 flex items-center gap-2 px-3 rounded-full border border-[var(--hub-line)] bg-[var(--hub-panel)] focus-within:border-[var(--hub-line-strong)] ${compact ? 'h-9' : 'h-9 !rounded-lg'}`}>
          <Search className="w-4 h-4 text-[var(--hub-dim)] shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => result && setOpen(true)}
            placeholder={compact ? 'Cerca volo (AZ610)…' : 'Numero volo, nominativo, ICAO24…'}
            aria-label="Numero di volo"
            className="w-full min-w-0 bg-transparent text-sm focus:outline-none placeholder:text-[var(--hub-dim)]"
          />
        </label>
        <button type="submit" className="hub-icon-btn !h-9 text-xs shrink-0" disabled={loading || query.trim().length < 2}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cerca'}
        </button>
      </form>

      {showPanel && (
        <div
          className={
            compact
              ? 'absolute left-0 right-0 top-full mt-1 z-30 hub-panel bg-[var(--hub-panel-strong)] !rounded-xl p-2 max-h-72 overflow-y-auto text-xs'
              : 'mt-2 text-xs'
          }
        >
          {loading && <p className="text-[var(--hub-dim)] p-1">Cerco tra tutti gli aerei in volo…</p>}
          {error && <p className="text-[var(--hub-red)] p-1">{error}</p>}
          {!loading && result && (
            <>
              {result.resolved.length > 1 && (
                <p className="text-[var(--hub-dim)] p-1">
                  Cercato come: <span className="font-hud">{result.resolved.join(', ')}</span>
                </p>
              )}
              {results.length === 0 ? (
                <p className="p-1">
                  Nessun aereo <strong>{result.query}</strong> in volo in questo momento (non trovato o non ancora decollato / già atterrato).
                </p>
              ) : (
                <ul className="divide-y divide-[var(--hub-line)]">
                  {results.map((f) => (
                    <li key={f.icao24}>
                      <button type="button" onClick={() => pick(f)} className="w-full text-left flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--hub-glow)]">
                        <Plane className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" style={{ transform: `rotate(${(f.trackDeg ?? 45) - 45}deg)` }} />
                        <span className="min-w-0 flex-1">
                          <span className="font-hud font-bold">{f.callsign}</span>
                          <span className="text-[var(--hub-dim)]">
                            {' '}
                            · {f.icao24.toUpperCase()}
                            {f.country ? ` · ${f.country}` : ''}
                            {f.onGround ? ' · a terra' : f.baroAltM != null ? ` · ${fmt(f.baroAltM)} m` : ''}
                          </span>
                        </span>
                        <span className="text-[var(--hub-cyan)] shrink-0">Apri</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

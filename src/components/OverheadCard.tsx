import React, { useMemo } from 'react';
import { Eye, Plane, Satellite } from 'lucide-react';
import { LocationInfo } from '../types';
import { usePolledJson } from '../hooks/usePolledJson';
import { distanceKm } from '../alerts/personalAlerts';
import { bearingDeg, compassIt, satellitePasses } from '../services/overhead';
import { FlightsResponse, ISS_NORAD, SatellitesResponse, WORLD_ENDPOINTS } from '../services/worldEventsApi';

/** Aircraft within this distance count as "above you". */
const NEARBY_KM = 30;
const FLIGHTS_REFRESH_MS = 30_000;
const TLE_REFRESH_MS = 2 * 60 * 60_000;
const MAX_FLIGHTS = 6;
const MAX_PASSES = 3;

const timeIt = (ms: number) => new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const dayIt = (ms: number) => {
  const d = new Date(ms);
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Oggi';
  if (d.toDateString() === tomorrow.toDateString()) return 'Domani';
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
};

/**
 * "Sopra di te": aircraft within NEARBY_KM of the location (area flight feed)
 * and the next ISS passes, computed on the device from the CelesTrak TLE.
 */
export const OverheadCard: React.FC<{ location: LocationInfo }> = ({ location }) => {
  const { latitude: lat, longitude: lon } = location;
  // 16 NM ≈ 30 km; the server rounds the centre, so nearby places share a cache entry.
  const flights = usePolledJson<FlightsResponse>(WORLD_ENDPOINTS.flightsArea(lat.toFixed(2), lon.toFixed(2), 16), FLIGHTS_REFRESH_MS);
  const stations = usePolledJson<SatellitesResponse>(WORLD_ENDPOINTS.satellites('stations'), TLE_REFRESH_MS);

  // Filtered here too: a server without the area query answers with the global sample.
  const nearby = useMemo(
    () =>
      (flights.data?.items ?? [])
        .map((f) => ({ ...f, km: distanceKm(lat, lon, f.lat, f.lon), dir: compassIt(bearingDeg(lat, lon, f.lat, f.lon)) }))
        .filter((f) => f.km <= NEARBY_KM)
        .sort((a, b) => a.km - b.km),
    [flights.data, lat, lon]
  );

  const iss = stations.data?.items.find((t) => t.norad === ISS_NORAD);
  // Recomputed when the TLE or the place changes; passes already over drop out on the next TLE refresh.
  const passes = useMemo(() => {
    if (!iss) return [];
    const now = Date.now();
    return satellitePasses(iss.line1, iss.line2, lat, lon, now, 36)
      .filter((p) => p.endMs > now)
      .slice(0, MAX_PASSES);
  }, [iss, lat, lon]);

  return (
    <div className="p-5 border space-y-5">
      <h2 className="text-sm font-bold flex items-center gap-2">
        <Eye className="w-4 h-4 text-[var(--hub-cyan)]" />
        Sopra di te · {location.name}
      </h2>

      <div>
        <div className="hub-label flex items-center gap-2 mb-2">
          <Plane className="w-3.5 h-3.5" />
          Aerei entro {NEARBY_KM} km
        </div>
        {flights.error && !flights.data ? (
          <p className="text-xs text-[var(--hub-dim)]">{flights.error}</p>
        ) : flights.isLoading && !flights.data ? (
          <p className="text-xs text-[var(--hub-dim)]">Ricerca in corso…</p>
        ) : nearby.length === 0 ? (
          <p className="text-xs text-[var(--hub-dim)]">Nessun aereo in volo qui sopra in questo momento.</p>
        ) : (
          <ul className="space-y-1">
            {nearby.slice(0, MAX_FLIGHTS).map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 text-sm tabular-nums">
                <span className="font-semibold">{f.callsign}</span>
                <span className="text-xs text-[var(--hub-dim)]">
                  {/* barometric altitude reads slightly negative on final approach */}
                  {f.altitudeM != null && f.altitudeM > 0 ? `${f.altitudeM.toLocaleString('it-IT')} m · ` : ''}
                  {Math.round(f.km)} km a {f.dir}
                </span>
              </li>
            ))}
            {nearby.length > MAX_FLIGHTS && <li className="text-xs text-[var(--hub-dim)]">e altri {nearby.length - MAX_FLIGHTS}</li>}
          </ul>
        )}
      </div>

      <div>
        <div className="hub-label flex items-center gap-2 mb-2">
          <Satellite className="w-3.5 h-3.5" />
          Prossimi passaggi della ISS
        </div>
        {stations.error && !stations.data ? (
          <p className="text-xs text-[var(--hub-dim)]">{stations.error}</p>
        ) : !iss ? (
          <p className="text-xs text-[var(--hub-dim)]">{stations.isLoading ? 'Calcolo in corso…' : 'Orbita della ISS non disponibile.'}</p>
        ) : passes.length === 0 ? (
          <p className="text-xs text-[var(--hub-dim)]">Nessun passaggio sopra 10° nelle prossime 36 ore.</p>
        ) : (
          <ul className="space-y-2">
            {passes.map((p) => (
              <li key={p.startMs} className="flex items-center justify-between gap-3 text-sm tabular-nums">
                <span>
                  <span className="font-semibold">
                    {dayIt(p.startMs)} {timeIt(p.startMs)}
                  </span>
                  <span className="text-xs text-[var(--hub-dim)]">
                    {' '}
                    · da {compassIt(p.startAzimuthDeg)} a {compassIt(p.endAzimuthDeg)} · alta {Math.round(p.maxElevationDeg)}°
                  </span>
                </span>
                {p.visible ? (
                  <span className="text-xs font-bold text-[var(--hub-amber)]">Visibile</span>
                ) : (
                  <span className="text-xs text-[var(--hub-dim)]">Non visibile</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-[var(--hub-dim)] mt-2">Visibile = cielo buio e stazione illuminata dal Sole: un punto luminoso che attraversa il cielo in pochi minuti.</p>
      </div>
    </div>
  );
};

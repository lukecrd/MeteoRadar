import React from 'react';
import { Camera, ExternalLink, RefreshCw } from 'lucide-react';
import type { WebcamsResponse } from '../../lib/webcams';
import { LocationInfo } from '../types';
import { usePolledJson } from '../hooks/usePolledJson';
import { WORLD_ENDPOINTS } from '../services/worldEventsApi';
import { distanceKm } from '../alerts/personalAlerts';

// Windy's image URLs expire after 10 minutes: reload the list before they do.
const REFRESH_MS = 5 * 60_000;

/** Live webcams around the selected place (Windy Webcams API, via /api/webcams). */
export const WebcamsCard: React.FC<{ location: LocationInfo }> = ({ location }) => {
  const { latitude: lat, longitude: lon } = location;
  const feed = usePolledJson<WebcamsResponse>(WORLD_ENDPOINTS.webcams(lat.toFixed(2), lon.toFixed(2)), REFRESH_MS);
  const items = (feed.data?.items ?? [])
    .map((w) => ({ ...w, km: distanceKm(lat, lon, w.lat, w.lon) }))
    .sort((a, b) => a.km - b.km);
  const problem = feed.error ?? feed.data?.error;

  return (
    <div className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Camera className="w-5 h-5 text-fg-muted shrink-0" aria-hidden />
          <div className="min-w-0">
            <h2 className="font-display text-lg text-fg">Telecamere in zona</h2>
            <p className="text-sm text-fg-muted">Entro 30 km da {location.name}, dalla più vicina</p>
          </div>
        </div>
        <button type="button" onClick={feed.retry} className="hub-icon-btn" aria-label="Aggiorna telecamere">
          <RefreshCw className={`w-4 h-4 ${feed.isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {feed.data && !feed.data.configured ? (
        <p className="text-sm text-fg-muted">
          Servizio non configurato: sul server manca la chiave <code>WINDY_API_KEY</code>.
        </p>
      ) : items.length > 0 ? (
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((w) => (
            <li key={w.id}>
              <a
                href={w.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hub-3d-subcard group block overflow-hidden"
              >
                <img
                  src={w.image}
                  alt={`Ultima immagine della telecamera ${w.title}`}
                  loading="lazy"
                  className="on-dark w-full aspect-video object-cover bg-slate-900"
                />
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-fg line-clamp-2">{w.title}</span>
                    <ExternalLink className="w-4 h-4 text-fg-muted shrink-0 mt-0.5" aria-hidden />
                  </div>
                  <div className="font-hud text-xs text-fg-muted mt-1">
                    {w.city ? `${w.city} · ` : ''}a {w.km < 10 ? w.km.toFixed(1) : Math.round(w.km)} km
                    {w.updatedAt &&
                      ` · ${new Date(w.updatedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`}
                    <span className="sr-only"> (si apre su windy.com in una nuova scheda)</span>
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      ) : feed.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="hub-skeleton aspect-video" />
          ))}
        </div>
      ) : problem ? (
        <p className="text-sm text-fg-muted" role="status">
          Telecamere non disponibili al momento ({problem}). Riprova con il pulsante in alto.
        </p>
      ) : (
        <p className="text-sm text-fg-muted">Nessuna telecamera attiva entro 30 km.</p>
      )}

      <p className="text-xs text-fg-muted mt-4">
        Immagini fornite da{' '}
        <a href="https://www.windy.com/webcams" target="_blank" rel="noopener noreferrer" className="underline">
          windy.com
        </a>
      </p>
    </div>
  );
};

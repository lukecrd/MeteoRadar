import { useCallback, useEffect, useState } from 'react';
import { AppRoute, MeteoSection } from '../types';

const ROUTES: AppRoute[] = ['mondo', 'meteo', 'mappa', 'notizie'];
/** WorldHub opens on the globe page (#/mondo); an empty or unknown hash lands there. */
const DEFAULT_ROUTE: AppRoute = 'mondo';
const SECTIONS: MeteoSection[] = ['oggi', 'previsioni', 'grafici', 'vento', 'ambiente', 'fulmini'];

export interface RouteState {
  route: AppRoute;
  section: MeteoSection | null;
}

// Hash routing (#/meteo/vento): works on Vercel, the dev server and the Capacitor
// WebView without server rewrites, and every change is a real history entry.
function parseHash(hash: string): RouteState {
  const [rawRoute, rawSection] = hash.replace(/^#\/?/, '').split('/');
  const route = ROUTES.includes(rawRoute as AppRoute) ? (rawRoute as AppRoute) : DEFAULT_ROUTE;
  const section = route === 'meteo' && SECTIONS.includes(rawSection as MeteoSection) ? (rawSection as MeteoSection) : null;
  return { route, section };
}

export function useHashRoute() {
  const [state, setState] = useState<RouteState>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setState(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((route: AppRoute, section?: MeteoSection) => {
    const next = `#/${route}${section ? `/${section}` : ''}`;
    if (window.location.hash !== next) {
      window.location.hash = next;
    } else if (section) {
      // Same hash: re-trigger the scroll to the section
      setState({ route, section });
    }
  }, []);

  return { ...state, navigate };
}

/**
 * Android hardware back button: walk back through the hash history first,
 * exit the app only from the root. No-op outside the native shell.
 */
export function useAndroidBackButton() {
  useEffect(() => {
    let remove: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      const { App } = await import('@capacitor/app');
      const handle = await App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else App.exitApp();
      });
      if (cancelled) handle.remove();
      else remove = () => handle.remove();
    })();

    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);
}

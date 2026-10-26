import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { BackgroundRunner } from '@capacitor/background-runner';
import {
  AlertConfig,
  AlertNotice,
  AlertPlace,
  AlertRules,
  DEFAULT_ALERT_CONFIG,
  runAlertChecks,
} from '../alerts/personalAlerts';

const CONFIG_KEY = 'worldhub_alerts';
const SEEN_KEY = 'worldhub_alerts_seen';
/** Must match capacitor.config.json → plugins.BackgroundRunner.label */
const RUNNER_LABEL = 'com.meteoradar.italy.alerts';
/** Same cadence as the Android runner (its minimum). */
const WEB_CHECK_MS = 15 * 60 * 1000;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

async function showWebNotification(n: AlertNotice): Promise<boolean> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  try {
    // Android Chrome only allows notifications through the service worker.
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(n.title, { body: n.body, tag: n.key, icon: '/icon.svg' });
    else new Notification(n.title, { body: n.body, tag: n.key, icon: '/icon.svg' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Personal alerts for saved places.
 * Android: the background runner checks every ~15 min even with the app closed;
 * this hook only keeps its config in sync. Web: checks every 15 min while the
 * app is open; notices without notification permission go to `onNotice`.
 */
export function usePersonalAlerts(onNotice: (n: AlertNotice) => void) {
  const native = Capacitor.isNativePlatform();
  const [config, setConfig] = useState<AlertConfig>(() => {
    const c = load<AlertConfig>(CONFIG_KEY, DEFAULT_ALERT_CONFIG);
    return { ...c, rules: { ...DEFAULT_ALERT_CONFIG.rules, ...c.rules } };
  });
  const onNoticeRef = useRef(onNotice);
  onNoticeRef.current = onNotice;

  // Persist, and hand the config to the Android runner.
  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch {
      // Storage full or blocked: the in-memory config still works this session.
    }
    if (native) {
      BackgroundRunner.dispatchEvent({ label: RUNNER_LABEL, event: 'syncConfig', details: { config } }).catch((e: unknown) =>
        console.warn('Allerte: sincronizzazione con il runner non riuscita', e)
      );
    }
  }, [config, native]);

  const runWeb = useCallback(async () => {
    const seen = load<Record<string, number>>(SEEN_KEY, {});
    const res = await runAlertChecks(config, seen);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(res.seen));
    } catch {
      // Without storage a notice may repeat on the next check; acceptable.
    }
    for (const n of res.fresh) if (!(await showWebNotification(n))) onNoticeRef.current(n);
    return res;
  }, [config]);

  // Web: periodic check while the app is open.
  useEffect(() => {
    if (native || !config.enabled || config.places.length === 0) return;
    runWeb().catch((e) => console.warn('Allerte: controllo non riuscito', e));
    const id = setInterval(() => runWeb().catch((e) => console.warn('Allerte: controllo non riuscito', e)), WEB_CHECK_MS);
    return () => clearInterval(id);
  }, [native, config.enabled, config.places.length, runWeb]);

  /** Ask for notification permission, then switch alerts on. Returns false if refused. */
  const enable = useCallback(async (): Promise<boolean> => {
    let granted = false;
    try {
      if (native) {
        const status = await BackgroundRunner.requestPermissions({ apis: ['notifications'] });
        granted = status.notifications === 'granted';
      } else if (typeof Notification !== 'undefined') {
        granted = (await Notification.requestPermission()) === 'granted';
      }
    } catch {
      granted = false;
    }
    // On the web, alerts still work without permission (shown inside the app).
    if (granted || !native) setConfig((c) => ({ ...c, enabled: true }));
    return granted;
  }, [native]);

  const disable = useCallback(() => setConfig((c) => ({ ...c, enabled: false })), []);

  const addPlace = useCallback((p: AlertPlace) => {
    setConfig((c) => (c.places.some((x) => x.id === p.id) ? c : { ...c, places: [...c.places, p] }));
  }, []);
  const removePlace = useCallback((id: string) => setConfig((c) => ({ ...c, places: c.places.filter((p) => p.id !== id) })), []);
  const updateRules = useCallback((r: Partial<AlertRules>) => setConfig((c) => ({ ...c, rules: { ...c.rules, ...r } })), []);

  /** Run a check now; resolves to a short summary for the UI. */
  const checkNow = useCallback(async (): Promise<string> => {
    try {
      const res: { sent: number; errors: string[] } = native
        ? await BackgroundRunner.dispatchEvent({ label: RUNNER_LABEL, event: 'checkAlerts', details: {} })
        : await runWeb().then((r) => ({ sent: r.fresh.length, errors: r.errors }));
      const head = res.sent === 0 ? 'Nessuna nuova allerta.' : `${res.sent} ${res.sent === 1 ? 'nuova allerta inviata' : 'nuove allerte inviate'}.`;
      return res.errors.length ? `${head} Non raggiungibile: ${res.errors.join('; ')}` : head;
    } catch (e) {
      return `Controllo non riuscito: ${(e as Error).message}`;
    }
  }, [native, runWeb]);

  return { config, native, enable, disable, addPlace, removePlace, updateRules, checkNow };
}

export type PersonalAlerts = ReturnType<typeof usePersonalAlerts>;

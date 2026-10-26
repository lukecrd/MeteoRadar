/**
 * Android background runner for personal alerts.
 * Bundled by `npm run build:runner` into public/runners/alerts.js (see
 * capacitor.config.json → plugins.BackgroundRunner). It runs in the plugin's
 * headless JS engine: no DOM, no localStorage; storage is CapacitorKV.
 */
import { AlertConfig, DEFAULT_ALERT_CONFIG, noticeId, runAlertChecks } from './personalAlerts';

declare const CapacitorKV: {
  get(key: string): { value: string } | string | null | undefined;
  set(key: string, value: string): void;
};
declare const CapacitorNotifications: {
  schedule(options: { id: number; title: string; body: string; autoCancel?: boolean }[]): void;
};
declare function addEventListener(
  event: string,
  handler: (resolve: (data?: unknown) => void, reject: (err?: unknown) => void, args: any) => void
): void;

const CONFIG_KEY = 'alerts.config';
const SEEN_KEY = 'alerts.seen';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = CapacitorKV.get(key);
    const text = typeof raw === 'string' ? raw : raw?.value;
    return text ? (JSON.parse(text) as T) : fallback;
  } catch {
    return fallback;
  }
}

// The app sends its alert settings here whenever they change.
addEventListener('syncConfig', (resolve, reject, args) => {
  try {
    CapacitorKV.set(CONFIG_KEY, JSON.stringify(args?.config ?? DEFAULT_ALERT_CONFIG));
    resolve();
  } catch (err) {
    reject(err);
  }
});

// Periodic check (and "Controlla ora" from the settings).
addEventListener('checkAlerts', async (resolve, reject) => {
  try {
    const config = readJson<AlertConfig>(CONFIG_KEY, DEFAULT_ALERT_CONFIG);
    const { fresh, seen, errors } = await runAlertChecks(config, readJson<Record<string, number>>(SEEN_KEY, {}));
    if (fresh.length > 0) {
      CapacitorNotifications.schedule(fresh.map((n) => ({ id: noticeId(n.key), title: n.title, body: n.body, autoCancel: true })));
    }
    CapacitorKV.set(SEEN_KEY, JSON.stringify(seen));
    resolve({ sent: fresh.length, errors });
  } catch (err) {
    reject(err);
  }
});

import React from 'react';
import { X, Bell, Sliders, Volume2, VolumeX, Smartphone, Zap, Droplets, Wind, ShieldAlert, Check } from 'lucide-react';
import { NotificationSettings } from '../types';
import { playTestChime, triggerVibration } from '../services/audioAlerts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: NotificationSettings;
  onUpdateSettings: (newSettings: Partial<NotificationSettings>) => void;
  onTestNotification: () => void;
  isDark: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onTestNotification,
  isDark
}) => {
  if (!isOpen) return null;

  const requestBrowserPushPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        onUpdateSettings({ enableBrowserPush: true });
        new Notification('MeteoRadar 3D', {
          body: 'Notifiche meteo avanzate attivate con successo!',
          icon: '/favicon.ico'
        });
      } else {
        onUpdateSettings({ enableBrowserPush: false });
      }
    }
  };

  const handleTestAlert = () => {
    if (settings.enableAudioAlerts) {
      playTestChime(settings.audioVolume);
    }
    if (settings.enableVibration) {
      triggerVibration([150, 80, 150]);
    }
    onTestNotification();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-xl rounded-3xl p-6 sm:p-8 border shadow-2xl relative overflow-hidden transition-all max-h-[90vh] overflow-y-auto ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-teal-500/15 text-teal-500">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Impostazioni Avanzate di Sistema</h2>
              <p className="text-xs text-slate-500 dark:text-slate-300">Personalizzazione soglie di allarme e notifiche</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Audio & Alert Feedback */}
          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-3 flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Canali di Notifica & Audio Acustico
            </h3>

            <div className="space-y-3">
              {/* Sound toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Avvisi Sonori Web Audio</div>
                  <div className="text-xs text-slate-500 dark:text-slate-300">Sintesi acustica radar e allarmi temporale</div>
                </div>
                <button
                  onClick={() => onUpdateSettings({ enableAudioAlerts: !settings.enableAudioAlerts })}
                  className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ${
                    settings.enableAudioAlerts ? 'bg-teal-500' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                      settings.enableAudioAlerts ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Volume Slider */}
              {settings.enableAudioAlerts && (
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
                    <span>Volume Allarmi</span>
                    <span>{Math.round(settings.audioVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={settings.audioVolume}
                    onChange={(e) => onUpdateSettings({ audioVolume: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                  />
                </div>
              )}

              {/* Vibration Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700/50">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Feedback Aptico / Vibrazione</div>
                  <div className="text-xs text-slate-500 dark:text-slate-300">Vibrazione dispositivo su allarmi critici</div>
                </div>
                <button
                  onClick={() => onUpdateSettings({ enableVibration: !settings.enableVibration })}
                  className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ${
                    settings.enableVibration ? 'bg-teal-500' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                      settings.enableVibration ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Browser Push Notification */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700/50">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Notifiche Push Browser</div>
                  <div className="text-xs text-slate-500 dark:text-slate-300">Avvisi in background anche a scheda ridotta</div>
                </div>
                <button
                  onClick={requestBrowserPushPermission}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                    settings.enableBrowserPush
                      ? 'bg-teal-500 text-white border-teal-500'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {settings.enableBrowserPush ? 'Attive' : 'Richiedi'}
                </button>
              </div>
            </div>
          </div>

          {/* Humidity Sensor Settings */}
          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3 flex items-center gap-2">
              <Droplets className="w-4 h-4" />
              Soglia Variazione Igrometrica Improvvisa
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Allarme Sbalzo di Umidità</div>
                  <div className="text-xs text-slate-500 dark:text-slate-300">Rileva sbalzi rapidi indicatori di fronti piovosi</div>
                </div>
                <button
                  onClick={() => onUpdateSettings({ enableHumidityAlerts: !settings.enableHumidityAlerts })}
                  className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ${
                    settings.enableHumidityAlerts ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                      settings.enableHumidityAlerts ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {settings.enableHumidityAlerts && (
                <div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mb-1.5">
                    Sensibilità Sbalzo: <span className="font-bold text-cyan-400">±{settings.humiditySpikeThreshold}% in 15 min</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[3, 5, 8, 12].map((threshold) => (
                      <button
                        key={threshold}
                        onClick={() => onUpdateSettings({ humiditySpikeThreshold: threshold })}
                        className={`py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                          settings.humiditySpikeThreshold === threshold
                            ? 'bg-cyan-500 text-white border-cyan-400'
                            : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        ±{threshold}%
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Lightning Settings */}
          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Soglia Raggio Radar Tuoni & Lampi
            </h3>

            <div className="space-y-3">
              <div>
                <div className="text-xs text-slate-600 dark:text-slate-300 mb-1.5">
                  Raggio Allarme di Prossimità: <span className="font-bold text-amber-400">{settings.lightningProximityThresholdKm} km</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 15, 25, 35].map((dist) => (
                    <button
                      key={dist}
                      onClick={() => onUpdateSettings({ lightningProximityThresholdKm: dist })}
                      className={`py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        settings.lightningProximityThresholdKm === dist
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {dist} km
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Wind Settings */}
          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-3 flex items-center gap-2">
              <Wind className="w-4 h-4" />
              Allarme Raffiche di Vento Estreme
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Notifica Raffiche Elevate</div>
                  <div className="text-xs text-slate-500 dark:text-slate-300">Avvisa quando il vento supera la soglia di sicurezza</div>
                </div>
                <button
                  onClick={() => onUpdateSettings({ enableWindAlerts: !settings.enableWindAlerts })}
                  className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ${
                    settings.enableWindAlerts ? 'bg-teal-500' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                      settings.enableWindAlerts ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {settings.enableWindAlerts && (
                <div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mb-1.5">
                    Soglia Raffiche: <span className="font-bold text-teal-400">{settings.windSpeedThresholdKm} km/h</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[40, 60, 80].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => onUpdateSettings({ windSpeedThresholdKm: spd })}
                        className={`py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                          settings.windSpeedThresholdKm === spd
                            ? 'bg-teal-500 text-white border-teal-400'
                            : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        &gt; {spd} km/h
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Test Notification Action */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              id="test-notification-system-btn"
              onClick={handleTestAlert}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-teal-400 border border-teal-500/40 flex items-center justify-center gap-2 transition-colors"
            >
              <Bell className="w-4 h-4" />
              Simula Notifica di Test
            </button>

            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs bg-teal-500 hover:bg-teal-400 text-white shadow-md transition-colors"
            >
              Salva & Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

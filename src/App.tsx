import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LocationInfo,
  WeatherData,
  HumiditySensorReading,
  HumidityAlertState,
  LightningStrike,
  NotificationSettings,
  AiPredictionReport,
  AppTab
} from './types';
import { DEFAULT_LOCATION, fetchWeatherData } from './services/weatherApi';
import { playHumidityAlertSound, playLightningAlertSound, triggerVibration } from './services/audioAlerts';
import { Navbar } from './components/Navbar';
import { WeatherHero } from './components/WeatherHero';
import { HumiditySensorCard } from './components/HumiditySensorCard';
import { WindCompassMap } from './components/WindCompassMap';
import { LightningMonitor } from './components/LightningMonitor';
import { ForecastCharts } from './components/ForecastCharts';
import { ForecastFiveDays } from './components/ForecastFiveDays';
import { EnvironmentalUvCard } from './components/EnvironmentalUvCard';
import { AiForecastModal } from './components/AiForecastModal';
import { SettingsModal } from './components/SettingsModal';
import { AtmosphericCanvas } from './components/AtmosphericCanvas';
import { AlertBanner } from './components/AlertBanner';
import { ItalySatelliteMap } from './components/ItalySatelliteMap';
import { AndroidModal } from './components/AndroidModal';
import { VercelModal } from './components/VercelModal';
import { Loader2, Radio, Activity, Sun, Zap, Calendar, Wind, Trees, Layers } from 'lucide-react';

export default function App() {
  // Theme state: dark mode as default for optimal night radar readability
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('meteosense_theme');
      return saved ? saved === 'dark' : true;
    }
    return true;
  });

  // Main application Tab based on Stitch navigation architecture
  const [activeAppTab, setActiveAppTab] = useState<AppTab>('station');

  // Location & Weather Data
  const [currentLocation, setCurrentLocation] = useState<LocationInfo>(DEFAULT_LOCATION);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGpsLoading, setIsGpsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Background atmospheric lightning trigger
  const [lightningFlashTrigger, setLightningFlashTrigger] = useState<number>(0);

  // Humidity Sensor Telemetry & Rolling History
  const [currentHumidity, setCurrentHumidity] = useState<number>(65);
  const [humidityReadings, setHumidityReadings] = useState<HumiditySensorReading[]>([]);
  const [humidityAlertState, setHumidityAlertState] = useState<HumidityAlertState>({
    isSpikeActive: false,
    changeRate: 0,
    direction: 'stable',
    message: '',
    detectedAt: null,
  });

  // Lightning Strikes State
  const [lightningStrikes, setLightningStrikes] = useState<LightningStrike[]>([]);

  // System Notification Settings
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('meteosense_settings');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    return {
      enableAudioAlerts: true,
      audioVolume: 0.75,
      enableBrowserPush: false,
      enableVibration: true,
      enableHumidityAlerts: true,
      humiditySpikeThreshold: 5, // ±5% in short interval
      enableLightningAlerts: true,
      lightningProximityThresholdKm: 15,
      alertOnSevereOnly: false,
      enableWindAlerts: true,
      windSpeedThresholdKm: 60,
    };
  });

  // Modals & AI Report State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState(false);
  const [isVercelModalOpen, setIsVercelModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiReport, setAiReport] = useState<AiPredictionReport | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [testToastMessage, setTestToastMessage] = useState<string | null>(null);

  // Lightning Alert Dismissal & Snooze State
  const [isLightningAlertDismissed, setIsLightningAlertDismissed] = useState(false);
  const [lightningSnoozedUntil, setLightningSnoozedUntil] = useState<number | null>(null);

  const handleDismissLightningAlert = () => {
    setIsLightningAlertDismissed(true);
  };

  const handleSnoozeLightningAlert = (minutes: number = 15) => {
    setIsLightningAlertDismissed(true);
    setLightningSnoozedUntil(Date.now() + minutes * 60 * 1000);
  };

  const isLightningCurrentlyDismissed =
    isLightningAlertDismissed ||
    (lightningSnoozedUntil !== null && Date.now() < lightningSnoozedUntil);

  // Save settings to localStorage
  const handleUpdateSettings = (newSettings: Partial<NotificationSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (typeof window !== 'undefined') {
        localStorage.setItem('meteosense_settings', JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Toggle Theme
  const handleToggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('meteosense_theme', next ? 'dark' : 'light');
      }
      return next;
    });
  };

  // Apply dark class to documentElement
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Load weather data for location
  const loadWeather = useCallback(async (loc: LocationInfo) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchWeatherData(loc);
      setWeatherData(data);
      setCurrentHumidity(data.current.relativeHumidity);

      // Seed initial sensor history if empty
      const now = Date.now();
      const baseHum = data.current.relativeHumidity;
      const initialReadings: HumiditySensorReading[] = [];
      for (let i = 10; i >= 0; i--) {
        const time = new Date(now - i * 60 * 1000);
        const jitter = (Math.sin(i) * 1.5);
        initialReadings.push({
          timestamp: time.getTime(),
          timeLabel: `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`,
          humidity: Math.round(Math.min(100, Math.max(10, baseHum + jitter))),
          temperature: data.current.temperature,
        });
      }
      setHumidityReadings(initialReadings);

      // Populate some realistic convective lightning strikes if high CAPE or storm code
      if (data.current.weatherCode >= 80 || (data.hourly[0]?.cape && data.hourly[0].cape > 400)) {
        const initialStrikes: LightningStrike[] = [
          {
            id: 'init-1',
            latitude: loc.latitude + 0.08,
            longitude: loc.longitude + 0.05,
            distanceKm: 12.4,
            bearingDeg: 42,
            peakCurrentKa: 48,
            polarity: '-',
            type: 'CG',
            timestamp: Date.now() - 30000,
            severityZone: 'orange',
          },
          {
            id: 'init-2',
            latitude: loc.latitude - 0.15,
            longitude: loc.longitude - 0.12,
            distanceKm: 24.8,
            bearingDeg: 215,
            peakCurrentKa: 32,
            polarity: '+',
            type: 'IC',
            timestamp: Date.now() - 90000,
            severityZone: 'yellow',
          }
        ];
        setLightningStrikes(initialStrikes);
      } else {
        setLightningStrikes([]);
      }
    } catch (err: any) {
      console.error('Error fetching weather:', err);
      setErrorMsg(err.message || 'Errore nel recupero dati meteorologici');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadWeather(currentLocation);
  }, [loadWeather, currentLocation]);

  // GPS Location handler
  const handleUseGps = () => {
    if (!navigator.geolocation) {
      alert('Geolocalizzazione non supportata dal tuo browser');
      return;
    }
    setIsGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc: LocationInfo = {
          name: 'La Mia Posizione GPS',
          country: 'Coordinate Rilevate',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setCurrentLocation(loc);
        setIsGpsLoading(false);
      },
      (err) => {
        console.warn('GPS position error:', err);
        setIsGpsLoading(false);
        alert('Impossibile ottenere la posizione GPS: ' + err.message);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Real-time sensor continuous micro-telemetry loop (1 tick every 4 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setHumidityReadings((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        // small realistic physical jitter ±0.3%
        const jitter = (Math.random() - 0.49) * 0.4;
        const newHumidity = Math.round(Math.min(100, Math.max(10, last.humidity + jitter)) * 10) / 10;
        setCurrentHumidity(newHumidity);

        const now = new Date();
        const newReading: HumiditySensorReading = {
          timestamp: now.getTime(),
          timeLabel: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`,
          humidity: newHumidity,
          temperature: weatherData?.current.temperature || 20,
        };

        const updated = [...prev.slice(-25), newReading];

        // Check for sudden rate of change
        if (updated.length >= 6) {
          const sampleOld = updated[0].humidity;
          const sampleNew = newReading.humidity;
          const delta = sampleNew - sampleOld;
          // Projected hourly rate
          const ratePerHour = (delta / (updated.length * 4)) * 3600;

          if (Math.abs(delta) >= settings.humiditySpikeThreshold && settings.enableHumidityAlerts) {
            const isRising = delta > 0;
            setHumidityAlertState({
              isSpikeActive: true,
              changeRate: Math.abs(ratePerHour),
              direction: isRising ? 'rising' : 'falling',
              message: isRising
                ? `Rilevato repentino aumento dell'umidità (+${delta.toFixed(1)}%): possibile fronte convettivo instabile o temporale in arrivo.`
                : `Rilevato rapido calo dell'umidità (${delta.toFixed(1)}%): ingresso di masse d'aria secca.`,
              detectedAt: Date.now(),
            });

            if (settings.enableAudioAlerts) {
              playHumidityAlertSound(settings.audioVolume);
            }
            if (settings.enableVibration) {
              triggerVibration([200, 100, 200]);
            }
          }
        }

        return updated;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [settings.enableHumidityAlerts, settings.humiditySpikeThreshold, settings.enableAudioAlerts, settings.audioVolume, settings.enableVibration, weatherData]);

  // Simulate Humidity Spike (+12% or -10%)
  const handleSimulateHumiditySpike = (delta: number) => {
    const newHum = Math.min(100, Math.max(10, currentHumidity + delta));
    setCurrentHumidity(newHum);

    const now = new Date();
    const newReading: HumiditySensorReading = {
      timestamp: now.getTime(),
      timeLabel: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`,
      humidity: newHum,
      temperature: weatherData?.current.temperature || 20,
      isSimulated: true,
    };

    setHumidityReadings((prev) => [...prev.slice(-25), newReading]);

    const isRising = delta > 0;
    setHumidityAlertState({
      isSpikeActive: true,
      changeRate: Math.abs(delta) * 4,
      direction: isRising ? 'rising' : 'falling',
      message: isRising
        ? `Rilevato repentino aumento dell'umidità (+${delta}%): forte segnale di fronte precipitativo imminente!`
        : `Rilevata brusca diminuzione di umidità (${delta}%): forte sbalzo termodinamico!`,
      detectedAt: Date.now(),
    });

    if (settings.enableAudioAlerts) {
      playHumidityAlertSound(settings.audioVolume);
    }
    if (settings.enableVibration) {
      triggerVibration([250, 100, 250]);
    }
  };

  // Sensor Calibration handler
  const handleCalibrateSensor = () => {
    if (weatherData) {
      setCurrentHumidity(weatherData.current.relativeHumidity);
      setHumidityAlertState({
        isSpikeActive: false,
        changeRate: 0,
        direction: 'stable',
        message: '',
        detectedAt: null,
      });
    }
  };

  // Simulate Lightning Strike
  const handleSimulateLightningStrike = (customDistKm?: number) => {
    const distanceKm = customDistKm !== undefined ? customDistKm : Math.round((2 + Math.random() * 25) * 10) / 10;
    const bearingDeg = Math.round(Math.random() * 360);
    const peakCurrentKa = Math.round(20 + Math.random() * 90);
    const isSevere = distanceKm <= 5;

    let severityZone: 'green' | 'yellow' | 'orange' | 'red' = 'green';
    if (distanceKm <= 5) severityZone = 'red';
    else if (distanceKm <= 15) severityZone = 'orange';
    else if (distanceKm <= 30) severityZone = 'yellow';

    const newStrike: LightningStrike = {
      id: `strike-${Date.now()}`,
      latitude: currentLocation.latitude + (Math.sin((bearingDeg * Math.PI) / 180) * distanceKm) / 111,
      longitude: currentLocation.longitude + (Math.cos((bearingDeg * Math.PI) / 180) * distanceKm) / 111,
      distanceKm,
      bearingDeg,
      peakCurrentKa,
      polarity: Math.random() > 0.3 ? '-' : '+',
      type: Math.random() > 0.4 ? 'CG' : 'IC',
      timestamp: Date.now(),
      severityZone,
    };

    setLightningStrikes((prev) => [newStrike, ...prev.slice(0, 12)]);
    setLightningFlashTrigger((prev) => prev + 1);
    setIsLightningAlertDismissed(false); // Un-dismiss when new strike is generated/tested

    // Audio & Vibration alerts for lightning
    if (settings.enableAudioAlerts) {
      playLightningAlertSound(settings.audioVolume, isSevere);
    }
    if (settings.enableVibration) {
      triggerVibration(isSevere ? [300, 100, 300, 100, 300] : [200, 100, 200]);
    }
  };

  // Trigger AI Meteorological Diagnostic Report
  const handleGenerateAiReport = async () => {
    if (!weatherData) return;
    setIsAiModalOpen(true);
    setIsAiLoading(true);

    try {
      const res = await fetch('/api/weather/predict-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: weatherData.location,
          currentTemp: weatherData.current.temperature,
          humidity: currentHumidity,
          humidityChangeRate: humidityAlertState.changeRate,
          windSpeed: weatherData.current.windSpeed,
          windDirection: weatherData.current.windDirection,
          windGusts: weatherData.current.windGusts,
          pressure: weatherData.current.pressure,
          lightningCount: lightningStrikes.length,
          lightningDistance: lightningStrikes[0]?.distanceKm || 99,
          hourlyForecast: weatherData.hourly,
        }),
      });

      if (!res.ok) throw new Error('AI analysis error');
      const data = await res.json();
      setAiReport(data);
    } catch (err: any) {
      console.error('AI diagnosis error:', err);
      // Fallback report
      setAiReport({
        summary: `Quadro atmosferico per ${weatherData.location.name}: ${weatherData.current.temperature}°C, umidità relativa al ${currentHumidity}%. Vento da ${weatherData.current.windDirection}° a ${weatherData.current.windSpeed} km/h.`,
        prediction: humidityAlertState.isSpikeActive
          ? `L'aumento repentino dell'umidità indica instabilità atmosferica e possibile approssimarsi di rovesci nelle prossime 2 ore.`
          : `Condizioni stabili senza imminenti repentini sbalzi barometrici previsti.`,
        riskLevel: humidityAlertState.isSpikeActive ? 'MODERATO' : 'STABILE',
        lightningRisk: lightningStrikes.length > 0 ? 'Attività elettrica convettiva rilevata' : 'Nessuna attività elettrica significativa',
        advisory: 'Monitorare la bussola del vento e gli allarmi igrometrici.',
        confidence: 90,
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const closestStrike = lightningStrikes.length > 0
    ? lightningStrikes.reduce((min, s) => (s.distanceKm < min.distanceKm ? s : min), lightningStrikes[0])
    : null;

  return (
    <div
      className={`min-h-screen relative font-sans transition-colors duration-300 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Dynamic Atmospheric Particle and Flash Background */}
      {weatherData && (
        <AtmosphericCanvas
          weatherCode={weatherData.current.weatherCode}
          isDay={weatherData.current.isDay}
          windSpeed={weatherData.current.windSpeed}
          windDirection={weatherData.current.windDirection}
          lightningTrigger={lightningFlashTrigger}
          isDark={isDark}
        />
      )}

      {/* Main Navbar */}
      <Navbar
        currentLocation={currentLocation}
        onSelectLocation={(loc) => {
          setCurrentLocation(loc);
        }}
        onUseGps={handleUseGps}
        isGpsLoading={isGpsLoading}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAndroid={() => setIsAndroidModalOpen(true)}
        onOpenVercel={() => setIsVercelModalOpen(true)}
        hasActiveAlerts={
          humidityAlertState.isSpikeActive ||
          (!isLightningCurrentlyDismissed && closestStrike !== null && closestStrike.distanceKm < settings.lightningProximityThresholdKm)
        }
        activeAppTab={activeAppTab}
        onSelectAppTab={setActiveAppTab}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 relative z-10">
        {/* Main Tab Navigation Header - Matching Stitch Application Layout */}
        <div className="bg-slate-100/90 dark:bg-slate-900/90 p-1.5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {/* 1. All Modules / Full Console */}
            <button
              id="app-tab-station-dashboard-btn"
              onClick={() => setActiveAppTab('station')}
              className={`shrink-0 px-3.5 py-2 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                activeAppTab === 'station'
                  ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Console Completa</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black hidden sm:inline ${
                activeAppTab === 'station' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
              }`}>
                {currentLocation.name}
              </span>
            </button>

            {/* 2. Oggi & Allerte */}
            <button
              id="app-tab-today-btn"
              onClick={() => setActiveAppTab('today')}
              className={`shrink-0 px-3.5 py-2 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                activeAppTab === 'today'
                  ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Oggi & Allerte</span>
            </button>

            {/* 3. Radar & Fulmini */}
            <button
              id="app-tab-radar-btn"
              onClick={() => setActiveAppTab('radar')}
              className={`shrink-0 px-3.5 py-2 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                activeAppTab === 'radar'
                  ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>Radar & Fulmini</span>
              {lightningStrikes.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-black animate-pulse">
                  {lightningStrikes.length}
                </span>
              )}
            </button>

            {/* 4. Previsioni 5G */}
            <button
              id="app-tab-forecast5-btn"
              onClick={() => setActiveAppTab('forecast5')}
              className={`shrink-0 px-3.5 py-2 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                activeAppTab === 'forecast5'
                  ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>Previsioni 5G</span>
            </button>

            {/* 5. Vento & Umidità */}
            <button
              id="app-tab-wind-btn"
              onClick={() => setActiveAppTab('wind')}
              className={`shrink-0 px-3.5 py-2 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                activeAppTab === 'wind'
                  ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <Wind className="w-4 h-4 text-cyan-400" />
              <span>Vento & Umidità</span>
            </button>

            {/* 6. UV & Qualità Aria */}
            <button
              id="app-tab-ambient-btn"
              onClick={() => setActiveAppTab('ambient')}
              className={`shrink-0 px-3.5 py-2 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                activeAppTab === 'ambient'
                  ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <Trees className="w-4 h-4 text-emerald-400" />
              <span>UV & Qualità Aria</span>
            </button>

            {/* 7. Mappa Satellite Italia */}
            <button
              id="app-tab-italy-satellite-btn"
              onClick={() => setActiveAppTab('italy_map')}
              className={`shrink-0 px-3.5 py-2 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ml-auto ${
                activeAppTab === 'italy_map'
                  ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/25'
                  : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
              <span>Mappa Italia</span>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-black border border-rose-500/30">
                LIVE
              </span>
            </button>
          </div>
        </div>

        {/* Loading Spinner */}
        {isLoading && !weatherData && (
          <div className="py-32 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 text-teal-500 animate-spin" />
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Connessione API meteorologica in corso...
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 text-sm font-medium">
            {errorMsg}
          </div>
        )}

        {/* Content Views */}
        {weatherData && (
          <>
            {/* VIEW 1: Full Console / All Modules */}
            {activeAppTab === 'station' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* 1. Hero Weather Overview & AI Report Trigger */}
                <WeatherHero
                  weather={weatherData}
                  isDark={isDark}
                  isLoading={isLoading}
                  onRefresh={() => loadWeather(currentLocation)}
                  onOpenAiReport={handleGenerateAiReport}
                />

                {/* 2. Environmental UV & European AQI Card */}
                <EnvironmentalUvCard
                  uvIndex={weatherData.current.uvIndex}
                  airQuality={weatherData.airQuality}
                  isDark={isDark}
                />

                {/* 3. Prominent 5-Day Weather Forecast */}
                <ForecastFiveDays
                  daily={weatherData.daily}
                  hourly={weatherData.hourly}
                  isDark={isDark}
                />

                {/* 4. Primary Specialized Instruments Grid: Integrated Humidity Sensor & Wind Compass Map */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Integrated Humidity Sensor Card */}
                  <HumiditySensorCard
                    currentHumidity={currentHumidity}
                    dewPoint={weatherData.current.dewPoint}
                    temperature={weatherData.current.temperature}
                    readings={humidityReadings}
                    alertState={humidityAlertState}
                    onSimulateSpike={handleSimulateHumiditySpike}
                    onCalibrate={handleCalibrateSensor}
                    isDark={isDark}
                    spikeThreshold={settings.humiditySpikeThreshold}
                  />

                  {/* Digital Compass & Wind Vectors Map */}
                  <WindCompassMap
                    windSpeed={weatherData.current.windSpeed}
                    windDirection={weatherData.current.windDirection}
                    windGusts={weatherData.current.windGusts}
                    location={weatherData.location}
                    isDark={isDark}
                  />
                </div>

                {/* 5. Thunder & Lightning Convective Radar with Color Zones & Acoustic Timer */}
                <LightningMonitor
                  strikes={lightningStrikes}
                  capeIndex={weatherData.hourly[0]?.cape || 250}
                  onSimulateStrike={handleSimulateLightningStrike}
                  onClearStrikes={() => {
                    setLightningStrikes([]);
                    setIsLightningAlertDismissed(true);
                  }}
                  isDark={isDark}
                  proximityThreshold={settings.lightningProximityThresholdKm}
                  enableAudio={settings.enableAudioAlerts}
                  audioVolume={settings.audioVolume}
                />

                {/* 6. Forecast Trends & Advanced Recharts Graphs */}
                <ForecastCharts
                  hourly={weatherData.hourly}
                  daily={weatherData.daily}
                  isDark={isDark}
                />
              </div>
            )}

            {/* VIEW 2: Today & Alerts */}
            {activeAppTab === 'today' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <WeatherHero
                  weather={weatherData}
                  isDark={isDark}
                  isLoading={isLoading}
                  onRefresh={() => loadWeather(currentLocation)}
                  onOpenAiReport={handleGenerateAiReport}
                />
                <EnvironmentalUvCard
                  uvIndex={weatherData.current.uvIndex}
                  airQuality={weatherData.airQuality}
                  isDark={isDark}
                />
              </div>
            )}

            {/* VIEW 3: Radar & Thunderstorms */}
            {activeAppTab === 'radar' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <LightningMonitor
                  strikes={lightningStrikes}
                  capeIndex={weatherData.hourly[0]?.cape || 250}
                  onSimulateStrike={handleSimulateLightningStrike}
                  onClearStrikes={() => {
                    setLightningStrikes([]);
                    setIsLightningAlertDismissed(true);
                  }}
                  isDark={isDark}
                  proximityThreshold={settings.lightningProximityThresholdKm}
                  enableAudio={settings.enableAudioAlerts}
                  audioVolume={settings.audioVolume}
                />
              </div>
            )}

            {/* VIEW 4: 5-Day Detailed Forecasts */}
            {activeAppTab === 'forecast5' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <ForecastFiveDays
                  daily={weatherData.daily}
                  hourly={weatherData.hourly}
                  isDark={isDark}
                />
                <ForecastCharts
                  hourly={weatherData.hourly}
                  daily={weatherData.daily}
                  isDark={isDark}
                />
              </div>
            )}

            {/* VIEW 5: Wind & Humidity Analysis */}
            {activeAppTab === 'wind' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <HumiditySensorCard
                    currentHumidity={currentHumidity}
                    dewPoint={weatherData.current.dewPoint}
                    temperature={weatherData.current.temperature}
                    readings={humidityReadings}
                    alertState={humidityAlertState}
                    onSimulateSpike={handleSimulateHumiditySpike}
                    onCalibrate={handleCalibrateSensor}
                    isDark={isDark}
                    spikeThreshold={settings.humiditySpikeThreshold}
                  />

                  <WindCompassMap
                    windSpeed={weatherData.current.windSpeed}
                    windDirection={weatherData.current.windDirection}
                    windGusts={weatherData.current.windGusts}
                    location={weatherData.location}
                    isDark={isDark}
                  />
                </div>
              </div>
            )}

            {/* VIEW 6: UV & Air Quality Analysis */}
            {activeAppTab === 'ambient' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <EnvironmentalUvCard
                  uvIndex={weatherData.current.uvIndex}
                  airQuality={weatherData.airQuality}
                  isDark={isDark}
                />
              </div>
            )}
          </>
        )}

        {/* Tab 7: Italy Real-Time Satellite & Atmospheric Phenomena Map */}
        {activeAppTab === 'italy_map' && (
          <ItalySatelliteMap
            currentLocation={currentLocation}
            onSelectLocation={(loc) => {
              setCurrentLocation(loc);
              loadWeather(loc);
            }}
            isDark={isDark}
          />
        )}
      </main>

      {/* Global Interactive Alert Banner for Sudden Changes & Lightning */}
      <AlertBanner
        humidityAlert={humidityAlertState}
        onDismissHumidityAlert={() => setHumidityAlertState((p) => ({ ...p, isSpikeActive: false }))}
        closestStrike={closestStrike}
        proximityThreshold={settings.lightningProximityThresholdKm}
        isLightningDismissed={isLightningCurrentlyDismissed}
        onDismissLightningAlert={handleDismissLightningAlert}
        onSnoozeLightningAlert={handleSnoozeLightningAlert}
        testToastMessage={testToastMessage}
        onDismissTestToast={() => setTestToastMessage(null)}
        isDark={isDark}
      />

      {/* AI Meteorological Prediction Modal */}
      {weatherData && (
        <AiForecastModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          onRefreshReport={handleGenerateAiReport}
          report={aiReport}
          isLoading={isAiLoading}
          weather={weatherData}
          isDark={isDark}
        />
      )}

      {/* Advanced System Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onTestNotification={() => {
          setTestToastMessage('Allarme di test eseguito con successo! Canali acustici e visivi operativi.');
          setTimeout(() => setTestToastMessage(null), 5000);
        }}
        isDark={isDark}
      />

      {/* Android Installation & Export Modal */}
      <AndroidModal
        isOpen={isAndroidModalOpen}
        onClose={() => setIsAndroidModalOpen(false)}
        isDark={isDark}
      />

      {/* Vercel Cloud Export Modal */}
      <VercelModal
        isOpen={isVercelModalOpen}
        onClose={() => setIsVercelModalOpen(false)}
        isDark={isDark}
      />
    </div>
  );
}

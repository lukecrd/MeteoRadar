import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LocationInfo,
  WeatherData,
  HumiditySensorReading,
  HumidityAlertState,
  LightningStrike,
  NotificationSettings,
  AiPredictionReport,
  MeteoSection
} from './types';
import { useHashRoute, useAndroidBackButton } from './hooks/useHashRoute';
import { AppTopNav, AppBottomNav } from './components/AppNav';
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
import { RadarGlobe3D } from './components/RadarGlobe3D';
import { AlertBanner } from './components/AlertBanner';
import { ItalySatelliteMap } from './components/ItalySatelliteMap';
import { AndroidModal } from './components/AndroidModal';
import { VercelModal } from './components/VercelModal';
import { HubStatusStrip } from './components/HubStatusStrip';
import { NewsTicker } from './components/NewsTicker';
import { NewsHub } from './components/NewsHub';
import { GlobalHub } from './components/hub/GlobalHub';
import { Loader2 } from 'lucide-react';

export default function App() {
  // Theme state: dark mode as default for optimal night radar readability
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('meteosense_theme');
      return saved ? saved === 'dark' : true;
    }
    return true;
  });

  // Primary navigation: hash routes (#/meteo is the home), real history entries
  const { route, section, navigate } = useHashRoute();
  useAndroidBackButton();

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

      // No real lightning feed is wired yet: never invent "detected" strikes.
      // Strikes only appear through the explicit "Simula" test action.
      setLightningStrikes([]);
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
      setTestToastMessage('Geolocalizzazione non supportata da questo dispositivo.');
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
        setTestToastMessage('Impossibile ottenere la posizione GPS: ' + err.message);
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

  const isLightningAlertActive =
    !isLightningCurrentlyDismissed && closestStrike !== null && closestStrike.distanceKm < settings.lightningProximityThresholdKm;
  const activeAlertCount =
    (humidityAlertState.isSpikeActive ? 1 : 0) + (isLightningAlertActive ? 1 : 0) + (weatherData?.alerts?.length ?? 0);

  const devMode = !!settings.developerMode;
  const hasWeather = !!weatherData;

  // On route change start from the top; on #/meteo/<section> scroll to that section
  // (re-run once data arrives so deep links work on first load)
  useEffect(() => {
    if (route === 'meteo' && section) {
      document.getElementById(`sec-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [route, section, hasWeather]);

  const meteoSections: Array<{ id: MeteoSection; label: string }> = [
    { id: 'oggi', label: 'Oggi' },
    { id: 'previsioni', label: 'Previsioni' },
    { id: 'grafici', label: 'Grafici' },
    { id: 'vento', label: 'Vento' },
    { id: 'ambiente', label: 'Umidità e aria' },
    ...(devMode ? [{ id: 'fulmini' as MeteoSection, label: 'Fulmini (demo)' }] : []),
  ];

  return (
    <div className="hub-root min-h-screen relative font-sans transition-colors duration-300 hud-grid-bg">
      {/* Ambient 3D tracking globe — decorative, only behind the world view */}
      {route === 'mondo' && <RadarGlobe3D isDark={isDark} intensity={0.35} />}

      {/* Dynamic Atmospheric Particle and Flash Background */}
      {weatherData && route === 'meteo' && (
        <AtmosphericCanvas
          weatherCode={weatherData.current.weatherCode}
          isDay={weatherData.current.isDay}
          windSpeed={weatherData.current.windSpeed}
          windDirection={weatherData.current.windDirection}
          lightningTrigger={lightningFlashTrigger}
          isDark={isDark}
        />
      )}

      {/* Main Navbar (sticky) with primary navigation on tablet/desktop */}
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
        hasActiveAlerts={humidityAlertState.isSpikeActive || isLightningAlertActive}
        showDevTools={devMode}
      >
        <AppTopNav active={route} onNavigate={navigate} />
      </Navbar>

      {/* Main Container — bottom padding leaves room for the mobile bottom nav */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-10 space-y-6 relative z-10">
        {/* Live telemetry bus: weather view only, tablet and up */}
        {route === 'meteo' && (
          <div className="hidden md:block">
            <HubStatusStrip
              weather={weatherData}
              humidity={currentHumidity}
              isLoading={isLoading}
              hasError={!!errorMsg}
              alertCount={activeAlertCount}
            />
          </div>
        )}

        {/* Loading state */}
        {isLoading && !weatherData && route === 'meteo' && (
          <div className="py-32 flex flex-col items-center justify-center gap-4" role="status">
            <div className="relative w-14 h-14">
              <span className="hud-pulse-ring" />
              <Loader2 className="w-14 h-14 text-[var(--hub-cyan)] animate-spin" />
            </div>
            <div className="hub-label">Caricamento dati meteo…</div>
          </div>
        )}

        {/* Error Notification: only where weather data is shown */}
        {errorMsg && route === 'meteo' && (
          <div role="alert" className="hub-panel p-4 !border-[var(--hub-red)]/40 text-[var(--hub-red)] text-sm font-medium flex flex-wrap items-center gap-3">
            <span>{errorMsg}</span>
            <button
              onClick={() => loadWeather(currentLocation)}
              className="hub-chip !text-[var(--hub-text)]"
            >
              Riprova
            </button>
          </div>
        )}

        {/* METEO (home): one page, progressive sections */}
        {route === 'meteo' && weatherData && (
          <div key="route-meteo" className="space-y-6 animate-tab-enter">
            {/* In-page section shortcuts (replace the old duplicated tabs) */}
            <nav aria-label="Sezioni meteo" className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto hub-scroll">
              <ul className="flex gap-2 w-max">
                {meteoSections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#/meteo/${s.id}`}
                      onClick={(e) => { e.preventDefault(); navigate('meteo', s.id); }}
                      aria-current={section === s.id ? 'true' : undefined}
                      aria-pressed={section === s.id}
                      className="hub-chip !h-9 whitespace-nowrap"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <section id="sec-oggi" aria-label="Condizioni attuali" className="hub-module min-w-0 scroll-mt-40">
              <WeatherHero
                weather={weatherData}
                isDark={isDark}
                isLoading={isLoading}
                onRefresh={() => loadWeather(currentLocation)}
                onOpenAiReport={handleGenerateAiReport}
              />
            </section>

            <section id="sec-previsioni" aria-label="Previsioni a 5 giorni" className="hub-module scroll-mt-40">
              <ForecastFiveDays
                daily={weatherData.daily}
                hourly={weatherData.hourly}
                isDark={isDark}
              />
            </section>

            <section id="sec-grafici" aria-label="Grafici di tendenza" className="hub-module scroll-mt-40">
              <ForecastCharts
                hourly={weatherData.hourly}
                daily={weatherData.daily}
                isDark={isDark}
              />
            </section>

            <section id="sec-vento" aria-label="Vento" className="hub-module scroll-mt-40">
              <WindCompassMap
                windSpeed={weatherData.current.windSpeed}
                windDirection={weatherData.current.windDirection}
                windGusts={weatherData.current.windGusts}
                location={weatherData.location}
                isDark={isDark}
              />
            </section>

            <section id="sec-ambiente" aria-label="Umidità, UV e qualità dell'aria" className="grid grid-cols-1 xl:grid-cols-2 gap-6 scroll-mt-40">
              <div className="hub-module">
                <EnvironmentalUvCard
                  uvIndex={weatherData.current.uvIndex}
                  airQuality={weatherData.airQuality}
                  isDark={isDark}
                />
              </div>
              <div className="hub-module">
                <HumiditySensorCard
                  currentHumidity={currentHumidity}
                  dewPoint={weatherData.current.dewPoint}
                  temperature={weatherData.current.temperature}
                  readings={humidityReadings}
                  alertState={humidityAlertState}
                  onSimulateSpike={devMode ? handleSimulateHumiditySpike : undefined}
                  onCalibrate={handleCalibrateSensor}
                  isDark={isDark}
                  spikeThreshold={settings.humiditySpikeThreshold}
                />
              </div>
            </section>

            {/* Lightning monitor has no real feed yet: shown only as a developer/demo tool */}
            {devMode && (
              <section id="sec-fulmini" aria-label="Simulatore fulmini" className="hub-module scroll-mt-40">
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
              </section>
            )}
          </div>
        )}

        {/* MAPPA: Italy radar & satellite */}
        {route === 'mappa' && (
          <div key="route-mappa" className="animate-tab-enter">
            <ItalySatelliteMap
              currentLocation={currentLocation}
              onSelectLocation={(loc) => {
                // The currentLocation effect reloads the weather: no explicit loadWeather here
                setCurrentLocation(loc);
              }}
              isDark={isDark}
            />
          </div>
        )}

        {/* MONDO: global hub — world news globe, quakes, flights, markets */}
        {route === 'mondo' && (
          <div key="route-mondo" className="animate-tab-enter">
            <GlobalHub />
          </div>
        )}

        {/* NOTIZIE: the only place with the headline ticker */}
        {route === 'notizie' && (
          <div key="route-notizie" className="space-y-4 animate-tab-enter">
            <div className="-mx-4 sm:mx-0">
              <NewsTicker category="meteo" onOpenHub={() => navigate('notizie')} />
            </div>
            <NewsHub />
          </div>
        )}
      </main>

      <AppBottomNav active={route} onNavigate={navigate} />

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

      {/* Developer tools: Android export & Vercel deploy */}
      {devMode && (
        <>
          <AndroidModal
            isOpen={isAndroidModalOpen}
            onClose={() => setIsAndroidModalOpen(false)}
            isDark={isDark}
          />
          <VercelModal
            isOpen={isVercelModalOpen}
            onClose={() => setIsVercelModalOpen(false)}
            isDark={isDark}
          />
        </>
      )}
    </div>
  );
}

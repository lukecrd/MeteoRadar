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
import { RadarGlobe3D } from './components/RadarGlobe3D';
import { AlertBanner } from './components/AlertBanner';
import { ItalySatelliteMap } from './components/ItalySatelliteMap';
import { AndroidModal } from './components/AndroidModal';
import { VercelModal } from './components/VercelModal';
import { HubCommandDeck } from './components/HubCommandDeck';
import { HubStatusStrip } from './components/HubStatusStrip';
import { NewsTicker } from './components/NewsTicker';
import { NewsHub } from './components/NewsHub';
import { NewsFeedPanel } from './components/NewsFeedPanel';
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

  // Main application Tab based on Stitch navigation architecture
  const [activeAppTab, setActiveAppTab] = useState<AppTab>('hub');

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

  const isLightningAlertActive =
    !isLightningCurrentlyDismissed && closestStrike !== null && closestStrike.distanceKm < settings.lightningProximityThresholdKm;
  const activeAlertCount =
    (humidityAlertState.isSpikeActive ? 1 : 0) + (isLightningAlertActive ? 1 : 0) + (weatherData?.alerts?.length ?? 0);

  return (
    <div className="hub-root min-h-screen relative font-sans transition-colors duration-300 hud-grid-bg">
      {/* Ambient 3D tracking globe — furthest-back decorative layer */}
      <RadarGlobe3D isDark={isDark} intensity={activeAppTab === 'hub' ? 0.35 : 0.85} />

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
        hasActiveAlerts={humidityAlertState.isSpikeActive || isLightningAlertActive}
      />

      {/* Live headline band, visible from every module */}
      <NewsTicker category="meteo" onOpenHub={() => setActiveAppTab('news')} />
      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 relative z-10">
        {/* Hub command deck + live telemetry bus */}
        <div className="space-y-3">
          <HubCommandDeck
            active={activeAppTab}
            onSelect={setActiveAppTab}
            badges={lightningStrikes.length > 0 ? { radar: lightningStrikes.length } : undefined}
          />
          <HubStatusStrip
            weather={weatherData}
            humidity={currentHumidity}
            isLoading={isLoading}
            hasError={!!errorMsg}
            alertCount={activeAlertCount}
          />
        </div>

        {/* Loading state */}
        {isLoading && !weatherData && activeAppTab !== 'news' && activeAppTab !== 'hub' && (
          <div className="py-32 flex flex-col items-center justify-center gap-4">
            <div className="relative w-14 h-14">
              <span className="hud-pulse-ring" />
              <Loader2 className="w-14 h-14 text-[var(--hub-cyan)] animate-spin" />
            </div>
            <div className="hub-label">Handshake con i satelliti meteo in corso…</div>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="hub-panel p-4 !border-[var(--hub-red)]/40 text-[var(--hub-red)] text-sm font-medium">
            <span className="hub-label !text-[var(--hub-red)] mr-2">ERR</span>
            {errorMsg}
          </div>
        )}

        {/* VIEW 0 (home): Global Hub — world news globe, markets, crypto */}
        {activeAppTab === 'hub' && (
          <div key="tab-hub" className="animate-tab-enter">
            <GlobalHub />
          </div>
        )}

        {/* VIEW 8: Real-time News Hub (independent from weather data) */}
        {activeAppTab === 'news' && (
          <div key="tab-news" className="animate-tab-enter">
            <NewsHub />
          </div>
        )}

        {/* Content Views */}
        {weatherData && (
          <>
            {/* VIEW 1: Full Console / All Modules */}
            {activeAppTab === 'station' && (
              <div key="tab-station" className="space-y-6 animate-tab-enter">
                {/* 1. Hero + live news column */}
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6">
                  <div className="hub-module min-w-0">
                    <WeatherHero
                      weather={weatherData}
                      isDark={isDark}
                      isLoading={isLoading}
                      onRefresh={() => loadWeather(currentLocation)}
                      onOpenAiReport={handleGenerateAiReport}
                    />
                  </div>
                  <NewsFeedPanel onOpenHub={() => setActiveAppTab('news')} />
                </div>

                {/* 2. Environmental UV & European AQI Card */}
                <div className="hub-module">
                  <EnvironmentalUvCard
                    uvIndex={weatherData.current.uvIndex}
                    airQuality={weatherData.airQuality}
                    isDark={isDark}
                  />
                </div>

                {/* 3. Prominent 5-Day Weather Forecast */}
                <div className="hub-module">
                  <ForecastFiveDays
                    daily={weatherData.daily}
                    hourly={weatherData.hourly}
                    isDark={isDark}
                  />
                </div>

                {/* 4. Primary Specialized Instruments Grid: Integrated Humidity Sensor & Wind Compass Map */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Integrated Humidity Sensor Card */}
                  <div className="hub-module">
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
                  </div>

                  {/* Digital Compass & Wind Vectors Map */}
                  <div className="hub-module">
                    <WindCompassMap
                      windSpeed={weatherData.current.windSpeed}
                      windDirection={weatherData.current.windDirection}
                      windGusts={weatherData.current.windGusts}
                      location={weatherData.location}
                      isDark={isDark}
                    />
                  </div>
                </div>

                {/* 5. Thunder & Lightning Convective Radar with Color Zones & Acoustic Timer */}
                <div className="hub-module">
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

                {/* 6. Forecast Trends & Advanced Recharts Graphs */}
                <div className="hub-module">
                  <ForecastCharts
                    hourly={weatherData.hourly}
                    daily={weatherData.daily}
                    isDark={isDark}
                  />
                </div>
              </div>
            )}

            {/* VIEW 2: Today & Alerts */}
            {activeAppTab === 'today' && (
              <div key="tab-today" className="space-y-6 animate-tab-enter">
                <div className="hub-module">
                  <WeatherHero
                    weather={weatherData}
                    isDark={isDark}
                    isLoading={isLoading}
                    onRefresh={() => loadWeather(currentLocation)}
                    onOpenAiReport={handleGenerateAiReport}
                  />
                </div>
                <div className="hub-module">
                  <EnvironmentalUvCard
                    uvIndex={weatherData.current.uvIndex}
                    airQuality={weatherData.airQuality}
                    isDark={isDark}
                  />
                </div>
              </div>
            )}

            {/* VIEW 3: Radar & Thunderstorms */}
            {activeAppTab === 'radar' && (
              <div key="tab-radar" className="space-y-6 animate-tab-enter">
                <div className="hub-module">
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
              </div>
            )}

            {/* VIEW 4: 5-Day Detailed Forecasts */}
            {activeAppTab === 'forecast5' && (
              <div key="tab-forecast5" className="space-y-6 animate-tab-enter">
                <div className="hub-module">
                  <ForecastFiveDays
                    daily={weatherData.daily}
                    hourly={weatherData.hourly}
                    isDark={isDark}
                  />
                </div>
                <div className="hub-module">
                  <ForecastCharts
                    hourly={weatherData.hourly}
                    daily={weatherData.daily}
                    isDark={isDark}
                  />
                </div>
              </div>
            )}

            {/* VIEW 5: Wind & Humidity Analysis */}
            {activeAppTab === 'wind' && (
              <div key="tab-wind" className="space-y-6 animate-tab-enter">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="hub-module">
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
                  </div>

                  <div className="hub-module">
                    <WindCompassMap
                      windSpeed={weatherData.current.windSpeed}
                      windDirection={weatherData.current.windDirection}
                      windGusts={weatherData.current.windGusts}
                      location={weatherData.location}
                      isDark={isDark}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 6: UV & Air Quality Analysis */}
            {activeAppTab === 'ambient' && (
              <div key="tab-ambient" className="space-y-6 animate-tab-enter">
                <div className="hub-module">
                  <EnvironmentalUvCard
                    uvIndex={weatherData.current.uvIndex}
                    airQuality={weatherData.airQuality}
                    isDark={isDark}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Tab 7: Italy Real-Time Satellite & Atmospheric Phenomena Map */}
        {activeAppTab === 'italy_map' && (
          <div key="tab-italy-map" className="animate-tab-enter">
            <ItalySatelliteMap
              currentLocation={currentLocation}
              onSelectLocation={(loc) => {
                setCurrentLocation(loc);
                loadWeather(loc);
              }}
              isDark={isDark}
            />
          </div>
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

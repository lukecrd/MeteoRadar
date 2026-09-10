export interface LocationInfo {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  relativeHumidity: number;
  dewPoint: number;
  pressure: number;
  windSpeed: number;
  windDirection: number; // degrees 0-360
  windGusts: number;
  weatherCode: number;
  weatherDescription: string;
  isDay: boolean;
  precipitation: number;
  uvIndex: number;
  cloudCover: number;
  visibility: number;
}

export interface HourlyForecastItem {
  time: string;
  hourLabel: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  precipitationProbability: number;
  weatherCode: number;
  weatherDescription: string;
  cape: number; // Convective Available Potential Energy (thunderstorm index)
}

export interface DailyForecastItem {
  date: string;
  dayLabel: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
  weatherDescription: string;
  precipitationProbability: number;
  maxWindSpeed: number;
  dominantWindDirection: number;
  uvMax: number;
}

export interface AirQualityData {
  europeanAqi: number;
  pm10: number;
  pm2_5: number;
  ozone: number;
  nitrogenDioxide: number;
  carbonMonoxide: number;
  uvIndex: number;
  aqiLevel: 'ottima' | 'buona' | 'moderata' | 'scadente' | 'molto_scadente' | 'pericolosa';
  aqiDescription: string;
}

export interface WeatherAlertInfo {
  id: string;
  level: 'green' | 'yellow' | 'orange' | 'red';
  title: string;
  type: 'temporali' | 'idrogeologico' | 'vento' | 'calore' | 'neve';
  description: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  instructions: string;
}

export interface WeatherData {
  location: LocationInfo;
  current: CurrentWeather;
  hourly: HourlyForecastItem[];
  daily: DailyForecastItem[];
  airQuality?: AirQualityData;
  alerts?: WeatherAlertInfo[];
  lastUpdated: string;
}

export interface HumiditySensorReading {
  timestamp: number;
  timeLabel: string;
  humidity: number;
  temperature: number;
  isSimulated?: boolean;
}

export interface HumidityAlertState {
  isSpikeActive: boolean;
  changeRate: number; // % change per hour equivalent
  direction: 'rising' | 'falling' | 'stable';
  message: string;
  detectedAt: number | null;
}

export interface LightningStrike {
  id: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  bearingDeg: number;
  peakCurrentKa: number; // kilo-amperes
  polarity: '+' | '-';
  type: 'CG' | 'IC'; // Cloud-to-Ground or Intra-Cloud
  timestamp: number;
  severityZone: 'green' | 'yellow' | 'orange' | 'red';
}

export interface NotificationSettings {
  enableAudioAlerts: boolean;
  audioVolume: number; // 0 to 1
  enableBrowserPush: boolean;
  enableVibration: boolean;
  
  // Humidity Alert settings
  enableHumidityAlerts: boolean;
  humiditySpikeThreshold: number; // % change in 15 min (e.g. 5%)
  
  // Lightning Alert settings
  enableLightningAlerts: boolean;
  lightningProximityThresholdKm: number; // e.g. 15 km
  alertOnSevereOnly: boolean;
  
  // Wind Alert settings
  enableWindAlerts: boolean;
  windSpeedThresholdKm: number; // e.g. 50 km/h
}

export interface AiPredictionReport {
  summary: string;
  prediction: string;
  riskLevel: 'STABILE' | 'MODERATO' | 'CRITICO';
  lightningRisk: string;
  advisory: string;
  confidence: number;
}

export type SatelliteLayerType = 'satellite_ir' | 'radar_rain' | 'satellite_hd' | 'combined';

export interface ItalyStationWeather {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  temperature: number;
  humidity: number;
  weatherCode: number;
  weatherDescription: string;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  pressure: number;
  phenomenon: 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'snow';
  alertLevel?: 'green' | 'yellow' | 'orange' | 'red';
}

export type AppTab = 'station' | 'today' | 'radar' | 'forecast5' | 'wind' | 'ambient' | 'italy_map';

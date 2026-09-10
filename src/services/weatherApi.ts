import { LocationInfo, WeatherData, HourlyForecastItem, DailyForecastItem, AirQualityData, WeatherAlertInfo } from '../types';

// WMO Weather interpretation codes (WW) in Italian
export function getWeatherDescription(code: number): { text: string; icon: string; isRain: boolean; isStorm: boolean } {
  switch (code) {
    case 0:
      return { text: 'Cielo Sereno', icon: 'Sun', isRain: false, isStorm: false };
    case 1:
      return { text: 'Prevalentemente Sereno', icon: 'SunMedium', isRain: false, isStorm: false };
    case 2:
      return { text: 'Parzialmente Nuvoloso', icon: 'CloudSun', isRain: false, isStorm: false };
    case 3:
      return { text: 'Coperto / Nuvoloso', icon: 'Cloud', isRain: false, isStorm: false };
    case 45:
      return { text: 'Nebbia', icon: 'CloudFog', isRain: false, isStorm: false };
    case 48:
      return { text: 'Nebbia con Brina', icon: 'CloudFog', isRain: false, isStorm: false };
    case 51:
      return { text: 'Pioviggine Leggera', icon: 'CloudDrizzle', isRain: true, isStorm: false };
    case 53:
      return { text: 'Pioviggine Moderata', icon: 'CloudDrizzle', isRain: true, isStorm: false };
    case 55:
      return { text: 'Pioviggine Densa', icon: 'CloudDrizzle', isRain: true, isStorm: false };
    case 61:
      return { text: 'Pioggia Leggera', icon: 'CloudRain', isRain: true, isStorm: false };
    case 63:
      return { text: 'Pioggia Moderata', icon: 'CloudRain', isRain: true, isStorm: false };
    case 65:
      return { text: 'Pioggia Forte', icon: 'CloudRainWind', isRain: true, isStorm: false };
    case 71:
      return { text: 'Neve Leggera', icon: 'CloudSnow', isRain: false, isStorm: false };
    case 73:
      return { text: 'Neve Moderata', icon: 'CloudSnow', isRain: false, isStorm: false };
    case 75:
      return { text: 'Neve Forte', icon: 'CloudSnow', isRain: false, isStorm: false };
    case 80:
      return { text: 'Rovesci di Pioggia Isolati', icon: 'CloudRain', isRain: true, isStorm: false };
    case 81:
      return { text: 'Rovesci di Pioggia Moderati', icon: 'CloudRain', isRain: true, isStorm: false };
    case 82:
      return { text: 'Nubifragio Violento', icon: 'CloudLightning', isRain: true, isStorm: true };
    case 95:
      return { text: 'Temporale con Lampi', icon: 'CloudLightning', isRain: true, isStorm: true };
    case 96:
      return { text: 'Temporale con Grandine Leggera', icon: 'CloudLightning', isRain: true, isStorm: true };
    case 99:
      return { text: 'Forte Temporale con Grandine', icon: 'CloudLightning', isRain: true, isStorm: true };
    default:
      return { text: 'Variabile', icon: 'CloudSun', isRain: false, isStorm: false };
  }
}

// Convert cardinal degrees to Italian direction abbreviation
export function getWindDirectionLabel(deg: number): string {
  const directions = [
    'N (Tramontana)', 'NNE', 'NE (Grecale)', 'ENE',
    'E (Levante)', 'ESE', 'SE (Scirocco)', 'SSE',
    'S (Ostro)', 'SSW', 'SW (Libeccio)', 'WSW',
    'W (Ponente)', 'WNW', 'NW (Maestrale)', 'NNW'
  ];
  const index = Math.round(deg / 22.5) % 16;
  return directions[index];
}

export function getBeaufortScale(kmh: number): { scale: number; description: string } {
  if (kmh < 1) return { scale: 0, description: 'Calma' };
  if (kmh <= 5) return { scale: 1, description: 'Bava di vento' };
  if (kmh <= 11) return { scale: 2, description: 'Brezza leggera' };
  if (kmh <= 19) return { scale: 3, description: 'Brezza tesa' };
  if (kmh <= 28) return { scale: 4, description: 'Vento moderato' };
  if (kmh <= 38) return { scale: 5, description: 'Vento teso' };
  if (kmh <= 49) return { scale: 6, description: 'Vento fresco' };
  if (kmh <= 61) return { scale: 7, description: 'Vento forte' };
  if (kmh <= 74) return { scale: 8, description: 'Burrasca' };
  if (kmh <= 88) return { scale: 9, description: 'Forte burrasca' };
  if (kmh <= 102) return { scale: 10, description: 'Tempesta' };
  if (kmh <= 117) return { scale: 11, description: 'Fortissima tempesta' };
  return { scale: 12, description: 'Uragano' };
}

// Default location: Roma, Italia
export const DEFAULT_LOCATION: LocationInfo = {
  name: 'Roma',
  country: 'Italia',
  admin1: 'Lazio',
  latitude: 41.8919,
  longitude: 12.5113,
  timezone: 'Europe/Rome'
};

export async function searchLocations(query: string): Promise<LocationInfo[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      query.trim()
    )}&count=6&language=it&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Geocoding search failed');
    const data = await res.json();
    if (!data.results) return [];

    return data.results.map((item: any) => ({
      name: item.name,
      country: item.country || '',
      admin1: item.admin1 || '',
      latitude: item.latitude,
      longitude: item.longitude,
      timezone: item.timezone || 'auto',
    }));
  } catch (err) {
    console.error('Error searching cities:', err);
    return [];
  }
}

export async function fetchAirQualityData(lat: number, lon: number): Promise<AirQualityData | undefined> {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone,uv_index`;
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const json = await res.json();
    const curr = json.current;
    if (!curr) return undefined;

    const eAqi = Math.round(curr.european_aqi || 35);
    let level: AirQualityData['aqiLevel'] = 'buona';
    let desc = 'Qualità dell\'aria favorevole per attività all\'aperto.';

    if (eAqi <= 20) {
      level = 'ottima';
      desc = 'Aria purissima ed eccellente, ideale per ogni tipo di attività all\'aperto.';
    } else if (eAqi <= 40) {
      level = 'buona';
      desc = 'Qualità dell\'aria soddisfacente, inquinamento atmosferico quasi assente.';
    } else if (eAqi <= 60) {
      level = 'moderata';
      desc = 'Qualità dell\'aria accettabile; soggetti sensibili potrebbero risentire di sforzi intensi.';
    } else if (eAqi <= 80) {
      level = 'scadente';
      desc = 'Concentrazione elevata di particolato fine. Si consiglia cautela a soggetti asmatici.';
    } else if (eAqi <= 100) {
      level = 'molto_scadente';
      desc = 'Inquinamento marcato. Limitare l\'attività fisica all\'aperto.';
    } else {
      level = 'pericolosa';
      desc = 'Allarme salute: evitare uscite prolungate e arieggiare i locali solo nelle ore serali.';
    }

    return {
      europeanAqi: eAqi,
      pm10: Math.round((curr.pm10 || 12) * 10) / 10,
      pm2_5: Math.round((curr.pm2_5 || 7) * 10) / 10,
      ozone: Math.round((curr.ozone || 85) * 10) / 10,
      nitrogenDioxide: Math.round((curr.nitrogen_dioxide || 10) * 10) / 10,
      carbonMonoxide: Math.round(curr.carbon_monoxide || 160),
      uvIndex: Math.round((curr.uv_index || 5) * 10) / 10,
      aqiLevel: level,
      aqiDescription: desc,
    };
  } catch (err) {
    console.warn('Air quality API error:', err);
    return undefined;
  }
}

export function evaluateWeatherAlerts(current: any, hourly: HourlyForecastItem[]): WeatherAlertInfo[] {
  const alerts: WeatherAlertInfo[] = [];
  const maxCape = Math.max(...hourly.slice(0, 12).map((h) => h.cape || 0), 0);
  const maxWind = current.wind_gusts_10m || current.wind_speed_10m || 0;
  const isStormCode = (current.weather_code >= 95 && current.weather_code <= 99) || current.weather_code === 82;

  // 1. Temporali e Grandine
  if (maxCape > 1200 || isStormCode) {
    alerts.push({
      id: 'alert-storm-1',
      level: maxCape > 2000 || current.weather_code === 99 ? 'orange' : 'yellow',
      title: 'Avviso di Criticità: Temporali Forti con Grandine',
      type: 'temporali',
      description: `Instabilità atmosferica marcata con energia convettiva CAPE a ${maxCape} J/kg. Possibili rovesci intensi, frequente attività elettrica e raffiche di downburst.`,
      issuer: 'Dipartimento Protezione Civile',
      validFrom: 'Oggi 12:00',
      validTo: 'Domani 06:00',
      instructions: 'Evitare soste sotto alberi isolati, cartelloni pubblicitari e strutture temporanee. Non sostare nei sottopassi.',
    });
  }

  // 2. Vento Forte
  if (maxWind >= 55) {
    alerts.push({
      id: 'alert-wind-1',
      level: maxWind >= 80 ? 'orange' : 'yellow',
      title: 'Allerta Vento: Raffiche Turbolente',
      type: 'vento',
      description: `Previste raffiche di vento fino a ${Math.round(maxWind)} km/h. Moto ondoso in sensibile aumento lungo le coste esposte.`,
      issuer: 'Centro Funzionale Meteo Regionale',
      validFrom: 'Oggi 08:00',
      validTo: 'Oggi 22:00',
      instructions: 'Assicurare vasi e oggetti su balconi e terrazzi. Cautela alla guida di furgoni e veicoli telonati.',
    });
  }

  // 3. Ondate di Calore / Temperature Estreme
  if (current.temperature_2m >= 35) {
    alerts.push({
      id: 'alert-heat-1',
      level: current.temperature_2m >= 38 ? 'red' : 'orange',
      title: 'Allerta Calore Livello 3 (Ondata di Calore)',
      type: 'calore',
      description: `Temperature massime oltre ${Math.round(current.temperature_2m)}°C con tasso di umidità elevato e disagio bioclimatico persistente.`,
      issuer: 'Ministero della Salute / Protezione Civile',
      validFrom: 'Oggi 11:00',
      validTo: 'Oggi 18:00',
      instructions: 'Evitare l\'esposizione al sole nelle ore centrali. Idratarsi frequentemente ed evitare bevande alcoliche.',
    });
  }

  // 4. Se non ci sono allerte attive, segnalazione stato verde di vigilanza
  if (alerts.length === 0) {
    alerts.push({
      id: 'alert-green-ok',
      level: 'green',
      title: 'Condizioni Regolari: Nessuna Criticità in Corso',
      type: 'idrogeologico',
      description: 'Bollettino di vigilanza meteorologica ordinario. Non si segnalano fenomeni convettivi intensi né criticità idrauliche o idrogeologiche significative.',
      issuer: 'Rete Nazionale di Monitoraggio',
      validFrom: 'Oggi',
      validTo: 'Nelle prossime 24 ore',
      instructions: 'Nessuna misura precauzionale attiva richiesta. Condizioni ideali.',
    });
  }

  return alerts;
}

export async function fetchWeatherData(location: LocationInfo): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,is_day&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,cape,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant,uv_index_max&timezone=auto`;

  // Fetch meteo and air quality in parallel
  const [res, airQuality] = await Promise.all([
    fetch(url),
    fetchAirQualityData(location.latitude, location.longitude),
  ]);

  if (!res.ok) {
    throw new Error(`Meteo API error: ${res.statusText}`);
  }
  const data = await res.json();

  const current = data.current;
  const hourly = data.hourly;
  const daily = data.daily;

  // Format hourly next 24h
  const now = new Date();
  const currentHourISO = now.toISOString().slice(0, 13);
  let startIndex = hourly.time.findIndex((t: string) => t.startsWith(currentHourISO));
  if (startIndex === -1) startIndex = 0;

  const formattedHourly: HourlyForecastItem[] = [];
  for (let i = startIndex; i < Math.min(startIndex + 24, hourly.time.length); i++) {
    const timeStr = hourly.time[i];
    const hourDate = new Date(timeStr);
    const code = hourly.weather_code[i] || 0;
    formattedHourly.push({
      time: timeStr,
      hourLabel: `${hourDate.getHours().toString().padStart(2, '0')}:00`,
      temperature: Math.round(hourly.temperature_2m[i] * 10) / 10,
      humidity: Math.round(hourly.relative_humidity_2m[i]),
      windSpeed: Math.round(hourly.wind_speed_10m[i]),
      windDirection: Math.round(hourly.wind_direction_10m[i] || 0),
      precipitationProbability: hourly.precipitation_probability[i] || 0,
      weatherCode: code,
      weatherDescription: getWeatherDescription(code).text,
      cape: Math.round(hourly.cape?.[i] || 0),
    });
  }

  // Format daily 7 days
  const formattedDaily: DailyForecastItem[] = [];
  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  for (let i = 0; i < Math.min(7, daily.time.length); i++) {
    const dayDate = new Date(daily.time[i]);
    const code = daily.weather_code[i] || 0;
    const isToday = i === 0;
    formattedDaily.push({
      date: daily.time[i],
      dayLabel: isToday ? 'Oggi' : daysOfWeek[dayDate.getDay()],
      maxTemp: Math.round(daily.temperature_2m_max[i]),
      minTemp: Math.round(daily.temperature_2m_min[i]),
      weatherCode: code,
      weatherDescription: getWeatherDescription(code).text,
      precipitationProbability: daily.precipitation_probability_max[i] || 0,
      maxWindSpeed: Math.round(daily.wind_speed_10m_max[i] || 0),
      dominantWindDirection: Math.round(daily.wind_direction_10m_dominant[i] || 0),
      uvMax: Math.round(daily.uv_index_max?.[i] || 5),
    });
  }

  const currentWeatherDesc = getWeatherDescription(current.weather_code || 0);

  // Approximate dew point using Magnus formula
  const temp = current.temperature_2m;
  const rh = current.relative_humidity_2m;
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * temp) / (b + temp) + Math.log(rh / 100);
  const dewPoint = Math.round(((b * alpha) / (a - alpha)) * 10) / 10;

  const alerts = evaluateWeatherAlerts(current, formattedHourly);

  return {
    location,
    current: {
      temperature: Math.round(current.temperature_2m * 10) / 10,
      apparentTemperature: Math.round(current.apparent_temperature * 10) / 10,
      relativeHumidity: Math.round(current.relative_humidity_2m),
      dewPoint,
      pressure: Math.round(current.surface_pressure || 1013),
      windSpeed: Math.round(current.wind_speed_10m),
      windDirection: Math.round(current.wind_direction_10m || 0),
      windGusts: Math.round(current.wind_gusts_10m || current.wind_speed_10m * 1.3),
      weatherCode: current.weather_code || 0,
      weatherDescription: currentWeatherDesc.text,
      isDay: current.is_day === 1,
      precipitation: current.precipitation || 0,
      uvIndex: airQuality?.uvIndex ?? (formattedHourly[0]?.cape ? Math.min(11, Math.round(formattedHourly[0].cape / 200)) : 5),
      cloudCover: current.cloud_cover || 20,
      visibility: 10, // km
    },
    hourly: formattedHourly,
    daily: formattedDaily,
    airQuality,
    alerts,
    lastUpdated: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}

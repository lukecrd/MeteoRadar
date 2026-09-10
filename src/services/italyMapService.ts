import { ItalyStationWeather } from '../types';
import { getWeatherDescription } from './weatherApi';

export interface RainViewerData {
  host: string;
  radar: {
    past: Array<{ time: number; path: string }>;
    nowcast: Array<{ time: number; path: string }>;
  };
  satellite: {
    infrared: Array<{ time: number; path: string }>;
  };
}

export interface ItalyRegionInfo {
  id: string; // 'all' or exact region name like 'Lazio', 'Lombardia', etc.
  name: string;
  macroArea: 'Nazionale' | 'Nord' | 'Centro' | 'Sud' | 'Isole';
  center: [number, number]; // [lat, lon]
  zoom: number;
  description: string;
}

export const ITALY_REGIONS: ItalyRegionInfo[] = [
  { id: 'all', name: 'Tutte le 20 Regioni (Nazionale)', macroArea: 'Nazionale', center: [42.4, 12.8], zoom: 6, description: 'Copertura panoramica dell\'intera penisola italiana' },
  { id: 'Abruzzo', name: 'Abruzzo', macroArea: 'Centro', center: [42.35, 13.70], zoom: 9, description: 'Massicci del Gran Sasso e Majella, costa adriatica' },
  { id: 'Basilicata', name: 'Basilicata', macroArea: 'Sud', center: [40.50, 16.10], zoom: 9, description: 'Appennino lucano, Mar Tirreno e Golfo di Taranto' },
  { id: 'Calabria', name: 'Calabria', macroArea: 'Sud', center: [39.00, 16.45], zoom: 8.5, description: 'Sila, Aspromonte, bacini tirrenico e ionico' },
  { id: 'Campania', name: 'Campania', macroArea: 'Sud', center: [40.90, 14.80], zoom: 8.5, description: 'Golfo di Napoli, Cilento e Appennino campano' },
  { id: 'Emilia-Romagna', name: 'Emilia-Romagna', macroArea: 'Nord', center: [44.50, 11.30], zoom: 8.5, description: 'Pianura Padana, dorsale appenninica e Riviera Romagnola' },
  { id: 'Friuli-Venezia Giulia', name: 'Friuli-Venezia Giulia', macroArea: 'Nord', center: [46.10, 13.00], zoom: 9, description: 'Alpi Carniche e Giulie, Carso, Golfo di Trieste' },
  { id: 'Lazio', name: 'Lazio', macroArea: 'Centro', center: [41.90, 12.70], zoom: 8.5, description: 'Agro Romano, litorale tirrenico e monti reatini/ciociari' },
  { id: 'Liguria', name: 'Liguria', macroArea: 'Nord', center: [44.30, 8.80], zoom: 9, description: 'Arco ligure, Riviera di Ponente e Levante' },
  { id: 'Lombardia', name: 'Lombardia', macroArea: 'Nord', center: [45.60, 9.80], zoom: 8.5, description: 'Laghi prealpini, Alpi Retiche e pianura lombarda' },
  { id: 'Marche', name: 'Marche', macroArea: 'Centro', center: [43.40, 13.20], zoom: 9, description: 'Monti Sibillini, Conero e fascia collinare adriatica' },
  { id: 'Molise', name: 'Molise', macroArea: 'Sud', center: [41.65, 14.60], zoom: 9.5, description: 'Massiccio del Matese e costa di Termoli' },
  { id: 'Piemonte', name: 'Piemonte', macroArea: 'Nord', center: [45.10, 7.90], zoom: 8.5, description: 'Arco alpino occidentale, Monferrato e Langhe' },
  { id: 'Puglia', name: 'Puglia', macroArea: 'Sud', center: [41.00, 16.70], zoom: 8, description: 'Gargano, Murge, Valle d\'Itria e Salento' },
  { id: 'Sardegna', name: 'Sardegna', macroArea: 'Isole', center: [40.05, 9.10], zoom: 8, description: 'Gennargentu, coste del Tirreno e del Mare di Sardegna' },
  { id: 'Sicilia', name: 'Sicilia', macroArea: 'Isole', center: [37.60, 14.20], zoom: 8, description: 'Etna, Madonie, Nebrodi e canali marittimi' },
  { id: 'Toscana', name: 'Toscana', macroArea: 'Centro', center: [43.40, 11.20], zoom: 8.5, description: 'Appennino tosco-emiliano, colline del Chianti, Maremma' },
  { id: 'Trentino-Alto Adige', name: 'Trentino-Alto Adige', macroArea: 'Nord', center: [46.40, 11.35], zoom: 8.5, description: 'Dolomiti, Val d\'Adige, Alpi Venoste e Aurine' },
  { id: 'Umbria', name: 'Umbria', macroArea: 'Centro', center: [42.95, 12.55], zoom: 9, description: 'Lago Trasimeno, Valnerina e valli umbre' },
  { id: 'Valle d\'Aosta', name: "Valle d'Aosta", macroArea: 'Nord', center: [45.74, 7.35], zoom: 9.5, description: 'Massicci del Monte Bianco, Cervino e Gran Paradiso' },
  { id: 'Veneto', name: 'Veneto', macroArea: 'Nord', center: [45.65, 11.90], zoom: 8.5, description: 'Dolomiti bellunesi, Prealpi, Laguna Veneta e Polesine' }
];

export const ITALIAN_CITIES: Array<{
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  isPrimaryCapital?: boolean;
}> = [
  // Abruzzo
  { id: 'laquila', name: "L'Aquila", region: 'Abruzzo', lat: 42.3498, lon: 13.3995, isPrimaryCapital: true },
  { id: 'pescara', name: 'Pescara', region: 'Abruzzo', lat: 42.4618, lon: 14.2161 },
  { id: 'chieti', name: 'Chieti', region: 'Abruzzo', lat: 42.3510, lon: 14.1675 },
  { id: 'teramo', name: 'Teramo', region: 'Abruzzo', lat: 42.6589, lon: 13.7044 },

  // Basilicata
  { id: 'potenza', name: 'Potenza', region: 'Basilicata', lat: 40.6404, lon: 15.8056, isPrimaryCapital: true },
  { id: 'matera', name: 'Matera', region: 'Basilicata', lat: 40.6664, lon: 16.6043 },

  // Calabria
  { id: 'catanzaro', name: 'Catanzaro', region: 'Calabria', lat: 38.9098, lon: 16.5877, isPrimaryCapital: true },
  { id: 'reggiocalabria', name: 'Reggio Calabria', region: 'Calabria', lat: 38.1113, lon: 15.6473 },
  { id: 'cosenza', name: 'Cosenza', region: 'Calabria', lat: 39.2983, lon: 16.2537 },
  { id: 'crotone', name: 'Crotone', region: 'Calabria', lat: 39.0808, lon: 17.1274 },
  { id: 'vibovalentia', name: 'Vibo Valentia', region: 'Calabria', lat: 38.6756, lon: 16.1011 },

  // Campania
  { id: 'napoli', name: 'Napoli', region: 'Campania', lat: 40.8518, lon: 14.2681, isPrimaryCapital: true },
  { id: 'salerno', name: 'Salerno', region: 'Campania', lat: 40.6824, lon: 14.7681 },
  { id: 'caserta', name: 'Caserta', region: 'Campania', lat: 41.0743, lon: 14.3323 },
  { id: 'avellino', name: 'Avellino', region: 'Campania', lat: 40.9144, lon: 14.7906 },
  { id: 'benevento', name: 'Benevento', region: 'Campania', lat: 41.1299, lon: 14.7826 },

  // Emilia-Romagna
  { id: 'bologna', name: 'Bologna', region: 'Emilia-Romagna', lat: 44.4949, lon: 11.3426, isPrimaryCapital: true },
  { id: 'parma', name: 'Parma', region: 'Emilia-Romagna', lat: 44.8015, lon: 10.3279 },
  { id: 'modena', name: 'Modena', region: 'Emilia-Romagna', lat: 44.6471, lon: 10.9252 },
  { id: 'ravenna', name: 'Ravenna', region: 'Emilia-Romagna', lat: 44.4184, lon: 12.2035 },
  { id: 'rimini', name: 'Rimini', region: 'Emilia-Romagna', lat: 44.0678, lon: 12.5695 },
  { id: 'ferrara', name: 'Ferrara', region: 'Emilia-Romagna', lat: 44.8381, lon: 11.6198 },
  { id: 'reggioemilia', name: 'Reggio Emilia', region: 'Emilia-Romagna', lat: 44.6983, lon: 10.6312 },
  { id: 'piacenza', name: 'Piacenza', region: 'Emilia-Romagna', lat: 45.0526, lon: 9.6929 },
  { id: 'forli', name: 'Forlì', region: 'Emilia-Romagna', lat: 44.2227, lon: 12.0407 },

  // Friuli-Venezia Giulia
  { id: 'trieste', name: 'Trieste', region: 'Friuli-Venezia Giulia', lat: 45.6495, lon: 13.7768, isPrimaryCapital: true },
  { id: 'udine', name: 'Udine', region: 'Friuli-Venezia Giulia', lat: 46.0626, lon: 13.2346 },
  { id: 'pordenone', name: 'Pordenone', region: 'Friuli-Venezia Giulia', lat: 45.9569, lon: 12.6605 },
  { id: 'gorizia', name: 'Gorizia', region: 'Friuli-Venezia Giulia', lat: 45.9402, lon: 13.6217 },

  // Lazio
  { id: 'roma', name: 'Roma', region: 'Lazio', lat: 41.9028, lon: 12.4964, isPrimaryCapital: true },
  { id: 'latina', name: 'Latina', region: 'Lazio', lat: 41.4676, lon: 12.9037 },
  { id: 'frosinone', name: 'Frosinone', region: 'Lazio', lat: 41.6400, lon: 13.3500 },
  { id: 'viterbo', name: 'Viterbo', region: 'Lazio', lat: 42.4174, lon: 12.1047 },
  { id: 'rieti', name: 'Rieti', region: 'Lazio', lat: 42.4041, lon: 12.8631 },
  { id: 'civitavecchia', name: 'Civitavecchia', region: 'Lazio', lat: 42.0924, lon: 11.7954 },

  // Liguria
  { id: 'genova', name: 'Genova', region: 'Liguria', lat: 44.4056, lon: 8.9463, isPrimaryCapital: true },
  { id: 'laspezia', name: 'La Spezia', region: 'Liguria', lat: 44.1105, lon: 9.8434 },
  { id: 'savona', name: 'Savona', region: 'Liguria', lat: 44.3079, lon: 8.4810 },
  { id: 'imperia', name: 'Imperia', region: 'Liguria', lat: 43.8861, lon: 8.0267 },
  { id: 'sanremo', name: 'Sanremo', region: 'Liguria', lat: 43.8159, lon: 7.7761 },

  // Lombardia
  { id: 'milano', name: 'Milano', region: 'Lombardia', lat: 45.4642, lon: 9.1900, isPrimaryCapital: true },
  { id: 'brescia', name: 'Brescia', region: 'Lombardia', lat: 45.5416, lon: 10.2118 },
  { id: 'bergamo', name: 'Bergamo', region: 'Lombardia', lat: 45.6983, lon: 9.6773 },
  { id: 'monza', name: 'Monza', region: 'Lombardia', lat: 45.5845, lon: 9.2744 },
  { id: 'como', name: 'Como', region: 'Lombardia', lat: 45.8081, lon: 9.0852 },
  { id: 'varese', name: 'Varese', region: 'Lombardia', lat: 45.8206, lon: 8.8251 },
  { id: 'pavia', name: 'Pavia', region: 'Lombardia', lat: 45.1847, lon: 9.1582 },
  { id: 'cremona', name: 'Cremona', region: 'Lombardia', lat: 45.1332, lon: 10.0249 },
  { id: 'mantova', name: 'Mantova', region: 'Lombardia', lat: 45.1564, lon: 10.7914 },
  { id: 'lecco', name: 'Lecco', region: 'Lombardia', lat: 45.8566, lon: 9.3977 },
  { id: 'lodi', name: 'Lodi', region: 'Lombardia', lat: 45.3139, lon: 9.5032 },
  { id: 'sondrio', name: 'Sondrio', region: 'Lombardia', lat: 46.1712, lon: 9.8728 },

  // Marche
  { id: 'ancona', name: 'Ancona', region: 'Marche', lat: 43.6158, lon: 13.5189, isPrimaryCapital: true },
  { id: 'pesaro', name: 'Pesaro', region: 'Marche', lat: 43.9102, lon: 12.9133 },
  { id: 'macerata', name: 'Macerata', region: 'Marche', lat: 43.3002, lon: 13.4531 },
  { id: 'ascolipiceno', name: 'Ascoli Piceno', region: 'Marche', lat: 42.8546, lon: 13.5759 },
  { id: 'fermo', name: 'Fermo', region: 'Marche', lat: 43.1614, lon: 13.7180 },

  // Molise
  { id: 'campobasso', name: 'Campobasso', region: 'Molise', lat: 41.5603, lon: 14.6627, isPrimaryCapital: true },
  { id: 'isernia', name: 'Isernia', region: 'Molise', lat: 41.5969, lon: 14.2341 },
  { id: 'termoli', name: 'Termoli', region: 'Molise', lat: 41.9996, lon: 14.9967 },

  // Piemonte
  { id: 'torino', name: 'Torino', region: 'Piemonte', lat: 45.0703, lon: 7.6869, isPrimaryCapital: true },
  { id: 'novara', name: 'Novara', region: 'Piemonte', lat: 45.4469, lon: 8.6212 },
  { id: 'alessandria', name: 'Alessandria', region: 'Piemonte', lat: 44.9129, lon: 8.6154 },
  { id: 'asti', name: 'Asti', region: 'Piemonte', lat: 44.9007, lon: 8.2069 },
  { id: 'cuneo', name: 'Cuneo', region: 'Piemonte', lat: 44.3845, lon: 7.5427 },
  { id: 'biella', name: 'Biella', region: 'Piemonte', lat: 45.5629, lon: 8.0583 },
  { id: 'vercelli', name: 'Vercelli', region: 'Piemonte', lat: 45.3228, lon: 8.4199 },
  { id: 'verbania', name: 'Verbania', region: 'Piemonte', lat: 45.9221, lon: 8.5516 },

  // Puglia
  { id: 'bari', name: 'Bari', region: 'Puglia', lat: 41.1171, lon: 16.8719, isPrimaryCapital: true },
  { id: 'lecce', name: 'Lecce', region: 'Puglia', lat: 40.3548, lon: 18.1725 },
  { id: 'taranto', name: 'Taranto', region: 'Puglia', lat: 40.4644, lon: 17.2470 },
  { id: 'foggia', name: 'Foggia', region: 'Puglia', lat: 41.4622, lon: 15.5447 },
  { id: 'brindisi', name: 'Brindisi', region: 'Puglia', lat: 40.6327, lon: 17.9418 },
  { id: 'barletta', name: 'Barletta', region: 'Puglia', lat: 41.3197, lon: 16.2828 },

  // Sardegna
  { id: 'cagliari', name: 'Cagliari', region: 'Sardegna', lat: 39.2238, lon: 9.1217, isPrimaryCapital: true },
  { id: 'sassari', name: 'Sassari', region: 'Sardegna', lat: 40.7259, lon: 8.5556 },
  { id: 'olbia', name: 'Olbia', region: 'Sardegna', lat: 40.9238, lon: 9.4975 },
  { id: 'nuoro', name: 'Nuoro', region: 'Sardegna', lat: 40.3208, lon: 9.3297 },
  { id: 'oristano', name: 'Oristano', region: 'Sardegna', lat: 39.9064, lon: 8.5925 },

  // Sicilia
  { id: 'palermo', name: 'Palermo', region: 'Sicilia', lat: 38.1157, lon: 13.3615, isPrimaryCapital: true },
  { id: 'catania', name: 'Catania', region: 'Sicilia', lat: 37.5079, lon: 15.0873 },
  { id: 'messina', name: 'Messina', region: 'Sicilia', lat: 38.1938, lon: 15.5540 },
  { id: 'siracusa', name: 'Siracusa', region: 'Sicilia', lat: 37.0755, lon: 15.2866 },
  { id: 'trapani', name: 'Trapani', region: 'Sicilia', lat: 38.0176, lon: 12.5365 },
  { id: 'agrigento', name: 'Agrigento', region: 'Sicilia', lat: 37.3110, lon: 13.5765 },
  { id: 'ragusa', name: 'Ragusa', region: 'Sicilia', lat: 36.9269, lon: 14.7307 },
  { id: 'caltanissetta', name: 'Caltanissetta', region: 'Sicilia', lat: 37.4901, lon: 14.0625 },
  { id: 'enna', name: 'Enna', region: 'Sicilia', lat: 37.5676, lon: 14.2796 },

  // Toscana
  { id: 'firenze', name: 'Firenze', region: 'Toscana', lat: 43.7696, lon: 11.2558, isPrimaryCapital: true },
  { id: 'pisa', name: 'Pisa', region: 'Toscana', lat: 43.7228, lon: 10.4017 },
  { id: 'livorno', name: 'Livorno', region: 'Toscana', lat: 43.5485, lon: 10.3106 },
  { id: 'siena', name: 'Siena', region: 'Toscana', lat: 43.3188, lon: 11.3308 },
  { id: 'arezzo', name: 'Arezzo', region: 'Toscana', lat: 43.4633, lon: 11.8796 },
  { id: 'lucca', name: 'Lucca', region: 'Toscana', lat: 43.8430, lon: 10.5079 },
  { id: 'pistoia', name: 'Pistoia', region: 'Toscana', lat: 43.9333, lon: 10.9167 },
  { id: 'grosseto', name: 'Grosseto', region: 'Toscana', lat: 42.7635, lon: 11.1118 },
  { id: 'massa', name: 'Massa', region: 'Toscana', lat: 44.0354, lon: 10.1417 },

  // Trentino-Alto Adige
  { id: 'trento', name: 'Trento', region: 'Trentino-Alto Adige', lat: 46.0748, lon: 11.1217, isPrimaryCapital: true },
  { id: 'bolzano', name: 'Bolzano', region: 'Trentino-Alto Adige', lat: 46.4983, lon: 11.3548 },
  { id: 'rovereto', name: 'Rovereto', region: 'Trentino-Alto Adige', lat: 45.8906, lon: 11.0401 },
  { id: 'merano', name: 'Merano', region: 'Trentino-Alto Adige', lat: 46.6713, lon: 11.1594 },
  { id: 'bressanone', name: 'Bressanone', region: 'Trentino-Alto Adige', lat: 46.7167, lon: 11.6558 },

  // Umbria
  { id: 'perugia', name: 'Perugia', region: 'Umbria', lat: 43.1107, lon: 12.3908, isPrimaryCapital: true },
  { id: 'terni', name: 'Terni', region: 'Umbria', lat: 42.5641, lon: 12.6453 },
  { id: 'foligno', name: 'Foligno', region: 'Umbria', lat: 42.9559, lon: 12.7038 },
  { id: 'spoleto', name: 'Spoleto', region: 'Umbria', lat: 42.7346, lon: 12.7368 },

  // Valle d'Aosta
  { id: 'aosta', name: 'Aosta', region: "Valle d'Aosta", lat: 45.7370, lon: 7.3201, isPrimaryCapital: true },
  { id: 'courmayeur', name: 'Courmayeur', region: "Valle d'Aosta", lat: 45.7969, lon: 6.9691 },
  { id: 'saintvincent', name: 'Saint-Vincent', region: "Valle d'Aosta", lat: 45.7508, lon: 7.6496 },

  // Veneto
  { id: 'venezia', name: 'Venezia', region: 'Veneto', lat: 45.4408, lon: 12.3155, isPrimaryCapital: true },
  { id: 'verona', name: 'Verona', region: 'Veneto', lat: 45.4384, lon: 10.9916 },
  { id: 'padova', name: 'Padova', region: 'Veneto', lat: 45.4064, lon: 11.8768 },
  { id: 'vicenza', name: 'Vicenza', region: 'Veneto', lat: 45.5455, lon: 11.5354 },
  { id: 'treviso', name: 'Treviso', region: 'Veneto', lat: 45.6669, lon: 12.2430 },
  { id: 'belluno', name: 'Belluno', region: 'Veneto', lat: 46.1425, lon: 12.2167 },
  { id: 'rovigo', name: 'Rovigo', region: 'Veneto', lat: 45.0708, lon: 11.7904 }
];

export async function fetchRainViewerMaps(): Promise<RainViewerData | null> {
  try {
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    if (!res.ok) throw new Error('Failed to fetch RainViewer map data');
    const data = await res.json();
    return data as RainViewerData;
  } catch (err) {
    console.warn('RainViewer API notice:', err);
    return null;
  }
}

export function classifyPhenomenon(weatherCode: number, precipitation: number): 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'snow' {
  if (weatherCode >= 95) return 'storm';
  if (weatherCode >= 80 && weatherCode <= 82) return 'storm';
  if ((weatherCode >= 51 && weatherCode <= 67) || precipitation > 0.2) return 'rain';
  if (weatherCode >= 71 && weatherCode <= 77) return 'snow';
  if (weatherCode === 45 || weatherCode === 48) return 'fog';
  if (weatherCode === 0 || weatherCode === 1) return 'clear';
  return 'cloudy';
}

export function determineAlertLevel(phenomenon: string, windSpeed: number, precipitation: number): 'green' | 'yellow' | 'orange' | 'red' {
  if (phenomenon === 'storm' && (windSpeed > 60 || precipitation > 20)) return 'red';
  if (phenomenon === 'storm' || windSpeed > 55 || precipitation > 10) return 'orange';
  if (phenomenon === 'rain' || windSpeed > 35 || phenomenon === 'fog' || phenomenon === 'snow') return 'yellow';
  return 'green';
}

export async function fetchItalianStationsWeather(): Promise<ItalyStationWeather[]> {
  const lats = ITALIAN_CITIES.map((c) => c.lat).join(',');
  const lons = ITALIAN_CITIES.map((c) => c.lon).join(',');

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation,surface_pressure&timezone=Europe%2FRome`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Open-Meteo multi-location fetch failed');
    const data = await res.json();

    const resultsArray = Array.isArray(data) ? data : [data];

    return ITALIAN_CITIES.map((city, idx) => {
      const entry = resultsArray[idx]?.current;
      const temp = entry ? Math.round(entry.temperature_2m) : 18;
      const humidity = entry ? Math.round(entry.relative_humidity_2m) : 65;
      const code = entry ? entry.weather_code : 1;
      const windSpeed = entry ? Math.round(entry.wind_speed_10m) : 12;
      const windDirection = entry ? Math.round(entry.wind_direction_10m) : 180;
      const precipitation = entry ? entry.precipitation : 0;
      const pressure = entry ? Math.round(entry.surface_pressure) : 1013;

      const phenomenon = classifyPhenomenon(code, precipitation);
      const alertLevel = determineAlertLevel(phenomenon, windSpeed, precipitation);

      return {
        id: city.id,
        name: city.name,
        region: city.region,
        latitude: city.lat,
        longitude: city.lon,
        temperature: temp,
        humidity,
        weatherCode: code,
        weatherDescription: getWeatherDescription(code).text,
        windSpeed,
        windDirection,
        precipitation,
        pressure,
        phenomenon,
        alertLevel,
      };
    });
  } catch (err) {
    console.error('Error fetching Italian stations weather:', err);
    // Fallback baseline for Italian stations
    return ITALIAN_CITIES.map((city) => ({
      id: city.id,
      name: city.name,
      region: city.region,
      latitude: city.lat,
      longitude: city.lon,
      temperature: 20,
      humidity: 60,
      weatherCode: 1,
      weatherDescription: 'Sereno o poco nuvoloso',
      windSpeed: 14,
      windDirection: 210,
      precipitation: 0,
      pressure: 1015,
      phenomenon: 'clear',
      alertLevel: 'green',
    }));
  }
}

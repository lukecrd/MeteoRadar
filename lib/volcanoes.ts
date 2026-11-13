// Real-time Volcano Observatory & Seismic Swarm Cross-Analysis (INGV + USGS + GDACS + Smithsonian GVP)
import { getQuakes } from './quakes.js';
import { getDisasters, FeedResponse } from './worldEvents.js';

export type VolcanoStatus = 'erupting' | 'unrest' | 'advisory' | 'normal';
export type VolcanoAlertColor = 'red' | 'orange' | 'yellow' | 'green';

export interface VolcanoQuakeRef {
  id: string;
  mag: number;
  depthKm: number;
  place: string;
  time: number;
  distanceKm: number;
}

export interface Volcano {
  id: string;
  name: string;
  country: string;
  region: string;
  lat: number;
  lon: number;
  elevationM: number;
  type: 'Stratovulcano' | 'Caldera' | 'Vulcano a scudo' | 'Complesso vulcanico' | 'Vulcano sottomarino';
  agency: string;
  status: VolcanoStatus;
  alertColor: VolcanoAlertColor;
  lastEruption: string;
  magmaType: string;
  activitySummary: string;
  seismicCount7d: number;
  maxMag7d: number | null;
  shallowestDepthKm: number | null;
  nearbyQuakes: VolcanoQuakeRef[];
  url: string;
}

interface BaseVolcano {
  id: string;
  name: string;
  country: string;
  region: string;
  lat: number;
  lon: number;
  elevationM: number;
  type: Volcano['type'];
  agency: string;
  baseStatus: VolcanoStatus;
  baseAlert: VolcanoAlertColor;
  lastEruption: string;
  magmaType: string;
  activitySummary: string;
  url: string;
}

const VOLCANO_CATALOG: BaseVolcano[] = [
  // --- ITALIA (INGV Osservatorio Etneo / Osservatorio Vesuviano) ---
  {
    id: 'etna',
    name: 'Monte Etna',
    country: 'Italia',
    region: 'Sicilia · Catania',
    lat: 37.748,
    lon: 14.999,
    elevationM: 3357,
    type: 'Stratovulcano',
    agency: 'INGV Osservatorio Etneo',
    baseStatus: 'erupting',
    baseAlert: 'orange',
    lastEruption: 'In corso (attività stromboliana ed effusiva)',
    magmaType: 'Trachibasaltico',
    activitySummary: 'Degassamento persistente dai crateri sommitali (Voragine, Bocca Nuova, Cratere di SE) con fasi stromboliane, parossismi e tremore vulcanico monitorato 24/7 da INGV.',
    url: 'https://www.ct.ingv.it/',
  },
  {
    id: 'stromboli',
    name: 'Stromboli',
    country: 'Italia',
    region: 'Isole Eolie · Sicilia',
    lat: 38.789,
    lon: 15.213,
    elevationM: 924,
    type: 'Stratovulcano',
    agency: 'INGV Osservatorio Etneo / Vesuviano',
    baseStatus: 'erupting',
    baseAlert: 'orange',
    lastEruption: 'In corso (attività stromboliana persistente)',
    magmaType: 'Basaltico shoshonitico',
    activitySummary: 'Attività esplosiva stromboliana ordinaria ai crateri della terrazza craterica sopra la Sciara del Fuoco, con occasionale trabocco lavico.',
    url: 'https://www.ct.ingv.it/',
  },
  {
    id: 'campi-flegrei',
    name: 'Campi Flegrei',
    country: 'Italia',
    region: 'Campania · Pozzuoli / Napoli',
    lat: 40.827,
    lon: 14.139,
    elevationM: 458,
    type: 'Caldera',
    agency: 'INGV Osservatorio Vesuviano',
    baseStatus: 'unrest',
    baseAlert: 'yellow',
    lastEruption: '1538 (Monte Nuovo) · Crisi bradisismica attiva',
    magmaType: 'Trachitico / Fonolitico',
    activitySummary: 'Sollevamento bradisismico del suolo centrato nell’area di Rione Terra/Solfatara accompagnato da sciami sismici superficiali (0.5–4 km) e intenso degassamento idrotermale a Pisciarelli.',
    url: 'https://www.ov.ingv.it/',
  },
  {
    id: 'vulcano-eolie',
    name: 'Vulcano (La Fossa)',
    country: 'Italia',
    region: 'Isole Eolie · Sicilia',
    lat: 38.404,
    lon: 14.962,
    elevationM: 500,
    type: 'Stratovulcano',
    agency: 'INGV Sezione di Palermo / Catania',
    baseStatus: 'advisory',
    baseAlert: 'yellow',
    lastEruption: '1888–1890',
    magmaType: 'Riolitico / Trachitico',
    activitySummary: 'Anomalie termiche e degassamento fumarolico ad alta temperatura lungo l’orlo craterico della Fossa e nell’area di Levante.',
    url: 'https://www.ingv.it/',
  },
  {
    id: 'vesuvio',
    name: 'Somma-Vesuvio',
    country: 'Italia',
    region: 'Campania · Golfo di Napoli',
    lat: 40.821,
    lon: 14.426,
    elevationM: 1281,
    type: 'Stratovulcano',
    agency: 'INGV Osservatorio Vesuviano',
    baseStatus: 'normal',
    baseAlert: 'green',
    lastEruption: 'Marzo 1944',
    magmaType: ' Tefritico-Fonolitico',
    activitySummary: 'Stato di quiescenza attiva con micro-sismicità locale al di sotto del Gran Cono e deboli emissioni fumaroliche intracrateriche.',
    url: 'https://www.ov.ingv.it/',
  },
  {
    id: 'marsili',
    name: 'Vulcano Sottomarino Marsili',
    country: 'Italia',
    region: 'Mar Tirreno Meridionale',
    lat: 39.28,
    lon: 14.40,
    elevationM: -450,
    type: 'Vulcano sottomarino',
    agency: 'INGV Roma',
    baseStatus: 'advisory',
    baseAlert: 'yellow',
    lastEruption: 'Olocene · Idrotermalismo attivo',
    magmaType: 'Calcalcalino / Basaltico',
    activitySummary: 'Il più esteso edificio vulcanico sottomarino europeo (70 km di lunghezza). Attività idrotermale sulla sommità a 450 m sotto il livello del mare e microsismicità tirrenica.',
    url: 'https://www.ingv.it/',
  },

  // --- EUROPA & ATLANTICO ---
  {
    id: 'reykjanes',
    name: 'Reykjanes / Sundhnúkur',
    country: 'Islanda',
    region: 'Penisola di Reykjanes · Grindavík',
    lat: 63.88,
    lon: -22.39,
    elevationM: 340,
    type: 'Complesso vulcanico',
    agency: 'IMO Icelandic Met Office',
    baseStatus: 'erupting',
    baseAlert: 'red',
    lastEruption: '2023–2026 (eruzioni fissurali ricorrenti)',
    magmaType: 'Basaltico toleitico',
    activitySummary: 'Accumulo continuo di magma nel serbatoio di Svartsengi con cicli di intrusioni dicchiformi ed eruzioni fissurali effusive lungo la catena craterica di Sundhnúksgígar.',
    url: 'https://en.vedur.is/earthquakes-and-volcanism/volcanic-eruptions/',
  },
  {
    id: 'santorini',
    name: 'Santorini (Nea Kameni & Kolumbo)',
    country: 'Grecia',
    region: 'Arco Egeo Meridionale',
    lat: 36.404,
    lon: 25.396,
    elevationM: 367,
    type: 'Caldera',
    agency: 'NOA / Osservatorio Atene',
    baseStatus: 'advisory',
    baseAlert: 'yellow',
    lastEruption: '1950',
    magmaType: 'Dacitico / Riodacitico',
    activitySummary: 'Sorveglianza sismica e geodetica nella caldera di Santorini e lungo il cono sottomarino attivo di Kolumbo a nord-est dell’isola.',
    url: 'https://volcano.si.edu/volcano.cfm?vn=212040',
  },
  {
    id: 'cumbre-vieja',
    name: 'Cumbre Vieja (Tajogaite)',
    country: 'Spagna',
    region: 'La Palma · Isole Canarie',
    lat: 28.57,
    lon: -17.84,
    elevationM: 1949,
    type: 'Stratovulcano',
    agency: 'IGN / INVOLCAN',
    baseStatus: 'advisory',
    baseAlert: 'yellow',
    lastEruption: '2021',
    magmaType: 'Basanite / Tefrite',
    activitySummary: 'Fase post-eruttiva con degassamento residuo di CO₂ a Puerto Naos/La Bombilla e raffreddamento del campo lavico del cono Tajogaite.',
    url: 'https://volcano.si.edu/volcano.cfm?vn=383010',
  },

  // --- AMERICHE & HAWAII ---
  {
    id: 'kilauea',
    name: 'Kīlauea',
    country: 'Stati Uniti',
    region: 'Hawaii · Big Island',
    lat: 19.421,
    lon: -155.287,
    elevationM: 1222,
    type: 'Vulcano a scudo',
    agency: 'USGS Hawaiian Volcano Observatory',
    baseStatus: 'erupting',
    baseAlert: 'orange',
    lastEruption: 'In corso (Caldera Halemaʻumaʻu / Rift Zone)',
    magmaType: 'Basaltico fluido',
    activitySummary: 'Deformazione inflattiva della caldera sommitale e frequenti sciami sismici lungo l’East Rift Zone e Southwest Rift Zone.',
    url: 'https://www.usgs.gov/volcanoes/kilauea',
  },
  {
    id: 'popocatepetl',
    name: 'Popocatépetl',
    country: 'Messico',
    region: 'Puebla / Morelos',
    lat: 19.023,
    lon: -98.622,
    elevationM: 5393,
    type: 'Stratovulcano',
    agency: 'CENAPRED Messico',
    baseStatus: 'erupting',
    baseAlert: 'orange',
    lastEruption: 'In corso (esalazioni e pennacchi di cenere)',
    magmaType: 'Andesitico-Dacitico',
    activitySummary: 'Emissione giornaliera di pennacchi di vapore, gas e cenere vulcanica fino a 6–8 km di quota con tremore armonico.',
    url: 'https://volcano.si.edu/volcano.cfm?vn=341090',
  },
  {
    id: 'fuego',
    name: 'Volcán de Fuego',
    country: 'Guatemala',
    region: 'Sacatepéquez / Escuintla',
    lat: 14.473,
    lon: -90.88,
    elevationM: 3763,
    type: 'Stratovulcano',
    agency: 'INSIVUMEH Guatemala',
    baseStatus: 'erupting',
    baseAlert: 'red',
    lastEruption: 'In corso (esplosioni stromboliane/vulcaniane)',
    magmaType: 'Basaltico-Andesitico',
    activitySummary: 'Esplosioni esplosive regolari (4–12 all’ora) con colonne di cenere a 4.800 m, valanghe incandescenti e onde d’urto acustiche.',
    url: 'https://volcano.si.edu/volcano.cfm?vn=342090',
  },
  {
    id: 'sangay',
    name: 'Sangay',
    country: 'Ecuador',
    region: 'Morona-Santiago',
    lat: -2.005,
    lon: -78.341,
    elevationM: 5286,
    type: 'Stratovulcano',
    agency: 'IG-EPN Ecuador',
    baseStatus: 'erupting',
    baseAlert: 'orange',
    lastEruption: 'In corso',
    magmaType: 'Andesitico',
    activitySummary: 'Attività esplosiva costante con colate laviche sul fianco sud-orientale e nubi di cenere rilevate via satellite.',
    url: 'https://volcano.si.edu/volcano.cfm?vn=352090',
  },
  {
    id: 'villarrica',
    name: 'Villarrica',
    country: 'Cile',
    region: 'Araucanía · Ande Meridionali',
    lat: -39.42,
    lon: -71.93,
    elevationM: 2847,
    type: 'Stratovulcano',
    agency: 'SERNAGEOMIN Cile',
    baseStatus: 'unrest',
    baseAlert: 'yellow',
    lastEruption: 'In corso (lago di lava attivo nel cratere)',
    magmaType: 'Basaltico-Andesitico',
    activitySummary: 'Lago di lava persistente nel condotto centrale con attività stromboliana ed emissioni di SO₂.',
    url: 'https://volcano.si.edu/volcano.cfm?vn=357120',
  },

  // --- ASIA, GIAPPONE, INDONESIA & PACIFICO ---
  {
    id: 'sakurajima',
    name: 'Sakurajima (Caldera Aira)',
    country: 'Giappone',
    region: 'Kyushu · Kagoshima',
    lat: 31.585,
    lon: 130.657,
    elevationM: 1117,
    type: 'Stratovulcano',
    agency: 'JMA Japan Meteorological Agency',
    baseStatus: 'erupting',
    baseAlert: 'orange',
    lastEruption: 'In corso (esplosioni vulcaniane al cratere Minamidake)',
    magmaType: 'Andesitico',
    activitySummary: 'Frequenti esplosioni vulcaniane ai crateri Minamidake e Showa con lancio di bombe vulcaniche e pennacchi di cenere su Kagoshima.',
    url: 'https://www.data.jma.go.jp/vois/data/english/activity_info/506.html',
  },
  {
    id: 'merapi',
    name: 'Merapi',
    country: 'Indonesia',
    region: 'Giava Centrale · Yogyakarta',
    lat: -7.54,
    lon: 110.446,
    elevationM: 2910,
    type: 'Stratovulcano',
    agency: 'PVMBG Indonesia',
    baseStatus: 'erupting',
    baseAlert: 'red',
    lastEruption: 'In corso (duomo lavico e flussi piroclastici)',
    magmaType: 'Andesitico',
    activitySummary: 'Crescita attiva dei duomi di lava sommitale con frequenti crolli gravitazionali e flussi piroclastici lungo i fiumi Bebeng e Boyong.',
    url: 'https://magma.esdm.go.id/',
  },
  {
    id: 'semeru',
    name: 'Semeru',
    country: 'Indonesia',
    region: 'Giava Orientale',
    lat: -8.108,
    lon: 112.922,
    elevationM: 3657,
    type: 'Stratovulcano',
    agency: 'PVMBG Indonesia',
    baseStatus: 'erupting',
    baseAlert: 'orange',
    lastEruption: 'In corso (esplosioni al cratere Jonggring Seloko)',
    magmaType: 'Andesitico',
    activitySummary: 'Eruzioni esplosive plurigiornaliere dal cratere Jonggring Seloko con pennacchi di cenere fino a 1–1.5 km sopra la vetta.',
    url: 'https://magma.esdm.go.id/',
  },
  {
    id: 'lewotobi',
    name: 'Lewotobi Laki-laki',
    country: 'Indonesia',
    region: 'Isola di Flores · Nusa Tenggara',
    lat: -8.542,
    lon: 122.775,
    elevationM: 1584,
    type: 'Stratovulcano',
    agency: 'PVMBG Indonesia',
    baseStatus: 'erupting',
    baseAlert: 'red',
    lastEruption: 'In corso (eruzioni parossistiche)',
    magmaType: 'Andesitico-Basaltico',
    activitySummary: 'Intensa attività esplosiva con alte colonne eruttive troposferiche e ricaduta di tefra sull’isola di Flores.',
    url: 'https://magma.esdm.go.id/',
  },
  {
    id: 'shiveluch',
    name: 'Shiveluch',
    country: 'Russia',
    region: 'Penisola della Kamchatka',
    lat: 56.653,
    lon: 161.36,
    elevationM: 3283,
    type: 'Stratovulcano',
    agency: 'KVERT Kamchatka',
    baseStatus: 'erupting',
    baseAlert: 'orange',
    lastEruption: 'In corso (estrusione duomo Karan e Молодой)',
    magmaType: 'Andesitico',
    activitySummary: 'Estrusione continua di duomi lavici viscosi accompagnata da esplosioni di cenere ad alta quota (pericolo aviazione codice Arancione/Rosso).',
    url: 'http://www.kscnet.ru/ivs/kvert/',
  },
  {
    id: 'piton-fournaise',
    name: 'Piton de la Fournaise',
    country: 'Francia (Réunion)',
    region: 'Oceano Indiano',
    lat: -21.244,
    lon: 55.708,
    elevationM: 2632,
    type: 'Vulcano a scudo',
    agency: 'OVPF / IPGP',
    baseStatus: 'unrest',
    baseAlert: 'yellow',
    lastEruption: '2023–2024',
    magmaType: 'Basaltico oceanico',
    activitySummary: 'Pressurizzazione del sistema magmatico superficiale sotto il cratere Dolomieu monitorata dalla rete clinometrica OVPF.',
    url: 'https://www.ipgp.fr/communiques-et-bulletins-de-lobservatoire/?obs=ovpf',
  },
  {
    id: 'nyiragongo',
    name: 'Nyiragongo',
    country: 'RD Congo',
    region: 'Rift Est-Africano · Goma',
    lat: -1.52,
    lon: 29.25,
    elevationM: 3470,
    type: 'Stratovulcano',
    agency: 'OVG Goma Volcano Observatory',
    baseStatus: 'erupting',
    baseAlert: 'orange',
    lastEruption: 'In corso (attività intracraterica)',
    magmaType: 'Nefelinitico ultra-fluido',
    activitySummary: 'Attività del lago di lava intracraterico e degassamento di SO₂ sopra il bacino del Lago Kivu.',
    url: 'https://volcano.si.edu/volcano.cfm?vn=223030',
  },
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SEISMIC_RADIUS_KM = 38;
let cache: { at: number; value: FeedResponse<Volcano> } | null = null;
const TTL_MS = 90_000;

export async function getVolcanoes(): Promise<FeedResponse<Volcano>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const [quakesRes, disastersRes] = await Promise.allSettled([getQuakes(), getDisasters()]);
  const quakes = quakesRes.status === 'fulfilled' ? quakesRes.value.quakes : [];
  const disasters =
    disastersRes.status === 'fulfilled'
      ? disastersRes.value.items.filter((d) => d.type === 'VO')
      : [];

  const items: Volcano[] = VOLCANO_CATALOG.map((v) => {
    const nearby: VolcanoQuakeRef[] = [];
    for (const q of quakes) {
      const dist = haversineKm(v.lat, v.lon, q.lat, q.lon);
      if (dist <= SEISMIC_RADIUS_KM) {
        nearby.push({
          id: q.id,
          mag: Math.round(q.mag * 10) / 10,
          depthKm: Math.round(q.depthKm * 10) / 10,
          place: q.place,
          time: q.time,
          distanceKm: Math.round(dist * 10) / 10,
        });
      }
    }
    nearby.sort((a, b) => b.mag - a.mag || b.time - a.time);

    const gdacsMatch = disasters.find(
      (d) =>
        haversineKm(v.lat, v.lon, d.lat, d.lon) <= 85 ||
        d.name.toLowerCase().includes(v.name.toLowerCase().split(' ')[0])
    );

    let status = v.baseStatus;
    let alertColor = v.baseAlert;

    if (gdacsMatch) {
      if (gdacsMatch.alertLevel === 'Red') {
        status = 'erupting';
        alertColor = 'red';
      } else if (gdacsMatch.alertLevel === 'Orange' && alertColor !== 'red') {
        status = 'erupting';
        alertColor = 'orange';
      }
    }

    const maxMag = nearby.length > 0 ? Math.max(...nearby.map((q) => q.mag)) : null;
    const shallowest = nearby.length > 0 ? Math.min(...nearby.map((q) => q.depthKm)) : null;

    // Upgrade status if an intense seismic swarm is actively detected around a volcano
    if (nearby.length >= 6 && alertColor === 'green') {
      status = 'advisory';
      alertColor = 'yellow';
    }
    if ((nearby.length >= 12 || (maxMag != null && maxMag >= 4.2)) && (alertColor === 'yellow' || alertColor === 'green')) {
      status = 'unrest';
      alertColor = 'orange';
    }

    return {
      id: v.id,
      name: v.name,
      country: v.country,
      region: v.region,
      lat: v.lat,
      lon: v.lon,
      elevationM: v.elevationM,
      type: v.type,
      agency: v.agency,
      status,
      alertColor,
      lastEruption: v.lastEruption,
      magmaType: v.magmaType,
      activitySummary: v.activitySummary,
      seismicCount7d: nearby.length,
      maxMag7d: maxMag,
      shallowestDepthKm: shallowest,
      nearbyQuakes: nearby.slice(0, 6),
      url: v.url,
    };
  });

  // Sort: Red/Erupting and Italian volcanoes with seismic activity first
  const alertOrder: Record<VolcanoAlertColor, number> = { red: 4, orange: 3, yellow: 2, green: 1 };
  items.sort(
    (a, b) =>
      alertOrder[b.alertColor] - alertOrder[a.alertColor] ||
      b.seismicCount7d - a.seismicCount7d ||
      Number(b.country === 'Italia') - Number(a.country === 'Italia')
  );

  const response: FeedResponse<Volcano> = {
    items,
    fetchedAt: Date.now(),
    stale: false,
    error: null,
  };
  cache = { at: Date.now(), value: response };
  return response;
}

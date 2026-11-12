import { Flight } from './worldEventsApi';

export type FlightTypeCategory = 'all' | 'airline' | 'lowcost' | 'cargo' | 'ga_heli';

export interface FlightClassification {
  airlineCode: string | null;
  airlineName: string | null;
  category: Exclude<FlightTypeCategory, 'all'>;
  categoryLabel: string;
  aircraftLabel: string;
  altitudeBand: 'low' | 'climb' | 'mid' | 'cruise';
}

export const FLIGHT_TYPE_FILTERS: Array<{
  id: FlightTypeCategory;
  label: string;
  shortLabel: string;
}> = [
  { id: 'all', label: 'Tutti i tipi', shortLabel: 'Tutti' },
  { id: 'airline', label: 'Voli di Linea', shortLabel: 'Linea' },
  { id: 'lowcost', label: 'Low-Cost', shortLabel: 'Low-Cost' },
  { id: 'cargo', label: 'Cargo & Merci', shortLabel: 'Cargo' },
  { id: 'ga_heli', label: 'Privati / Elicotteri', shortLabel: 'Privati / Eli' },
];

interface AirlineMeta {
  name: string;
  category: 'airline' | 'lowcost' | 'cargo';
}

const ICAO_AIRLINES: Record<string, AirlineMeta> = {
  // Italy
  ITY: { name: 'ITA Airways', category: 'airline' },
  DLA: { name: 'Air Dolomiti', category: 'airline' },
  NOS: { name: 'Neos', category: 'airline' },
  VOE: { name: 'Volotea', category: 'lowcost' },
  AEZ: { name: 'Aeroitalia', category: 'lowcost' },
  ISS: { name: 'Air Italy', category: 'airline' },

  // Major Low Cost Europe
  RYR: { name: 'Ryanair', category: 'lowcost' },
  RUK: { name: 'Ryanair UK', category: 'lowcost' },
  MAY: { name: 'Malta Air (Ryanair)', category: 'lowcost' },
  EZY: { name: 'easyJet', category: 'lowcost' },
  EJU: { name: 'easyJet Europe', category: 'lowcost' },
  EZS: { name: 'easyJet Switzerland', category: 'lowcost' },
  WZZ: { name: 'Wizz Air', category: 'lowcost' },
  WMT: { name: 'Wizz Air Malta', category: 'lowcost' },
  WUK: { name: 'Wizz Air UK', category: 'lowcost' },
  VLG: { name: 'Vueling', category: 'lowcost' },
  TRA: { name: 'Transavia', category: 'lowcost' },
  TVF: { name: 'Transavia France', category: 'lowcost' },
  EWG: { name: 'Eurowings', category: 'lowcost' },
  NOZ: { name: 'Norwegian', category: 'lowcost' },
  NSZ: { name: 'Norwegian Sweden', category: 'lowcost' },
  EXS: { name: 'Jet2', category: 'lowcost' },
  PGT: { name: 'Pegasus Airlines', category: 'lowcost' },
  SXS: { name: 'SunExpress', category: 'lowcost' },
  TOM: { name: 'TUI Airways', category: 'lowcost' },
  TUI: { name: 'TUIfly', category: 'lowcost' },
  IBS: { name: 'Iberia Express', category: 'lowcost' },
  BTI: { name: 'airBaltic', category: 'lowcost' },

  // Major Network Airlines Europe
  DLH: { name: 'Lufthansa', category: 'airline' },
  SWR: { name: 'Swiss', category: 'airline' },
  AUA: { name: 'Austrian Airlines', category: 'airline' },
  BEL: { name: 'Brussels Airlines', category: 'airline' },
  AFR: { name: 'Air France', category: 'airline' },
  KLM: { name: 'KLM', category: 'airline' },
  BAW: { name: 'British Airways', category: 'airline' },
  IBE: { name: 'Iberia', category: 'airline' },
  AEA: { name: 'Air Europa', category: 'airline' },
  TAP: { name: 'TAP Air Portugal', category: 'airline' },
  SAS: { name: 'SAS', category: 'airline' },
  FIN: { name: 'Finnair', category: 'airline' },
  EIN: { name: 'Aer Lingus', category: 'airline' },
  LOT: { name: 'LOT Polish', category: 'airline' },
  CSA: { name: 'Czech Airlines', category: 'airline' },
  ROT: { name: 'TAROM', category: 'airline' },
  AEE: { name: 'Aegean Airlines', category: 'airline' },
  OAL: { name: 'Olympic Air', category: 'airline' },
  THY: { name: 'Turkish Airlines', category: 'airline' },
  ASL: { name: 'Air Serbia', category: 'airline' },
  CTN: { name: 'Croatia Airlines', category: 'airline' },
  LZB: { name: 'Bulgaria Air', category: 'airline' },
  KMM: { name: 'KM Malta Airlines', category: 'airline' },
  LGL: { name: 'Luxair', category: 'airline' },
  WIF: { name: 'Widerøe', category: 'airline' },
  ICE: { name: 'Icelandair', category: 'airline' },
  VIR: { name: 'Virgin Atlantic', category: 'airline' },

  // Middle East & Africa
  UAE: { name: 'Emirates', category: 'airline' },
  QTR: { name: 'Qatar Airways', category: 'airline' },
  ETD: { name: 'Etihad Airways', category: 'airline' },
  SVA: { name: 'Saudia', category: 'airline' },
  GFA: { name: 'Gulf Air', category: 'airline' },
  OMA: { name: 'Oman Air', category: 'airline' },
  FDB: { name: 'flydubai', category: 'lowcost' },
  ABY: { name: 'Air Arabia', category: 'lowcost' },
  RJA: { name: 'Royal Jordanian', category: 'airline' },
  ELY: { name: 'El Al', category: 'airline' },
  MSR: { name: 'EgyptAir', category: 'airline' },
  RAM: { name: 'Royal Air Maroc', category: 'airline' },
  ETH: { name: 'Ethiopian Airlines', category: 'airline' },
  KQA: { name: 'Kenya Airways', category: 'airline' },
  SAA: { name: 'South African', category: 'airline' },

  // Americas
  AAL: { name: 'American Airlines', category: 'airline' },
  DAL: { name: 'Delta Air Lines', category: 'airline' },
  UAL: { name: 'United Airlines', category: 'airline' },
  SWA: { name: 'Southwest Airlines', category: 'lowcost' },
  JBU: { name: 'JetBlue', category: 'lowcost' },
  ASA: { name: 'Alaska Airlines', category: 'airline' },
  NKS: { name: 'Spirit Airlines', category: 'lowcost' },
  FFT: { name: 'Frontier Airlines', category: 'lowcost' },
  ACA: { name: 'Air Canada', category: 'airline' },
  WJA: { name: 'WestJet', category: 'lowcost' },
  AMX: { name: 'Aeroméxico', category: 'airline' },
  LAN: { name: 'LATAM', category: 'airline' },
  AVA: { name: 'Avianca', category: 'airline' },
  CMP: { name: 'Copa Airlines', category: 'airline' },
  GLO: { name: 'GOL', category: 'lowcost' },
  AZU: { name: 'Azul', category: 'lowcost' },
  ARG: { name: 'Aerolíneas Argentinas', category: 'airline' },

  // Asia / Pacific
  SIA: { name: 'Singapore Airlines', category: 'airline' },
  CPA: { name: 'Cathay Pacific', category: 'airline' },
  ANA: { name: 'All Nippon Airways', category: 'airline' },
  JAL: { name: 'Japan Airlines', category: 'airline' },
  KAL: { name: 'Korean Air', category: 'airline' },
  AAR: { name: 'Asiana Airlines', category: 'airline' },
  CCA: { name: 'Air China', category: 'airline' },
  CES: { name: 'China Eastern', category: 'airline' },
  CSN: { name: 'China Southern', category: 'airline' },
  CHH: { name: 'Hainan Airlines', category: 'airline' },
  EVA: { name: 'EVA Air', category: 'airline' },
  CAL: { name: 'China Airlines', category: 'airline' },
  THA: { name: 'Thai Airways', category: 'airline' },
  MAS: { name: 'Malaysia Airlines', category: 'airline' },
  GIA: { name: 'Garuda Indonesia', category: 'airline' },
  PAL: { name: 'Philippine Airlines', category: 'airline' },
  HVN: { name: 'Vietnam Airlines', category: 'airline' },
  AIC: { name: 'Air India', category: 'airline' },
  IGO: { name: 'IndiGo', category: 'lowcost' },
  QFA: { name: 'Qantas', category: 'airline' },
  VOZ: { name: 'Virgin Australia', category: 'airline' },
  ANZ: { name: 'Air New Zealand', category: 'airline' },
  AXM: { name: 'AirAsia', category: 'lowcost' },

  // Cargo & Logistics
  FDX: { name: 'FedEx Express', category: 'cargo' },
  UPS: { name: 'UPS Airlines', category: 'cargo' },
  BCS: { name: 'DHL Air', category: 'cargo' },
  DHK: { name: 'DHL Air UK', category: 'cargo' },
  BOX: { name: 'AeroLogic (DHL/LH)', category: 'cargo' },
  CLX: { name: 'Cargolux', category: 'cargo' },
  ICV: { name: 'Cargolux Italia', category: 'cargo' },
  GTI: { name: 'Atlas Air', category: 'cargo' },
  GEC: { name: 'Lufthansa Cargo', category: 'cargo' },
  CKS: { name: 'Kalitta Air', category: 'cargo' },
  TAY: { name: 'ASL Airlines', category: 'cargo' },
  SWT: { name: 'Swiftair Cargo', category: 'cargo' },
};

const ICAO_AIRCRAFT_NAMES: Record<string, string> = {
  B738: 'Boeing 737-800',
  B737: 'Boeing 737-700',
  B739: 'Boeing 737-900',
  B38M: 'Boeing 737 MAX 8',
  B39M: 'Boeing 737 MAX 9',
  B77W: 'Boeing 777-300ER',
  B772: 'Boeing 777-200',
  B77L: 'Boeing 777F',
  B788: 'Boeing 787-8',
  B789: 'Boeing 787-9',
  B78X: 'Boeing 787-10',
  B744: 'Boeing 747-400',
  B748: 'Boeing 747-8',
  B763: 'Boeing 767-300',
  A319: 'Airbus A319',
  A320: 'Airbus A320',
  A321: 'Airbus A321',
  A20N: 'Airbus A320neo',
  A21N: 'Airbus A321neo',
  A332: 'Airbus A330-200',
  A333: 'Airbus A330-300',
  A339: 'Airbus A330-900neo',
  A359: 'Airbus A350-900',
  A35K: 'Airbus A350-1000',
  A388: 'Airbus A380-800',
  BCS1: 'Airbus A220-100',
  BCS3: 'Airbus A220-300',
  E190: 'Embraer E190',
  E195: 'Embraer E195',
  E290: 'Embraer E190-E2',
  E295: 'Embraer E195-E2',
  E170: 'Embraer E170',
  AT76: 'ATR 72-600',
  AT75: 'ATR 72-500',
  DH8D: 'Dash 8 Q400',
  CRJ9: 'Bombardier CRJ900',
  C172: 'Cessna 172 Skyhawk',
  C182: 'Cessna 182',
  SR22: 'Cirrus SR22',
  P28A: 'Piper PA-28',
  PC12: 'Pilatus PC-12',
  EC35: 'Airbus H135 Elicottero',
  EC45: 'Airbus H145 Elicottero',
  A139: 'Leonardo AW139 Elicottero',
  A109: 'Leonardo AW109 Elicottero',
  R44: 'Robinson R44 Elicottero',
  AS50: 'Airbus H125 Elicottero',
};

const HELI_TYPES = new Set(['EC35', 'EC45', 'A139', 'AW139', 'A109', 'A169', 'R44', 'R22', 'AS50', 'AS55', 'B06', 'B429', 'B407', 'S76', 'S92', 'NH90']);
const GA_LIGHT_TYPES = new Set(['C152', 'C172', 'C182', 'C208', 'SR20', 'SR22', 'P28A', 'PA34', 'DA40', 'DA42', 'PC12', 'TBM7', 'TBM8', 'TBM9', 'BE20', 'C25A', 'C56X', 'CL35', 'CL60', 'GLF5', 'GLF6', 'F2TH', 'LJ45', 'E55P']);

export function classifyFlight(f: Flight): FlightClassification {
  const cs = (f.callsign || '').trim().toUpperCase();
  const altM = f.altitudeM ?? 0;
  const altFt = altM / 0.3048;
  const speedKmh = f.speedKmh ?? 0;
  const acType = (f.aircraftType || '').trim().toUpperCase();
  const emitter = (f.emitterCategory || '').trim().toUpperCase();

  let altitudeBand: FlightClassification['altitudeBand'] = 'cruise';
  if (altFt < 10000) altitudeBand = 'low';
  else if (altFt < 25000) altitudeBand = 'climb';
  else if (altFt < 35000) altitudeBand = 'mid';

  // Extract 3-letter ICAO airline prefix when callsign starts with 3 letters followed by a digit
  const prefixMatch = cs.match(/^([A-Z]{3})\d/);
  const prefix = prefixMatch ? prefixMatch[1] : null;
  const knownAirline = prefix ? ICAO_AIRLINES[prefix] : undefined;

  // Check if helicopter or light GA
  const isHeli =
    emitter === 'A7' ||
    HELI_TYPES.has(acType) ||
    cs.startsWith('ELIC') ||
    cs.startsWith('HELI') ||
    (altM > 0 && altM < 2200 && speedKmh > 0 && speedKmh < 240 && !prefix);

  const isGaOrPrivate =
    isHeli ||
    emitter === 'A1' ||
    emitter === 'A2' ||
    GA_LIGHT_TYPES.has(acType) ||
    // Registration-style callsign (e.g. I-ABCD, D-EFGH, N12345, G-ABCD, OE-ABC, HB-ABC) without airline prefix
    (!prefix && (cs.includes('-') || /^[IGDFN][A-Z0-9]{3,5}$/.test(cs))) ||
    (!knownAirline && altM > 0 && altM < 4500 && speedKmh > 0 && speedKmh < 420);

  let category: Exclude<FlightTypeCategory, 'all'> = 'airline';
  let categoryLabel = 'Volo di Linea';

  if (knownAirline) {
    category = knownAirline.category;
    categoryLabel =
      category === 'lowcost' ? 'Low-Cost' : category === 'cargo' ? 'Cargo' : 'Volo di Linea';
  } else if (isGaOrPrivate) {
    category = 'ga_heli';
    categoryLabel = isHeli ? 'Elicottero' : 'Aviazione Gen. / Privato';
  } else if (prefix) {
    category = 'airline';
    categoryLabel = 'Volo Commerciale';
  } else {
    category = 'ga_heli';
    categoryLabel = 'Privato / Locale';
  }

  let aircraftLabel = acType ? ICAO_AIRCRAFT_NAMES[acType] || acType : '';
  if (!aircraftLabel) {
    if (isHeli) aircraftLabel = 'Elicottero';
    else if (category === 'ga_heli') aircraftLabel = 'Velivolo Leggero / Business';
    else if (category === 'cargo') aircraftLabel = 'Cargo Widebody / Freighter';
    else if (altFt >= 34000) aircraftLabel = 'Jet di Linea (Crociera)';
    else aircraftLabel = 'Jet Passeggeri';
  }

  return {
    airlineCode: prefix,
    airlineName: knownAirline?.name ?? (prefix ? `Compagnia ${prefix}` : null),
    category,
    categoryLabel,
    aircraftLabel,
    altitudeBand,
  };
}

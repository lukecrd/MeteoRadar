// Compact IATA → ICAO airline designator table used to turn a printed flight
// number ("AZ610", "FR 1234") into the ATC callsign broadcast over ADS-B
// ("ITY610", "RYR1234"). Covers the main Italian, European and world
// carriers; anything missing is resolved through adsbdb at search time.
export const IATA_TO_ICAO: Record<string, string> = {
  // Italy
  AZ: 'ITY', // ITA Airways
  V7: 'VOE', // Volotea
  NO: 'NOS', // Neos
  IG: 'ISS', // Air Italy / Meridiana (legacy callsigns)
  EN: 'DLA', // Air Dolomiti
  XZ: 'AEZ', // Aeroitalia
  // Low cost Europe
  FR: 'RYR', // Ryanair
  RK: 'RUK', // Ryanair UK
  U2: 'EZY', // easyJet
  EC: 'EJU', // easyJet Europe
  DS: 'EZS', // easyJet Switzerland
  W6: 'WZZ', // Wizz Air
  W4: 'WMT', // Wizz Air Malta
  W9: 'WUK', // Wizz Air UK
  VY: 'VLG', // Vueling
  HV: 'TRA', // Transavia
  TO: 'TVF', // Transavia France
  EW: 'EWG', // Eurowings
  DY: 'NOZ', // Norwegian
  D8: 'NSZ', // Norwegian Air Sweden
  LS: 'EXS', // Jet2
  PC: 'PGT', // Pegasus
  XQ: 'SXS', // SunExpress
  BY: 'TOM', // TUI UK
  X3: 'TUI', // TUIfly
  // Network carriers Europe
  LH: 'DLH', // Lufthansa
  LX: 'SWR', // Swiss
  OS: 'AUA', // Austrian
  SN: 'BEL', // Brussels Airlines
  AF: 'AFR', // Air France
  KL: 'KLM', // KLM
  BA: 'BAW', // British Airways
  IB: 'IBE', // Iberia
  I2: 'IBS', // Iberia Express
  UX: 'AEA', // Air Europa
  TP: 'TAP', // TAP Air Portugal
  SK: 'SAS', // SAS
  AY: 'FIN', // Finnair
  EI: 'EIN', // Aer Lingus
  LO: 'LOT', // LOT
  OK: 'CSA', // Czech Airlines
  RO: 'ROT', // TAROM
  A3: 'AEE', // Aegean
  OA: 'OAL', // Olympic
  TK: 'THY', // Turkish Airlines
  JU: 'ASL', // Air Serbia
  OU: 'CTN', // Croatia Airlines
  FB: 'LZB', // Bulgaria Air
  KM: 'KMM', // KM Malta Airlines
  BT: 'BTI', // airBaltic
  LG: 'LGL', // Luxair
  WF: 'WIF', // Widerøe
  FI: 'ICE', // Icelandair
  VS: 'VIR', // Virgin Atlantic
  // Middle East / Africa
  EK: 'UAE', // Emirates
  QR: 'QTR', // Qatar Airways
  EY: 'ETD', // Etihad
  SV: 'SVA', // Saudia
  GF: 'GFA', // Gulf Air
  WY: 'OMA', // Oman Air
  FZ: 'FDB', // flydubai
  G9: 'ABY', // Air Arabia
  RJ: 'RJA', // Royal Jordanian
  LY: 'ELY', // El Al
  MS: 'MSR', // EgyptAir
  AT: 'RAM', // Royal Air Maroc
  ET: 'ETH', // Ethiopian
  KQ: 'KQA', // Kenya Airways
  SA: 'SAA', // South African
  // Americas
  AA: 'AAL', // American
  DL: 'DAL', // Delta
  UA: 'UAL', // United
  WN: 'SWA', // Southwest
  B6: 'JBU', // JetBlue
  AS: 'ASA', // Alaska
  NK: 'NKS', // Spirit
  F9: 'FFT', // Frontier
  AC: 'ACA', // Air Canada
  WS: 'WJA', // WestJet
  AM: 'AMX', // Aeroméxico
  LA: 'LAN', // LATAM
  AV: 'AVA', // Avianca
  CM: 'CMP', // Copa
  G3: 'GLO', // Gol
  AD: 'AZU', // Azul
  AR: 'ARG', // Aerolíneas Argentinas
  FX: 'FDX', // FedEx
  '5X': 'UPS', // UPS
  // Asia / Pacific
  SQ: 'SIA', // Singapore Airlines
  CX: 'CPA', // Cathay Pacific
  NH: 'ANA', // ANA
  JL: 'JAL', // Japan Airlines
  KE: 'KAL', // Korean Air
  OZ: 'AAR', // Asiana
  CA: 'CCA', // Air China
  MU: 'CES', // China Eastern
  CZ: 'CSN', // China Southern
  HU: 'CHH', // Hainan
  BR: 'EVA', // EVA Air
  CI: 'CAL', // China Airlines
  TG: 'THA', // Thai
  MH: 'MAS', // Malaysia
  GA: 'GIA', // Garuda
  PR: 'PAL', // Philippine
  VN: 'HVN', // Vietnam Airlines
  AI: 'AIC', // Air India
  '6E': 'IGO', // IndiGo
  QF: 'QFA', // Qantas
  VA: 'VOZ', // Virgin Australia
  NZ: 'ANZ', // Air New Zealand
  AK: 'AXM', // AirAsia
};

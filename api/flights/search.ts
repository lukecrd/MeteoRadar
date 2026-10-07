import { searchFlights } from '../../lib/flightTracker.js';

// Flight search by number / callsign / ICAO24 / registration over the full
// cached OpenSky snapshot (see lib/flightTracker.ts).
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = typeof req.query?.q === 'string' ? req.query.q : '';
  try {
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');
    return res.status(200).json(await searchFlights(q));
  } catch (error: any) {
    return res.status(502).json({ error: error?.message || 'Ricerca non disponibile' });
  }
}

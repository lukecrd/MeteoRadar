import { getFlightInfo } from '../../lib/flightTracker.js';

// Route + aircraft enrichment from adsbdb (cached 12–24 h server-side).
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const callsign = typeof req.query?.callsign === 'string' && req.query.callsign.trim() ? req.query.callsign.trim() : null;
  const icao24 = typeof req.query?.icao24 === 'string' && /^[0-9a-fA-F]{6}$/.test(req.query.icao24) ? req.query.icao24 : null;
  try {
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(await getFlightInfo(callsign, icao24));
  } catch (error: any) {
    return res.status(502).json({ error: error?.message || 'Informazioni non disponibili' });
  }
}

import { getFlightLive } from '../../lib/flightTracker';

// Live state of one aircraft for "Segui volo" (adsb.lol, OpenSky snapshot fallback).
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const icao24 = typeof req.query?.icao24 === 'string' ? req.query.icao24 : '';
  if (!/^[0-9a-fA-F]{6}$/.test(icao24)) return res.status(400).json({ error: 'icao24 non valido' });
  try {
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10');
    return res.status(200).json(await getFlightLive(icao24));
  } catch (error: any) {
    return res.status(502).json({ error: error?.message || 'Dati del volo non disponibili' });
  }
}

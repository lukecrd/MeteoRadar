import { getFlightInfo, isCallsign, isHex } from '../lib/flights.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { callsign, hex } = req.query ?? {};
  if (!isCallsign(callsign)) {
    return res.status(400).json({ error: 'Parametro callsign non valido' });
  }
  try {
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(await getFlightInfo(callsign, isHex(hex) ? hex : null));
  } catch (error: any) {
    console.error('Flight info error:', error?.message || error);
    return res.status(502).json({ error: 'Flight info unavailable' });
  }
}

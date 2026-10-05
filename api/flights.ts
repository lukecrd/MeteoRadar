import { getHubFlights, isHubId } from '../lib/flights.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const hub = req.query?.hub;
  if (!isHubId(hub)) {
    return res.status(400).json({ error: 'Parametro hub non valido' });
  }
  try {
    const data = await getHubFlights(hub);
    // One URL per hub, so the CDN shares each hub's picture across all visitors.
    res.setHeader('Cache-Control', data.error ? 'no-store' : 's-maxage=45, stale-while-revalidate=60');
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Flight feed error:', error?.message || error);
    return res.status(502).json({ error: 'Flight feed unavailable' });
  }
}

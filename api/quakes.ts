import { getQuakes } from '../lib/quakes.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(await getQuakes());
  } catch (error: any) {
    console.error('Earthquake feed error:', error?.message || error);
    return res.status(502).json({ error: 'Earthquake feed unavailable' });
  }
}

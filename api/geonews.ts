import { getGeoNews } from '../lib/geonews.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    return res.status(200).json(await getGeoNews());
  } catch (error: any) {
    console.error('Geo news feed error:', error?.message || error);
    return res.status(502).json({ error: 'Geo news feed unavailable' });
  }
}

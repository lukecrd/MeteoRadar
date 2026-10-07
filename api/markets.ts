import { getMarkets } from '../lib/markets.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json(await getMarkets());
  } catch (error: any) {
    console.error('Market feed error:', error?.message || error);
    return res.status(502).json({ error: 'Market feed unavailable' });
  }
}

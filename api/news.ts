import { getNews, isNewsCategory } from '../lib/news';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const category = isNewsCategory(req.query?.category) ? req.query.category : 'all';
  try {
    // Edge-cache for a minute, serve stale while revalidating.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=180');
    return res.status(200).json(await getNews(category));
  } catch (error: any) {
    console.error('News feed error:', error?.message || error);
    return res.status(502).json({ error: 'News feed unavailable' });
  }
}

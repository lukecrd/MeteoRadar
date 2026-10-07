import { getDisasters } from '../lib/worldEvents.js';

// WorldHub globe layer: see lib/worldEvents.ts for source and caching notes.
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Loaders never throw: upstream failures come back as { stale, error }.
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  return res.status(200).json(await getDisasters());
}

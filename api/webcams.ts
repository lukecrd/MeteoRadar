import { getWebcams, parseWebcamQuery } from '../lib/webcams.js';

// Webcams near a point: see lib/webcams.ts for source and caching notes.
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const point = parseWebcamQuery(req.query);
  if (!point) return res.status(400).json({ error: 'lat e lon obbligatori' });

  // Image URLs expire after 10 minutes: keep the edge cache well under that.
  res.setHeader('Cache-Control', 's-maxage=240, stale-while-revalidate=60');
  return res.status(200).json(await getWebcams(point.lat, point.lon));
}

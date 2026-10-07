import { getSatellites, isSatelliteGroup } from '../lib/worldEvents';

// WorldHub satellites layer: CelesTrak TLE sets, cached ≥2 h (see lib/worldEvents.ts).
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const group = isSatelliteGroup(req.query?.group) ? req.query.group : 'stations';
  // Loader never throws: upstream failures come back as { stale, error }.
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
  return res.status(200).json(await getSatellites(group));
}

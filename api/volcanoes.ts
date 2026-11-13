import { getVolcanoes } from '../lib/volcanoes.js';

export default async function handler(_req: any, res: any) {
  res.setHeader('Cache-Control', 'public, s-maxage=90, stale-while-revalidate=180');
  res.status(200).json(await getVolcanoes());
}

// Run: npm run check:webcams
import assert from 'node:assert/strict';
import { getWebcams, parseWebcamQuery } from './webcams';

assert.deepEqual(parseWebcamQuery({ lat: '41.89', lon: '12.51' }), { lat: 41.89, lon: 12.51 });
assert.equal(parseWebcamQuery({ lat: '41.89' }), null);
assert.equal(parseWebcamQuery({ lat: '', lon: '' }), null);
assert.equal(parseWebcamQuery({ lat: 'abc', lon: '12' }), null);
assert.equal(parseWebcamQuery({ lat: '91', lon: '12' }), null);
assert.equal(parseWebcamQuery({ lat: '41', lon: '181' }), null);

// Without a key the loader answers "not configured" and calls nobody.
delete process.env.WINDY_API_KEY;
const off = await getWebcams(41.89, 12.51);
assert.equal(off.configured, false);
assert.deepEqual(off.items, []);

// With a key: Windy's payload is mapped, inactive cams dropped, and the answer cached.
process.env.WINDY_API_KEY = ' "test"\n'; // pasted with quotes and a newline
let calls = 0;
globalThis.fetch = (async (url: string, init: any) => {
  calls++;
  assert.match(url, /nearby=41\.89,12\.51,30/);
  assert.equal(init.headers['x-windy-api-key'], 'test');
  return new Response(
    JSON.stringify({
      webcams: [
        {
          webcamId: 7,
          title: 'Roma centro',
          status: 'active',
          lastUpdatedOn: '2026-11-12T20:00:00.000Z',
          images: { current: { preview: 'https://img/7.jpg' } },
          location: { city: 'Roma', latitude: 41.9, longitude: 12.5 },
          urls: { detail: 'https://www.windy.com/webcams/7' },
        },
        { webcamId: 8, title: 'Spenta', status: 'inactive', images: { current: { preview: 'x' } } },
      ],
    })
  );
}) as any;
const on = await getWebcams(41.89, 12.51);
assert.equal(on.items.length, 1);
assert.equal(on.items[0].image, 'https://img/7.jpg');
assert.equal(on.items[0].city, 'Roma');
await getWebcams(41.89, 12.51);
assert.equal(calls, 1, 'second call is served from cache');

// Upstream failure: empty list with the error, never a throw.
globalThis.fetch = (async () => new Response('no', { status: 401 })) as any;
const bad = await getWebcams(10, 10);
assert.equal(bad.error, 'HTTP 401');
console.log('webcams.check ok');

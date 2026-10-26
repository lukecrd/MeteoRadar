/** Self-check for the personal-alert rules: `npm run check:alerts`. */
import assert from 'node:assert/strict';
import { AlertPlace, AlertRules, ForecastHour, distanceKm, evaluateForecast, evaluateQuakes, filterNew, noticeId } from './personalAlerts';

const roma: AlertPlace = { id: '41.90,12.50', name: 'Roma', lat: 41.9, lon: 12.5 };
const rules: AlertRules = { rainMmH: 5, gustKmh: 60, heatC: 35, storms: true, quakeMinMag: 3, quakeRadiusKm: 100 };
const hour = (time: string, p: Partial<ForecastHour> = {}): ForecastHour => ({ time, precipitationMm: 0, gustKmh: 10, temperatureC: 20, weatherCode: 1, ...p });

// Calm forecast: nothing.
assert.deepEqual(evaluateForecast(roma, rules, [hour('2026-10-26T18:00'), hour('2026-10-26T19:00')]), []);

// Each threshold fires once, at the right hour; gusts and heat report the peak.
const stormy = [
  hour('2026-10-26T18:00', { gustKmh: 62 }),
  hour('2026-10-26T19:00', { precipitationMm: 7.2, gustKmh: 85, weatherCode: 96 }),
  hour('2026-10-26T20:00', { precipitationMm: 12, temperatureC: 36 }),
];
const n = evaluateForecast(roma, rules, stormy);
assert.deepEqual(n.map((x) => x.key), ['rain:41.90,12.50:2026-10-26', 'gust:41.90,12.50:2026-10-26', 'heat:41.90,12.50:2026-10-26', 'storm:41.90,12.50:2026-10-26']);
assert.match(n[0].body, /7,2 mm\/h alle 19:00/);
assert.match(n[1].body, /85 km\/h verso le 19:00/);
assert.match(n[3].body, /grandine/);

// A rule set to 0 is off.
assert.equal(evaluateForecast(roma, { ...rules, rainMmH: 0, gustKmh: 0, heatC: 0, storms: false }, stormy).length, 0);

// Earthquakes: magnitude, distance and age filters.
const now = Date.parse('2026-10-26T18:00:00Z');
const quakes = [
  { id: 'near', mag: 3.4, lat: 41.8, lon: 13.0, place: 'Frosinone', time: now - 10 * 60_000 },
  { id: 'weak', mag: 2.1, lat: 41.8, lon: 13.0, place: 'Frosinone', time: now - 10 * 60_000 },
  { id: 'far', mag: 5.0, lat: 37.5, lon: 15.0, place: 'Catania', time: now - 10 * 60_000 },
  { id: 'old', mag: 4.0, lat: 41.8, lon: 13.0, place: 'Frosinone', time: now - 5 * 60 * 60_000 },
];
const q = evaluateQuakes(roma, rules, quakes, now);
assert.deepEqual(q.map((x) => x.key), ['quake:near:41.90,12.50']);
assert.match(q[0].title, /M3\.4 a 43 km da Roma/);

// Distance sanity: Roma–Milano ≈ 477 km.
assert.ok(Math.abs(distanceKm(41.9, 12.5, 45.46, 9.19) - 477) < 5);

// De-duplication: a notice is sent once, and old keys expire after 48 h.
const first = filterNew(n, {}, now);
assert.equal(first.fresh.length, 4);
assert.equal(filterNew(n, first.seen, now + 60_000).fresh.length, 0);
assert.equal(filterNew(n, first.seen, now + 49 * 60 * 60_000).fresh.length, 4);

// Notification ids fit Android's 32-bit int and are stable.
assert.equal(noticeId('quake:near:41.90,12.50'), noticeId('quake:near:41.90,12.50'));
assert.ok(noticeId('x') >= 0 && noticeId('x') <= 0x7fffffff);

console.log('personalAlerts: ok');

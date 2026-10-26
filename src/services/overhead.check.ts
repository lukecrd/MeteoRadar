/** Self-check for ISS passes and compass helpers: `npm run check:overhead`. */
import assert from 'node:assert/strict';
import { bearingDeg, compassIt, satellitePasses } from './overhead';

// ISS TLE, epoch 2026-10-26 05:01 UTC.
const L1 = '1 25544U 98067A   26299.20906838  .00006121  00000+0  11890-3 0  9995';
const L2 = '2 25544  51.6337  11.7282 0006920 310.9581  49.0809 15.49059765592065';
const from = Date.parse('2026-10-26T12:00:00Z');

// Roma sees the ISS (51.6° orbit) several times a day.
const passes = satellitePasses(L1, L2, 41.9, 12.5, from, 24);
assert.ok(passes.length >= 2 && passes.length <= 10, `passes: ${passes.length}`);
for (const p of passes) {
  assert.ok(p.startMs <= p.peakMs && p.peakMs <= p.endMs);
  assert.ok(p.maxElevationDeg >= 10 && p.maxElevationDeg <= 90);
  assert.ok(p.endMs - p.startMs < 12 * 60_000, 'a LEO pass lasts minutes');
}
// Visible passes only happen with the observer in darkness (Rome: dark 16:45–05:30 UTC in late October).
for (const p of passes.filter((x) => x.visible)) {
  const h = new Date(p.peakMs).getUTCHours();
  assert.ok(h >= 16 || h <= 5, `visible pass in daylight at ${new Date(p.peakMs).toISOString()}`);
}

// Far beyond the orbit's inclination the ISS never rises above 10°.
assert.equal(satellitePasses(L1, L2, 85, 0, from, 24).length, 0);

assert.equal(compassIt(0), 'N');
assert.equal(compassIt(350), 'N');
assert.equal(compassIt(225), 'SO');
assert.equal(compassIt(-90), 'O');
assert.equal(compassIt(bearingDeg(41.9, 12.5, 45.46, 9.19)), 'NO'); // Roma → Milano

console.log(`overhead: ok (${passes.length} passaggi, ${passes.filter((p) => p.visible).length} visibili)`);

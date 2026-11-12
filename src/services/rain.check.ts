// Run: npm run check:rain
import assert from 'node:assert/strict';
import { summarizeRain } from './weatherApi';

const steps = (...mm: number[]) => mm.map((v, i) => ({ time: String(i), mm: v }));

assert.equal(summarizeRain(steps(0, 0, 0, 0, 0, 0, 0, 0)), 'Nessuna pioggia nei prossimi 2 h');
assert.equal(summarizeRain(steps(0.4, 0.2, 0.1, 0, 0, 0, 0, 0)), 'Piove ora, smette tra circa 45 min');
assert.equal(summarizeRain(steps(1, 1, 1, 1, 1, 1, 1, 1)), 'Pioggia per almeno 2 h');
assert.equal(summarizeRain(steps(0, 0, 0.3, 0.5, 0, 0, 0, 0)), 'Pioggia tra circa 30 min, per circa 30 min');
assert.equal(summarizeRain(steps(0, 0, 0, 0, 0, 0, 0.2, 0.2)), 'Pioggia tra circa 1 h 30 min');
// traces below the API's 0.1 mm resolution are dry
assert.equal(summarizeRain(steps(0.05, 0, 0, 0)), 'Nessuna pioggia nei prossimi 1 h');
console.log('rain.check ok');

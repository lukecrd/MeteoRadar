// Run: npm run check:environment
import assert from 'node:assert/strict';
import { pollenLevel, seaState } from './environment';

assert.equal(pollenLevel(0), 'assente');
assert.equal(pollenLevel(9.9), 'basso');
assert.equal(pollenLevel(10), 'moderato');
assert.equal(pollenLevel(250), 'molto alto');
assert.deepEqual(seaState(0), { force: 0, label: 'Calmo' });
assert.deepEqual(seaState(0.3), { force: 2, label: 'Poco mosso' });
assert.deepEqual(seaState(1.25), { force: 3, label: 'Mosso' });
assert.deepEqual(seaState(20), { force: 9, label: 'Tempestoso' });
console.log('environment.check ok');

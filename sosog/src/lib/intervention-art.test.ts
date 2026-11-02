import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { INTERVENTION_ART } from './intervention-art.js';
import { INTERVENTION_LEVELS } from './intervention.js';

describe('INTERVENTION_ART', () => {
  test('has one drawing for each level, all different', () => {
    assert.equal(INTERVENTION_ART.length, INTERVENTION_LEVELS.length);
    assert.equal(new Set(INTERVENTION_ART).size, INTERVENTION_ART.length);
  });

  test('draws ground in every level and only original fabric at level 0', () => {
    for (const art of INTERVENTION_ART) assert.match(art, /class="g"/);
    assert.doesNotMatch(INTERVENTION_ART[0], /class="n"/);
    assert.match(INTERVENTION_ART[0], /class="o"/);
  });

  test('shows new work from level 1 up, and original fabric in every level except the last two', () => {
    for (let i = 1; i < INTERVENTION_ART.length; i++) assert.match(INTERVENTION_ART[i], /class="n"/);
    for (let i = 0; i <= 6; i++) assert.match(INTERVENTION_ART[i], /class="o"/);
  });

  test('keeps only the footprint original at level 7', () => {
    const art = INTERVENTION_ART[7];
    const originals = art.match(/<path class="o"[^>]*>/g) ?? [];
    assert.equal(originals.length, 3);
  });

  test('is well formed: every shape closes itself, and each group is closed', () => {
    for (const art of INTERVENTION_ART) {
      const opened = (art.match(/<(path|rect)\b/g) ?? []).length;
      const closed = (art.match(/\/>/g) ?? []).length;
      assert.equal(opened, closed);
      assert.equal((art.match(/<g\b/g) ?? []).length, (art.match(/<\/g>/g) ?? []).length);
    }
  });
});

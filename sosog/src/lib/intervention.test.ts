import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { INTERVENTION_LEVELS, parseIntervention, interventionLabel } from './intervention.js';

describe('parseIntervention', () => {
  test('lists the eight levels in order from 0 to 7', () => {
    assert.deepEqual(
      INTERVENTION_LEVELS.map((l) => [l.level, l.name]),
      [[0, 'No Intervention'], [1, 'Prevention'], [2, 'Preservation'], [3, 'Consolidation'], [4, 'Rehabilitation'], [5, 'Restoration'], [6, 'Reproduction'], [7, 'Reconstruction']]
    );
  });

  test('reads a bare number and the word Level with any spacing', () => {
    assert.equal(parseIntervention('5')?.level, 5);
    assert.equal(parseIntervention('Level 5')?.level, 5);
    assert.equal(parseIntervention('Level  6')?.level, 6);
    assert.equal(parseIntervention('level0')?.level, 0);
  });

  test('reads the level name, its adjective, and the bracketed word', () => {
    assert.equal(parseIntervention('Restoration')?.level, 5);
    assert.equal(parseIntervention('Restored')?.level, 5);
    assert.equal(parseIntervention('rehabilitated')?.level, 4);
    assert.equal(parseIntervention('Reconstructed')?.level, 7);
    assert.equal(parseIntervention('Prevention (Maintenance)')?.level, 1);
    assert.equal(parseIntervention('Maintenance')?.level, 1);
    assert.equal(parseIntervention('Repair')?.level, 2);
    assert.equal(parseIntervention('Consolidation (Alteration)')?.level, 3);
    assert.equal(parseIntervention('No Intervention')?.level, 0);
  });

  test('accepts a number and a name that agree', () => {
    assert.equal(parseIntervention('Level 5 - Restoration')?.level, 5);
    assert.equal(parseIntervention('Level 2: Preservation (Repair)')?.level, 2);
  });

  test('reads nothing when the number and the name disagree, or two levels are named', () => {
    assert.equal(parseIntervention('Level 4 Restoration'), null);
    assert.equal(parseIntervention('Restoration and Rehabilitation'), null);
  });

  test('never reads "unrestored" as restored', () => {
    assert.equal(parseIntervention('Unrestored'), null);
  });

  test('reads nothing from empty text, an out-of-range number, or years', () => {
    assert.equal(parseIntervention(null), null);
    assert.equal(parseIntervention('   '), null);
    assert.equal(parseIntervention('Level 8'), null);
    assert.equal(parseIntervention('1874'), null);
  });
});

describe('interventionLabel', () => {
  test('shows the client name for a readable value', () => {
    assert.equal(interventionLabel('Restored'), 'Restoration');
    assert.equal(interventionLabel('Level 1'), 'Prevention');
  });

  test('keeps the sheet words when no single level can be read', () => {
    assert.equal(interventionLabel('Partly restored, partly reconstructed'), 'Partly restored, partly reconstructed');
  });

  test('returns null for nothing', () => {
    assert.equal(interventionLabel(''), null);
    assert.equal(interventionLabel(undefined), null);
  });
});

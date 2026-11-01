import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByMunicipality, carouselItems, emptyMunicipalities, groupByClassification, type StructureLike } from './structures.js';

const make = (id: string, name: string, municipality: string, extra: Partial<StructureLike['data']> = {}): StructureLike => ({
  id,
  data: { name, municipality, ...extra }
});

const sample = [
  make('juban-b', 'B House', 'Juban', { classification: 'Residential/Ancestral', photo: 'b-house' }),
  make('juban-a', 'A House', 'Juban', { classification: 'Residential/Ancestral' }),
  make('bulan-x', 'X School', 'Bulan', { classification: 'Educational' }),
  make('barcelona-c', 'C Church', 'Barcelona', { classification: 'Churches' })
];

describe('groupByMunicipality', () => {
  test('follows the fixed municipality order, sorts names, and skips empty municipalities', () => {
    const groups = groupByMunicipality(sample);
    assert.deepEqual(groups.map((g) => g.name), ['Barcelona', 'Bulan', 'Juban']);
    assert.deepEqual(groups[2].items.map((s) => s.data.name), ['A House', 'B House']);
    assert.equal(groups[0].slug, 'barcelona');
  });

  test('slugs multi-word municipalities', () => {
    assert.equal(groupByMunicipality([make('p', 'P', 'Prieto Diaz')])[0].slug, 'prieto-diaz');
  });
});

describe('carouselItems', () => {
  test('uses the first structure that has a photo and falls back to null', () => {
    const items = carouselItems(sample, (key) => key === 'b-house');
    const juban = items.find((i) => i.name === 'Juban')!;
    assert.equal(juban.count, 2);
    assert.equal(juban.photoKey, 'b-house');
    assert.equal(items.find((i) => i.name === 'Bulan')!.photoKey, null);
  });
});

describe('emptyMunicipalities', () => {
  test('lists the municipalities with no structures', () => {
    const empty = emptyMunicipalities(sample);
    assert.ok(empty.includes('Matnog') && empty.includes('Santa Magdalena'));
    assert.ok(!empty.includes('Juban'));
    assert.equal(empty.length, 12);
  });
});

describe('groupByClassification', () => {
  test('keeps groups of at least minSize, largest first', () => {
    const groups = groupByClassification(sample, 2);
    assert.deepEqual(groups.map((g) => [g.label, g.items.length]), [['Residential/Ancestral', 2]]);
    assert.equal(groupByClassification(sample, 1).length, 3);
  });
});

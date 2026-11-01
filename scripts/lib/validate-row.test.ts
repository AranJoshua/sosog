import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateRow, missingHeaders, slugify, isBlankRow, photoKey, stripControlJunk, EXPECTED_HEADERS } from './validate-row.js';

describe('validateRow', () => {
  test('accepts a fully-filled valid row', () => {
    const result = validateRow(
      {
        name: 'Casa Real de Sorsogon',
        municipality: 'Sorsogon City',
        coordinates: '12.9705, 124.0067',
        history: 'A Spanish-era house.',
        technical_description: 'Built with coral stone.',
        feature_story: 'A story.'
      },
      2
    );
    assert.equal(result.errors.length, 0);
    assert.ok(result.record);
    assert.equal(result.record?.id, 'sorsogon-city-casa-real-de-sorsogon');
    assert.equal(result.record?.latitude, 12.9705);
    assert.equal(result.record?.longitude, 124.0067);
  });

  test('accepts blank content fields as null, not an error (two-tier schema)', () => {
    const result = validateRow(
      {
        name: 'Balay na Bato',
        municipality: 'Bulan',
        coordinates: '12.67, 123.88',
        history: '',
        technical_description: undefined,
        feature_story: '   '
      },
      3
    );
    assert.equal(result.errors.length, 0);
    assert.equal(result.record?.history, null);
    assert.equal(result.record?.technicalDescription, null);
    assert.equal(result.record?.featureStory, null);
  });

  test('rejects an empty name', () => {
    const result = validateRow(
      { name: '', municipality: 'Bulan', coordinates: '12.67, 123.88' },
      4
    );
    assert.equal(result.record, null);
    assert.ok(result.errors.some((e) => e.includes('"name" is empty')));
  });

  test('rejects a municipality not on the known list', () => {
    const result = validateRow(
      { name: 'X', municipality: 'Sorsogonn City', coordinates: '12.97, 124.0' },
      5
    );
    assert.equal(result.record, null);
    assert.ok(result.errors.some((e) => e.includes('not one of the known Sorsogon municipalities')));
  });

  test('rejects an out-of-range latitude', () => {
    const result = validateRow(
      { name: 'X', municipality: 'Bulan', coordinates: '200, 123.88' },
      6
    );
    assert.equal(result.record, null);
    assert.ok(result.errors.some((e) => e.includes('"coordinates"')));
  });

  test('rejects an out-of-range longitude', () => {
    const result = validateRow(
      { name: 'X', municipality: 'Bulan', coordinates: '12.67, 300' },
      7
    );
    assert.equal(result.record, null);
    assert.ok(result.errors.some((e) => e.includes('"coordinates"')));
  });

  test('rejects malformed coordinates (not a "lat, lng" pair)', () => {
    const result = validateRow(
      { name: 'X', municipality: 'Bulan', coordinates: '12.67 123.88' },
      8
    );
    assert.equal(result.record, null);
    assert.ok(result.errors.some((e) => e.includes('"coordinates"')));
  });

  test('collects multiple structural errors on one row at once', () => {
    const result = validateRow({ name: '', municipality: '', coordinates: '' }, 9);
    assert.equal(result.record, null);
    assert.equal(result.errors.length, 3);
  });
});

describe('missingHeaders', () => {
  test('reports nothing missing when every expected header is present', () => {
    assert.deepEqual(missingHeaders([...EXPECTED_HEADERS]), []);
  });

  test('reports a renamed/missing column by name', () => {
    const fields = ['name', 'municipality', 'coords', 'history', 'technical_description', 'feature_story'];
    assert.deepEqual(missingHeaders(fields), ['coordinates']);
  });

  test('ignores incidental column order and extra whitespace', () => {
    const fields = [' feature_story ', 'coordinates', 'name', 'technical_description', 'municipality', 'history'];
    assert.deepEqual(missingHeaders(fields), []);
  });
});

describe('isBlankRow', () => {
  test('reports a row with every field empty as blank', () => {
    assert.equal(
      isBlankRow({ name: '', municipality: '', coordinates: '', history: '', technical_description: '', feature_story: '' }),
      true
    );
  });

  test('reports a row where Papaparse only produced the first key (a truly empty CSV line) as blank', () => {
    assert.equal(isBlankRow({ name: '' }), true);
  });

  test('whitespace-only fields still count as blank', () => {
    assert.equal(isBlankRow({ name: '   ', municipality: '\t' }), true);
  });

  test('a row with any real content is not blank', () => {
    assert.equal(isBlankRow({ name: 'X', municipality: '', coordinates: '' }), false);
  });
});

describe('slugify', () => {
  test('lowercases and hyphenates', () => {
    assert.equal(slugify('Casa Real de Sorsogon'), 'casa-real-de-sorsogon');
  });

  test('strips accents', () => {
    assert.equal(slugify('Prieto Díaz'), 'prieto-diaz');
  });

  test('collapses punctuation into single hyphens with no leading/trailing hyphen', () => {
    assert.equal(slugify('  St. Anne\'s -- Church!! '), 'st-anne-s-church');
  });
});

describe('photoKey', () => {
  test('reduces a sheet file name to the stem the prep script writes', () => {
    assert.equal(photoKey('BULAN SOUTH CENTRAL.png'), 'bulan-south-central');
    assert.equal(photoKey('BARCELONA, ST. JOSEPH.png'), 'barcelona-st-joseph');
    assert.equal(photoKey('Bagatao_Island_PHLSE.jpg'), 'bagatao-island-phlse');
  });

  test('returns null for blank, N/A, or none', () => {
    assert.equal(photoKey(''), null);
    assert.equal(photoKey(undefined), null);
    assert.equal(photoKey('N/A'), null);
    assert.equal(photoKey('None'), null);
  });
});

describe('optional columns', () => {
  const base = { name: 'Casa Real', municipality: 'Bulan', coordinates: '12.67, 123.87' };

  test('reads year, classification, materials, occupancy and photo when present', () => {
    const result = validateRow(
      { ...base, year_built: '1912', classification: 'Educational', materials: 'Timber', occupancy: 'Occupied', photo: 'CASA REAL.png' },
      2
    );
    assert.equal(result.record?.yearBuilt, '1912');
    assert.equal(result.record?.classification, 'Educational');
    assert.equal(result.record?.materials, 'Timber');
    assert.equal(result.record?.occupancy, 'Occupied');
    assert.equal(result.record?.photo, 'casa-real');
  });

  test('reads the level of intervention from intervention_level, keeping the sheet words', () => {
    const result = validateRow({ ...base, intervention_level: ' Level 5 - Restoration ' }, 2);
    assert.equal(result.record?.interventionLevel, 'Level 5 - Restoration');
  });

  test('leaves them null when the columns are absent', () => {
    const result = validateRow(base, 2);
    assert.equal(result.record?.interventionLevel, null);
    assert.equal(result.record?.yearBuilt, null);
    assert.equal(result.record?.photo, null);
  });
});

describe('not-applicable cells', () => {
  const base = { name: 'Casa Real', municipality: 'Bulan', coordinates: '12.67, 123.87' };

  test('treats N/A in a content cell as nothing to show, whatever the case or spacing', () => {
    for (const na of ['N/A', 'n/a', ' N/A ', 'N / A', 'N.A.', 'NA']) {
      const result = validateRow({ ...base, history: na, feature_story: na, technical_description: na, year_built: na }, 2);
      assert.equal(result.record?.history, null, `history "${na}"`);
      assert.equal(result.record?.featureStory, null, `feature story "${na}"`);
      assert.equal(result.record?.technicalDescription, null, `technical description "${na}"`);
      assert.equal(result.record?.yearBuilt, null, `year "${na}"`);
    }
  });

  test('keeps real text that merely contains or starts with those letters', () => {
    const result = validateRow({ ...base, history: 'N/A until the 1900s, then rebuilt.', feature_story: 'Nathaniel Reyes remembers the school.', year_built: 'Unknown' }, 2);
    assert.equal(result.record?.history, 'N/A until the 1900s, then rebuilt.');
    assert.equal(result.record?.featureStory, 'Nathaniel Reyes remembers the school.');
    assert.equal(result.record?.yearBuilt, 'Unknown');
  });

  test('still reads "None" as a level of intervention', () => {
    assert.equal(validateRow({ ...base, intervention_level: 'None' }, 2).record?.interventionLevel, 'None');
  });
});

describe('stripControlJunk', () => {
  test('removes control characters and spreadsheet escape text but keeps line breaks and tabs', () => {
    assert.equal(stripControlJunk('landscape.\u0001 The Clemente'), 'landscape. The Clemente');
    assert.equal(stripControlJunk('Sorsogon._x0001_Built in 1916'), 'Sorsogon.Built in 1916');
    assert.equal(stripControlJunk('one\ntwo\tthree'), 'one\ntwo\tthree');
  });

  test('is applied to content fields', () => {
    const result = validateRow(
      { name: 'Casa Real', municipality: 'Bulan', coordinates: '12.67, 123.87', technical_description: 'Walls\u0001 of coral', history: '_x0001_', feature_story: '' },
      2
    );
    assert.equal(result.record?.technicalDescription, 'Walls of coral');
    assert.equal(result.record?.history, null);
  });
});

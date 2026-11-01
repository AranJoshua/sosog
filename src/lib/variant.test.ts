import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { extractPullQuote, pickVariant } from './variant.js';

describe('pickVariant', () => {
  test('is stable and stays in range', () => {
    assert.equal(pickVariant('Casa Feliz', 3), pickVariant('Casa Feliz', 3));
    for (const seed of ['a', 'Bulan South Central School', '']) {
      const v = pickVariant(seed, 3);
      assert.ok(v >= 0 && v < 3);
    }
  });
});

describe('extractPullQuote', () => {
  test('returns the first sentence', () => {
    assert.equal(extractPullQuote('It stood for a century. Then it fell.'), 'It stood for a century.');
  });

  test('does not stop at an abbreviation such as St.', () => {
    assert.equal(
      extractPullQuote('The Baluarte of Barcelona, situated across from the St. Joseph Parish Church, faces the sea. More follows.'),
      'The Baluarte of Barcelona, situated across from the St. Joseph Parish Church, faces the sea.'
    );
  });

  test('keeps the whole text when there is no sentence end, and trims long sentences', () => {
    assert.equal(extractPullQuote('No full stop here'), 'No full stop here');
    const long = `${'word '.repeat(60)}end.`;
    const quote = extractPullQuote(long, 50);
    assert.ok(quote.endsWith('\u2026'));
    assert.ok(quote.length <= 51);
  });

  test('still ends on a real full stop that follows an abbreviation-like word at the very end', () => {
    assert.equal(extractPullQuote('It was built near the old St.'), 'It was built near the old St.');
  });
});

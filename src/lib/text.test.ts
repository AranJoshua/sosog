import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, excerpt, countLabel } from './text.js';

describe('slugify', () => {
  test('lowercases, strips accents, and hyphenates', () => {
    assert.equal(slugify('Prieto Diaz'), 'prieto-diaz');
    assert.equal(slugify('Mga Moog ng Bulusan'), 'mga-moog-ng-bulusan');
    assert.equal(slugify('  Dońa --Casa!  '), 'dona-casa');
  });
});

describe('excerpt', () => {
  test('returns null for empty or whitespace-only text', () => {
    assert.equal(excerpt(null), null);
    assert.equal(excerpt('   \n  '), null);
  });

  test('leaves short text alone and collapses whitespace', () => {
    assert.equal(excerpt('A  short\n text.', 100), 'A short text.');
  });

  test('cuts long text at a word boundary and adds an ellipsis', () => {
    const out = excerpt('The quick brown fox jumps over the lazy dog and keeps running far away', 30)!;
    assert.ok(out.endsWith('\u2026'));
    assert.ok(out.length <= 31);
    assert.ok(!out.slice(0, -1).endsWith(' '));
    assert.equal(out, 'The quick brown fox jumps over\u2026');
  });
});

describe('countLabel', () => {
  test('pluralises', () => {
    assert.equal(countLabel(1), '1 structure');
    assert.equal(countLabel(0), '0 structures');
    assert.equal(countLabel(6), '6 structures');
  });
});

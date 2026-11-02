import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getStructurePhoto, getGlimpsePhotos, GLIMPSE_HIDDEN } from './photos.js';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const PHOTOS_DIR = path.resolve('public/structures');

describe('getStructurePhoto', () => {
  before(async () => {
    await mkdir(PHOTOS_DIR, { recursive: true });
    await writeFile(path.join(PHOTOS_DIR, 'bulan-balay-na-bato-thumb.jpg'), '');
  });

  after(async () => {
    // Only remove what this test added, not any real synced photos a
    // developer might already have sitting in public/structures/ locally.
    await rm(path.join(PHOTOS_DIR, 'bulan-balay-na-bato-thumb.jpg'), { force: true });
  });

  test('returns the public URL when the file exists', () => {
    assert.equal(getStructurePhoto('bulan-balay-na-bato', 'thumb'), '/structures/bulan-balay-na-bato-thumb.jpg');
  });

  test('returns null for a variant that has not been synced', () => {
    assert.equal(getStructurePhoto('bulan-balay-na-bato', 'large'), null);
  });

  test('returns null for a structure with no synced photo at all', () => {
    assert.equal(getStructurePhoto('some-other-structure', 'thumb'), null);
  });
});

describe('getGlimpsePhotos', () => {
  test('returns thumb/large pairs in number order and skips unpaired files', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'glimpse-'));
    for (const f of ['glimpse-002-thumb.jpg', 'glimpse-002-large.jpg', 'glimpse-001-thumb.jpg', 'glimpse-001-large.jpg', 'glimpse-003-thumb.jpg', 'notes.txt']) {
      await writeFile(path.join(dir, f), '');
    }
    const photos = getGlimpsePhotos(dir);
    assert.deepEqual(photos.map((p) => p.n), [1, 2]);
    assert.equal(photos[0].thumb, '/glimpse/glimpse-001-thumb.jpg');
    assert.equal(photos[0].large, '/glimpse/glimpse-001-large.jpg');
    await rm(dir, { recursive: true, force: true });
  });

  test('returns an empty list when the folder does not exist', () => {
    assert.deepEqual(getGlimpsePhotos('/definitely/not/a/folder'), []);
  });

  test('leaves out the hidden photos (the team selfies) even if their files are present', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'glimpse-'));
    const keep = 1;
    const hidden = [...GLIMPSE_HIDDEN][0];
    for (const n of [keep, hidden]) {
      for (const v of ['thumb', 'large']) await writeFile(path.join(dir, `glimpse-${String(n).padStart(3, '0')}-${v}.jpg`), '');
    }
    assert.ok([32, 41, 47, 51].every((n) => GLIMPSE_HIDDEN.has(n)));
    assert.deepEqual(getGlimpsePhotos(dir).map((p) => p.n), [keep]);
    assert.deepEqual(getGlimpsePhotos(dir, new Set()).map((p) => p.n).sort((a, b) => a - b), [keep, hidden].sort((a, b) => a - b));
    await rm(dir, { recursive: true, force: true });
  });
});

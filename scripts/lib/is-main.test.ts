import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isMainModule } from './is-main.js';

describe('isMainModule', () => {
  test('matches the entry file on a POSIX path', () => {
    assert.equal(isMainModule('file:///home/me/sosog/scripts/sync-sheet.ts', '/home/me/sosog/scripts/sync-sheet.ts', false), true);
  });

  test('matches a POSIX path that contains a space (file URLs encode it as %20)', () => {
    assert.equal(isMainModule('file:///home/me/My%20Projects/sosog/scripts/sync-sheet.ts', '/home/me/My Projects/sosog/scripts/sync-sheet.ts', false), true);
  });

  test('matches a Windows path with a drive letter, backslashes, and a space', () => {
    assert.equal(
      isMainModule('file:///C:/Users/Aran%20O/sosog/scripts/sync-sheet.ts', 'C:\\Users\\Aran O\\sosog\\scripts\\sync-sheet.ts', true),
      true
    );
  });

  test('ignores drive-letter case on Windows', () => {
    assert.equal(isMainModule('file:///c:/work/sosog/scripts/sync-sheet.ts', 'C:\\work\\sosog\\scripts\\sync-sheet.ts', true), true);
  });

  test('is false when another file started the process (a test runner importing the module)', () => {
    assert.equal(isMainModule('file:///home/me/sosog/scripts/sync-sheet.ts', '/home/me/sosog/scripts/sync-sheet.test.ts', false), false);
    assert.equal(isMainModule('file:///C:/work/sosog/scripts/sync-sheet.ts', 'C:\\work\\sosog\\scripts\\sync-sheet.test.ts', true), false);
  });

  test('is false when there is no entry path', () => {
    assert.equal(isMainModule('file:///home/me/sosog/scripts/sync-sheet.ts', undefined, false), false);
  });
});

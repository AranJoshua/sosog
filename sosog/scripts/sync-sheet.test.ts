import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runSync, SyncFailure } from './sync-sheet.js';

/** Serves `body` as text/csv on an ephemeral local port, for the duration of `fn`. */
async function withCsvServer<T>(body: string, fn: (url: string) => Promise<T>): Promise<T> {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/csv' });
    res.end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not bind to a port');
  try {
    return await fn(`http://127.0.0.1:${address.port}/sheet.csv`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

/** A fresh temp directory for runSync's outputDir, cleaned up after the test. */
async function withTempOutputDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'sosog-sync-test-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const HEADER = 'name,municipality,coordinates,history,technical_description,feature_story';

describe('runSync', () => {
  test('writes one JSON file per valid row, reports blank-content structures', async () => {
    const csv = [
      HEADER,
      'Casa Real,Sorsogon City,"12.9705, 124.0067",A house.,Coral stone.,',
      'Balay na Bato,Bulan,"12.6700, 123.8767",,,'
    ].join('\n');

    await withTempOutputDir(async (dir) => {
      const result = await withCsvServer(csv, (url) => runSync(url, dir));
      assert.equal(result.written, 2);
      assert.deepEqual(result.missingContentNames.sort(), ['Balay na Bato', 'Casa Real']);

      const files = await readdir(dir);
      assert.equal(files.length, 2);
      const balay = JSON.parse(await readFile(path.join(dir, 'bulan-balay-na-bato.json'), 'utf8'));
      assert.equal(balay.history, null);
    });
  });

  test('fails loudly, naming the row and field, on a bad municipality', async () => {
    const csv = [HEADER, 'X,Sorsogonn City,"12.97, 124.0",,,'].join('\n');
    await withTempOutputDir(async (dir) => {
      await assert.rejects(
        () => withCsvServer(csv, (url) => runSync(url, dir)),
        (err: unknown) => {
          assert.ok(err instanceof SyncFailure);
          assert.match(err.message, /row 2.*municipality.*Sorsogonn City/s);
          return true;
        }
      );
    });
  });

  test('fails loudly on an out-of-range coordinate', async () => {
    const csv = [HEADER, 'X,Bulan,"200, 124.0",,,'].join('\n');
    await withTempOutputDir(async (dir) => {
      await assert.rejects(
        () => withCsvServer(csv, (url) => runSync(url, dir)),
        (err: unknown) => err instanceof SyncFailure && /row 2.*coordinates/s.test(err.message)
      );
    });
  });

  test('fails on a renamed/missing column, by column name, before touching any row', async () => {
    const badHeader = 'name,municipality,coords,history,technical_description,feature_story';
    const csv = [badHeader, 'X,Bulan,"12.97, 124.0",,,'].join('\n');
    await withTempOutputDir(async (dir) => {
      await assert.rejects(
        () => withCsvServer(csv, (url) => runSync(url, dir)),
        (err: unknown) => err instanceof SyncFailure && /missing from the sheet: coordinates/.test(err.message)
      );
    });
  });

  test('fails on two rows producing the same id (same municipality + name)', async () => {
    const csv = [
      HEADER,
      'Casa Real,Sorsogon City,"12.9705, 124.0067",A.,B.,',
      'Casa Real,Sorsogon City,"12.9700, 124.0060",C.,D.,'
    ].join('\n');
    await withTempOutputDir(async (dir) => {
      await assert.rejects(
        () => withCsvServer(csv, (url) => runSync(url, dir)),
        (err: unknown) => err instanceof SyncFailure && /Duplicate structure id/.test(err.message)
      );
    });
  });

  test('skips a blank spacer row (all cells empty) instead of failing the build on it', async () => {
    // A blank spreadsheet row still has the right number of commas
    // (",,,,,"), so it is NOT the same thing as a zero-length CSV line, and
    // must not be reported as a structure with a missing name/municipality/
    // coordinates.
    const csv = [HEADER, ',,,,,', 'Casa Real,Sorsogon City,"12.9705, 124.0067",A.,B.,'].join('\n');
    await withTempOutputDir(async (dir) => {
      const result = await withCsvServer(csv, (url) => runSync(url, dir));
      assert.equal(result.written, 1);
    });
  });

  test('a blank spacer row does not shift the row number reported for a later bad row', async () => {
    const csv = [
      HEADER,
      'Casa Real,Sorsogon City,"12.9705, 124.0067",A.,B.,', // row 2
      ',,,,,', // row 3, blank
      'X,Sorsogonn City,"12.97, 124.0",,,' // row 4, bad municipality
    ].join('\n');
    await withTempOutputDir(async (dir) => {
      await assert.rejects(
        () => withCsvServer(csv, (url) => runSync(url, dir)),
        (err: unknown) => {
          assert.ok(err instanceof SyncFailure);
          assert.match(err.message, /row 4.*municipality/s);
          return true;
        }
      );
    });
  });

  test('a trailing blank line at the end of the sheet is harmless', async () => {
    const csv = [HEADER, 'Casa Real,Sorsogon City,"12.9705, 124.0067",A.,B.,', ''].join('\n');
    await withTempOutputDir(async (dir) => {
      const result = await withCsvServer(csv, (url) => runSync(url, dir));
      assert.equal(result.written, 1);
    });
  });

  test('fails when SHEET_CSV_URL is not set', async () => {
    await withTempOutputDir(async (dir) => {
      await assert.rejects(
        () => runSync(undefined, dir),
        (err: unknown) => err instanceof SyncFailure && /SHEET_CSV_URL is not set/.test(err.message)
      );
    });
  });

  test('fails when the sheet URL 404s', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(404);
      res.end('not found');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('server did not bind');
    try {
      await withTempOutputDir(async (dir) => {
        await assert.rejects(
          () => runSync(`http://127.0.0.1:${address.port}/missing.csv`, dir),
          (err: unknown) => err instanceof SyncFailure && /HTTP 404/.test(err.message)
        );
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe('runSync: fetch resilience and guards', () => {
  const GOOD_ROW = 'Casa Real,Sorsogon City,"12.9705, 124.0067",A.,B.,';

  /** A server whose responses come from `statuses` in order (the last one repeats); counts requests. */
  async function withScriptedServer<T>(statuses: number[], body: string, fn: (url: string, hits: () => number) => Promise<T>): Promise<T> {
    let hits = 0;
    const server = http.createServer((_req, res) => {
      const status = statuses[Math.min(hits, statuses.length - 1)];
      hits++;
      res.writeHead(status, { 'content-type': 'text/csv' });
      res.end(status === 200 ? body : 'error');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('server did not bind to a port');
    try {
      return await fn(`http://127.0.0.1:${address.port}/sheet.csv`, () => hits);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  const fast = { retryDelaysMs: [5, 5] };

  test('retries a transient 503 and then succeeds', async () => {
    await withTempOutputDir(async (dir) => {
      const result = await withScriptedServer([503, 200], [HEADER, GOOD_ROW].join('\n'), async (url, hits) => {
        const r = await runSync(url, dir, fast);
        assert.equal(hits(), 2);
        return r;
      });
      assert.equal(result.written, 1);
    });
  });

  test('gives up after repeated 503 responses and says how many attempts were made', async () => {
    await withTempOutputDir(async (dir) => {
      await withScriptedServer([503], '', async (url, hits) => {
        await assert.rejects(
          () => runSync(url, dir, fast),
          (err: unknown) => err instanceof SyncFailure && /HTTP 503.*after 3 attempts/s.test(err.message)
        );
        assert.equal(hits(), 3);
      });
    });
  });

  test('does not retry a 404, which means the URL is wrong', async () => {
    await withTempOutputDir(async (dir) => {
      await withScriptedServer([404], '', async (url, hits) => {
        await assert.rejects(() => runSync(url, dir, fast), (err: unknown) => err instanceof SyncFailure && /HTTP 404/.test(err.message));
        assert.equal(hits(), 1);
      });
    });
  });

  test('accepts a header row with stray spaces around a column name', async () => {
    const csv = ['name ,municipality, coordinates,history,technical_description,feature_story', GOOD_ROW].join('\n');
    await withTempOutputDir(async (dir) => {
      const result = await withCsvServer(csv, (url) => runSync(url, dir));
      assert.equal(result.written, 1);
    });
  });

  test('a sheet with headers but no structure rows fails and leaves existing files alone', async () => {
    const csv = [HEADER, ',,,,,'].join('\n');
    await withTempOutputDir(async (dir) => {
      await writeFile(path.join(dir, 'existing.json'), '{}');
      await assert.rejects(
        () => withCsvServer(csv, (url) => runSync(url, dir)),
        (err: unknown) => err instanceof SyncFailure && /no structure rows/.test(err.message)
      );
      assert.deepEqual(await readdir(dir), ['existing.json']);
    });
  });
});

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { runValidate, ValidationFailure } from './validate-data.js';

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

const HEADER = 'name,municipality,coordinates,history,technical_description,feature_story';

describe('runValidate', () => {
  test('reports OK with a coming-soon count on valid data', async () => {
    const csv = [
      HEADER,
      'Casa Real,Sorsogon City,"12.9705, 124.0067",A house.,Coral stone.,',
      'Balay na Bato,Bulan,"12.6700, 123.8767",,,'
    ].join('\n');
    const result = await withCsvServer(csv, (url) => runValidate(url));
    assert.equal(result.rowCount, 2);
    assert.equal(result.comingSoonCount, 2);
  });

  // The real build gate this mirrors is sync-sheet.test.ts's "fails on two
  // rows producing the same id" test. This local convenience check has to
  // catch the same thing, or it can report "OK" on data the real build
  // would still reject.
  test('fails on two rows producing the same id (same municipality + name)', async () => {
    const csv = [
      HEADER,
      'Casa Real,Sorsogon City,"12.9705, 124.0067",A.,B.,',
      'Casa Real,Sorsogon City,"12.9700, 124.0060",C.,D.,'
    ].join('\n');
    await assert.rejects(
      () => withCsvServer(csv, (url) => runValidate(url)),
      (err: unknown) => err instanceof ValidationFailure && /duplicate structure id/.test(err.message)
    );
  });

  test('fails on a bad municipality, naming the row and field', async () => {
    const csv = [HEADER, 'X,Sorsogonn City,"12.97, 124.0",,,'].join('\n');
    await assert.rejects(
      () => withCsvServer(csv, (url) => runValidate(url)),
      (err: unknown) => err instanceof ValidationFailure && /row 2.*municipality.*Sorsogonn City/s.test(err.message)
    );
  });

  test('fails when SHEET_CSV_URL is not set', async () => {
    await assert.rejects(
      () => runValidate(undefined),
      (err: unknown) => err instanceof ValidationFailure && /SHEET_CSV_URL is not set/.test(err.message)
    );
  });
});

describe('runValidate: guards', () => {
  test('a sheet with headers but no structure rows fails', async () => {
    const csv = [HEADER, ',,,,,'].join('\n');
    await assert.rejects(
      () => withCsvServer(csv, (url) => runValidate(url)),
      (err: unknown) => err instanceof ValidationFailure && /no structure rows/.test(err.message)
    );
  });

  test('accepts a header row with stray spaces around a column name', async () => {
    const csv = ['name ,municipality, coordinates,history,technical_description,feature_story', 'Casa Real,Sorsogon City,"12.9705, 124.0067",A.,B.,'].join('\n');
    const result = await withCsvServer(csv, (url) => runValidate(url));
    assert.equal(result.rowCount, 1);
  });
});

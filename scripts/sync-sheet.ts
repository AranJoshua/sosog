import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Papa from 'papaparse';
import { EXPECTED_HEADERS, isBlankRow, missingHeaders, validateRow } from './lib/validate-row.js';
import { sendFailureEmail } from './lib/mailer.js';
import { fetchSheetCsv, SheetFetchError, type FetchSheetOptions } from './lib/fetch-sheet.js';
import { isMainModule } from './lib/is-main.js';

const DEFAULT_OUTPUT_DIR = path.resolve('src/content/structures');

/** Thrown for every expected, named failure (bad data, bad fetch, bad headers). */
export class SyncFailure extends Error {}

export interface SyncResult {
  written: number;
  missingContentNames: string[];
  /** How many structures have each content field blank, so the build log says which field is thin instead of one lump total. */
  missingCounts: { history: number; technicalDescription: number; featureStory: number };
}

/**
 * The whole sync, as a pure-ish async function: throws SyncFailure on any
 * expected problem instead of exiting the process, so it's testable without
 * killing the test runner. `main()` below is the only thing that actually
 * calls process.exit or sends the failure email, this function just reports
 * what went wrong.
 */
export async function runSync(
  sheetUrl: string | undefined,
  outputDir: string = DEFAULT_OUTPUT_DIR,
  fetchOptions: FetchSheetOptions = {}
): Promise<SyncResult> {
  if (!sheetUrl) {
    throw new SyncFailure('SHEET_CSV_URL is not set. Publish the structures tab to web and set the env var.');
  }

  let csvText: string;
  try {
    csvText = await fetchSheetCsv(sheetUrl, fetchOptions);
  } catch (err) {
    if (err instanceof SheetFetchError) throw new SyncFailure(err.message);
    throw err;
  }

  // skipEmptyLines is deliberately false, not true or 'greedy': either of
  // those would drop rows out of parsed.data before we ever see them, which
  // shifts every later row's array index away from its real 1-indexed sheet
  // row. Blank rows are instead detected explicitly (isBlankRow, below) so
  // they can be skipped without losing row-number accuracy for real rows
  // that come after one.
  // transformHeader trims stray spaces ("name ") that a hand-edited header row
  // can carry: missingHeaders() already compares trimmed names, so without
  // this the check would pass and then every row would read as having no name.
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: false,
    transformHeader: (header) => header.trim()
  });

  const fields = parsed.meta.fields ?? [];
  const missing = missingHeaders(fields);
  if (missing.length > 0) {
    throw new SyncFailure(
      `Expected column(s) missing from the sheet: ${missing.join(', ')}. Expected headers: ${EXPECTED_HEADERS.join(', ')}.`
    );
  }

  const errors: string[] = [];
  const records = [];
  for (let i = 0; i < parsed.data.length; i++) {
    const rowNumber = i + 2; // account for header row, 1-indexed sheet rows
    if (isBlankRow(parsed.data[i])) continue; // spacer/trailing blank row, not a structure
    const result = validateRow(parsed.data[i], rowNumber);
    if (result.errors.length > 0) {
      errors.push(...result.errors);
    } else if (result.record) {
      records.push(result.record);
    }
  }

  if (errors.length > 0) {
    throw new SyncFailure(`Structural validation failed:\n${errors.join('\n')}`);
  }

  // A sheet with the right headers and no structure rows (every row deleted, a
  // formula range that went blank) is never a real state. Without this check
  // the sync would delete every structure file and the nightly build would
  // publish a site with nothing on it.
  if (records.length === 0) {
    throw new SyncFailure('The sheet has the expected headers but no structure rows, so nothing was written. Check the published tab.');
  }

  const seen = new Map<string, string>();
  for (const record of records) {
    const existingName = seen.get(record.id);
    if (existingName) {
      throw new SyncFailure(
        `Duplicate structure id "${record.id}" from "${existingName}" and "${record.name}" (same municipality + name). Rename one.`
      );
    }
    seen.set(record.id, record.name);
  }

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  for (const record of records) {
    await writeFile(path.join(outputDir, `${record.id}.json`), JSON.stringify(record, null, 2));
  }

  const missingContentNames = records
    .filter((r) => !r.history || !r.technicalDescription || !r.featureStory)
    .map((r) => r.name);

  const outputListing = await readdir(outputDir);
  if (outputListing.length !== records.length) {
    throw new SyncFailure(`Wrote ${records.length} record(s) but ${outputDir} contains ${outputListing.length} file(s).`);
  }

  const missingCounts = {
    history: records.filter((r) => !r.history).length,
    technicalDescription: records.filter((r) => !r.technicalDescription).length,
    featureStory: records.filter((r) => !r.featureStory).length
  };

  return { written: records.length, missingContentNames, missingCounts };
}

async function main() {
  try {
    const result = await runSync(process.env.SHEET_CSV_URL);
    console.log(`[sync-sheet] Wrote ${result.written} structure(s) to ${DEFAULT_OUTPUT_DIR}`);
    const { history, technicalDescription, featureStory } = result.missingCounts;
    if (history + technicalDescription + featureStory > 0) {
      console.log(
        `[sync-sheet] Blank content fields out of ${result.written}: history ${history}, technical description ${technicalDescription}, feature story ${featureStory}.`
      );
    }
  } catch (err) {
    const message =
      err instanceof SyncFailure ? err.message : `Unhandled error in sync-sheet: ${(err as Error).stack ?? err}`;
    console.error(`[sync-sheet] ${message}`);
    await sendFailureEmail('SOSOG sync-sheet build failure', message);
    process.exit(1);
  }
}

// Only run when this file is executed directly (`tsx scripts/sync-sheet.ts`),
// not when `runSync` is imported elsewhere, e.g. by the test file below.
if (isMainModule(import.meta.url)) {
  main();
}

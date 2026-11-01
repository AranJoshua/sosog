import { EXPECTED_HEADERS, isBlankRow, missingHeaders, validateRow } from './lib/validate-row.js';
import Papa from 'papaparse';
import { fetchSheetCsv, SheetFetchError, type FetchSheetOptions } from './lib/fetch-sheet.js';
import { isMainModule } from './lib/is-main.js';

/** Thrown for every expected, named failure. Mirrors sync-sheet.ts's SyncFailure. */
export class ValidationFailure extends Error {}

export interface ValidateResult {
  rowCount: number;
  comingSoonCount: number;
}

/**
 * The whole local validation pass, as a pure-ish async function: throws
 * ValidationFailure on any expected problem instead of exiting the process,
 * so it's testable the same way sync-sheet.ts's runSync is. `main()` below
 * is the only thing that actually calls process.exit.
 */
export async function runValidate(sheetUrl: string | undefined, fetchOptions: FetchSheetOptions = {}): Promise<ValidateResult> {
  if (!sheetUrl) {
    throw new ValidationFailure('SHEET_CSV_URL is not set.');
  }

  let csvText: string;
  try {
    csvText = await fetchSheetCsv(sheetUrl, fetchOptions);
  } catch (err) {
    if (err instanceof SheetFetchError) throw new ValidationFailure(err.message);
    throw err;
  }

  // See the matching comment in sync-sheet.ts: skipEmptyLines stays false
  // so blank sheet rows can be skipped explicitly (isBlankRow) without
  // desyncing every later row's reported row number.
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: false,
    transformHeader: (header) => header.trim()
  });

  const fields = parsed.meta.fields ?? [];
  const missing = missingHeaders(fields);
  if (missing.length > 0) {
    throw new ValidationFailure(
      `Missing column(s): ${missing.join(', ')}. Expected: ${EXPECTED_HEADERS.join(', ')}.`
    );
  }

  const errors: string[] = [];
  let comingSoonCount = 0;
  let rowCount = 0;
  // Mirrors sync-sheet.ts's duplicate-id check (same municipality + name):
  // that's a real build gate, so this local convenience check has to catch
  // it too, or it can report "OK" on data the real build would still reject.
  const seenIds = new Map<string, string>();
  for (let i = 0; i < parsed.data.length; i++) {
    const rowNumber = i + 2;
    if (isBlankRow(parsed.data[i])) continue;
    rowCount++;
    const result = validateRow(parsed.data[i], rowNumber);
    if (result.errors.length > 0) {
      errors.push(...result.errors);
    } else if (result.record) {
      if (!result.record.history || !result.record.technicalDescription || !result.record.featureStory) {
        comingSoonCount++;
      }
      const existingName = seenIds.get(result.record.id);
      if (existingName) {
        errors.push(
          `row ${rowNumber}: duplicate structure id "${result.record.id}" from "${existingName}" and "${result.record.name}" (same municipality + name). Rename one.`
        );
      } else {
        seenIds.set(result.record.id, result.record.name);
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationFailure(`${errors.length} structural error(s) found:\n${errors.join('\n')}`);
  }

  // Mirrors sync-sheet.ts: a header-only sheet would wipe every structure.
  if (rowCount === 0) {
    throw new ValidationFailure('The sheet has the expected headers but no structure rows.');
  }

  return { rowCount, comingSoonCount };
}

async function main() {
  try {
    const result = await runValidate(process.env.SHEET_CSV_URL);
    console.log(
      `[validate-data] OK. ${result.rowCount} row(s) valid, ${result.comingSoonCount} with a blank content field.`
    );
  } catch (err) {
    const message = err instanceof ValidationFailure ? err.message : `Unhandled error: ${(err as Error).stack ?? err}`;
    console.error(`[validate-data] ${message}`);
    process.exit(1);
  }
}

// Only run when this file is executed directly (`tsx scripts/validate-data.ts`),
// not when `runValidate` is imported elsewhere, e.g. by the test file below.
if (isMainModule(import.meta.url)) {
  main();
}

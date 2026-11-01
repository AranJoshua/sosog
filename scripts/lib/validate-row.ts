import { MUNICIPALITIES } from '../../src/lib/municipalities.js';

export const EXPECTED_HEADERS = [
  'name',
  'municipality',
  'coordinates',
  'history',
  'technical_description',
  'feature_story'
] as const;

export interface RawRow {
  [key: string]: string | undefined;
}

export interface StructureRecord {
  id: string;
  name: string;
  municipality: string;
  latitude: number;
  longitude: number;
  history: string | null;
  technicalDescription: string | null;
  featureStory: string | null;
  yearBuilt: string | null;
  classification: string | null;
  materials: string | null;
  occupancy: string | null;
  /** Level of intervention, kept as the sheet words ("Level 5", "Restored"); the site reads the level from them. */
  interventionLevel: string | null;
  /** Photo file-name stem (see photoKey), used instead of the id so a renamed structure keeps its photo. */
  photo: string | null;
}

export interface RowValidationResult {
  record: StructureRecord | null;
  errors: string[];
}

export function missingHeaders(fields: string[]): string[] {
  const present = new Set(fields.map((field) => field.trim()));
  return EXPECTED_HEADERS.filter((header) => !present.has(header));
}

/**
 * True when every expected field on this row is empty. Used to silently
 * skip a spacer/blank row in the client's sheet (a common thing to find in
 * a "checklist"-style working sheet, including a trailing blank row at the
 * bottom of the data range, which Google Sheets exports routinely include)
 * instead of treating it as a structure with a missing name, municipality,
 * and coordinates. See the `skipEmptyLines: false` comment in sync-sheet.ts
 * / validate-data.ts for why this can't just be Papaparse's own
 * `skipEmptyLines` option: a blank *spreadsheet* row still contains the
 * right number of commas (e.g. `,,,,,`), so Papaparse doesn't treat it as
 * an empty line at all, and skipping truly blank lines via that option
 * instead would desync every later row's reported row number from its real
 * position in the sheet.
 */
export function isBlankRow(row: RawRow): boolean {
  return EXPECTED_HEADERS.every((header) => (row[header] ?? '').trim() === '');
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const COORDINATE_PATTERN = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

function parseCoordinates(raw: string): { latitude: number; longitude: number } | null {
  const match = COORDINATE_PATTERN.exec(raw);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

/**
 * Optional photo column: accepts the original file name as typed in the
 * sheet ("BULAN SOUTH CENTRAL.png") and reduces it to the same stem that
 * sosog_prep_photos.py writes ("bulan-south-central"), so the sheet can hold
 * the plain file name. Returns null when the cell is blank or N/A.
 */
export function photoKey(raw: string | undefined): string | null {
  const trimmed = (raw ?? '').trim().replace(/\.[A-Za-z0-9]{2,5}$/, '');
  const key = slugify(trimmed);
  return key.length > 0 && key !== 'n-a' && key !== 'none' ? key : null;
}

/**
 * Removes invisible junk that copy-pasting from Word or Docs leaves in cells:
 * control characters (U+0001 and friends, but not tabs or line breaks), and the
 * literal escape text `_x0001_` that spreadsheet exports use for them. Both
 * would otherwise show up on the page as boxes or stray text.
 */
export function stripControlJunk(text: string): string {
  return text.replace(/_x[0-9A-Fa-f]{4}_/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

/**
 * A cell that holds only "N/A" (any case, or N.A.) means the client has nothing
 * for that field, the same as an empty cell. Without this, the word itself
 * would be published as a feature story or a history.
 */
const NOT_APPLICABLE = /^(?:n\s*\/\s*a|n\.\s*a\.?|na)$/i;

function normalizeContentField(raw: string | undefined): string | null {
  const trimmed = stripControlJunk(raw ?? '').trim();
  return trimmed.length > 0 && !NOT_APPLICABLE.test(trimmed) ? trimmed : null;
}

export function validateRow(row: RawRow, rowNumber: number): RowValidationResult {
  const errors: string[] = [];

  const name = (row.name ?? '').trim();
  if (!name) {
    errors.push(`row ${rowNumber}: "name" is empty`);
  }

  const municipality = (row.municipality ?? '').trim();
  if (!municipality) {
    errors.push(`row ${rowNumber}: "municipality" is empty`);
  } else if (!(MUNICIPALITIES as readonly string[]).includes(municipality)) {
    errors.push(
      `row ${rowNumber}: "municipality" value "${municipality}" is not one of the known Sorsogon municipalities`
    );
  }

  const coordinatesRaw = (row.coordinates ?? '').trim();
  let coordinates: { latitude: number; longitude: number } | null = null;
  if (!coordinatesRaw) {
    errors.push(`row ${rowNumber}: "coordinates" is empty`);
  } else {
    coordinates = parseCoordinates(coordinatesRaw);
    if (!coordinates) {
      errors.push(
        `row ${rowNumber}: "coordinates" value "${coordinatesRaw}" is not a valid "latitude, longitude" pair in range`
      );
    }
  }

  if (errors.length > 0 || !coordinates) {
    return { record: null, errors };
  }

  return {
    record: {
      id: `${slugify(municipality)}-${slugify(name)}`,
      name,
      municipality,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      history: normalizeContentField(row.history),
      technicalDescription: normalizeContentField(row.technical_description),
      featureStory: normalizeContentField(row.feature_story),
      yearBuilt: normalizeContentField(row.year_built),
      classification: normalizeContentField(row.classification),
      materials: normalizeContentField(row.materials),
      occupancy: normalizeContentField(row.occupancy),
      interventionLevel: normalizeContentField(row.intervention_level),
      photo: photoKey(row.photo)
    },
    errors: []
  };
}

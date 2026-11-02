/**
 * The eight levels of intervention the client uses for each structure, from no work at all (0) to full reconstruction (7).
 * The sheet column holds whatever the team typed ("Level 5", "Restoration", "Restored", "Level 5 - Restoration"), and
 * `parseIntervention` turns that into one level, or into nothing when the text names no level or names more than one.
 */
export interface InterventionLevel {
  level: number;
  name: string;
  /** The plain-language word the client gives in brackets, when there is one. */
  note: string | null;
  /** Matches the start of a word, so "unrestored" never reads as "restored". */
  pattern: RegExp;
}

export const INTERVENTION_LEVELS: readonly InterventionLevel[] = [
  { level: 0, name: 'No Intervention', note: null, pattern: /(?<![a-z])(no intervention|none)(?![a-z])/i },
  { level: 1, name: 'Prevention', note: 'Maintenance', pattern: /(?<![a-z])(prevent|maintain|maintenance)/i },
  { level: 2, name: 'Preservation', note: 'Repair', pattern: /(?<![a-z])(preserv|repair)/i },
  { level: 3, name: 'Consolidation', note: 'Alteration', pattern: /(?<![a-z])(consolidat|alter)/i },
  { level: 4, name: 'Rehabilitation', note: null, pattern: /(?<![a-z])rehabilit/i },
  { level: 5, name: 'Restoration', note: null, pattern: /(?<![a-z])restor/i },
  { level: 6, name: 'Reproduction', note: null, pattern: /(?<![a-z])reproduc/i },
  { level: 7, name: 'Reconstruction', note: null, pattern: /(?<![a-z])reconstruct/i }
];

/** The level a sheet value stands for, or null when it names none or names two that disagree (for example "Level 4 Restoration"). */
export function parseIntervention(raw: string | null | undefined): InterventionLevel | null {
  const text = (raw ?? '').trim();
  if (!text) return null;
  const found = new Set<number>();
  const number = /(?<![0-9a-z])(?:level\s*)?([0-7])(?![0-9a-z])/i.exec(text);
  if (number) found.add(Number(number[1]));
  for (const l of INTERVENTION_LEVELS) if (l.pattern.test(text)) found.add(l.level);
  if (found.size !== 1) return null;
  return INTERVENTION_LEVELS[[...found][0]];
}

/** How the level reads on the page: the client's name for it, or the sheet's own words when no single level can be read from them. */
export function interventionLabel(raw: string | null | undefined): string | null {
  const text = (raw ?? '').trim();
  if (!text) return null;
  return parseIntervention(text)?.name ?? text;
}

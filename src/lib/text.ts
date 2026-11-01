/** Lower-case, accent-free, hyphen-separated version of a string, for URLs. Same rules scripts/lib/validate-row.ts uses for structure ids. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * A short plain-text excerpt: collapses whitespace and, when the text is
 * longer than `max`, cuts at the last word boundary and adds an ellipsis.
 * Returns null for empty input.
 */
export function excerpt(text: string | null | undefined, max = 240): string | null {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const endsOnWord = clean[max] === ' ';
  const lastSpace = cut.lastIndexOf(' ');
  const base = endsOnWord || lastSpace <= max * 0.6 ? cut : cut.slice(0, lastSpace);
  return `${base.replace(/[\s.,;:!?-]+$/, '')}\u2026`;
}

/** "1 structure" / "2 structures". */
export function countLabel(count: number, noun = 'structure'): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

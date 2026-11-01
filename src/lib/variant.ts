/**
 * Deterministically picks one of `count` variants from a stable string (a
 * structure's name or id). Same input always yields the same output, so a
 * given structure's feature story always renders with the same accent
 * color / photo layout / pull-quote position across builds, without
 * needing a dedicated column in the client's Sheet for it.
 */
export function pickVariant(seed: string, count: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % count;
}

/** Words that end in a full stop without ending the sentence ("St. Joseph", "Engr. Reyes", "Lot No. 5"). */
const ABBREVIATIONS = new Set([
  'st', 'sto', 'sta', 'mr', 'mrs', 'ms', 'dr', 'fr', 'rev', 'jr', 'sr', 'engr', 'atty', 'hon',
  'gen', 'col', 'capt', 'no', 'nos', 'vs', 'etc', 'co', 'inc', 'mt', 'ave', 'blvd', 'approx'
]);

/** The text up to the first sentence-ending mark, skipping full stops that belong to an abbreviation. */
function firstSentence(text: string): string {
  const ends = /[.!?](?=\s|$)/g;
  let match: RegExpExecArray | null;
  while ((match = ends.exec(text)) !== null) {
    if (match[0] === '.') {
      const word = /([A-Za-z]+)$/.exec(text.slice(0, match.index))?.[1]?.toLowerCase();
      if (word && ABBREVIATIONS.has(word) && match.index + 1 < text.length) continue;
    }
    return text.slice(0, match.index + 1);
  }
  return text;
}

/**
 * Pulls a short pull-quote out of a feature story's opening text: up to the
 * first sentence-ending punctuation (not counting abbreviations such as
 * "St."), capped at ~140 characters so a single run-on sentence doesn't
 * produce an oversized quote block.
 */
export function extractPullQuote(text: string, maxLength = 140): string {
  const candidate = firstSentence(text.trim());
  if (candidate.length <= maxLength) return candidate;
  return `${candidate.slice(0, maxLength).trimEnd()}…`;
}

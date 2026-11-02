/**
 * Tidies prose that was copied into the sheet from a PDF, a Word file or a web
 * page. Those sources break lines wherever their own page ended, so a
 * sentence can stop halfway and carry on a line below, and they leave stray
 * spaces around punctuation. The site shows the text as the sheet holds it, so
 * the cleanup happens here, once, when the sheet is read.
 *
 * - A line break that falls inside a sentence is joined back with a space.
 * - A line break after the end of a sentence stays, as a paragraph break, and
 *   every paragraph break becomes exactly one blank line.
 * - Runs of spaces and tabs collapse to one space, and spaces before , . ; : ! ?
 *   and inside brackets and quotation marks are removed.
 */

const SENTENCE_END = /[.!?…:"”'’)\]]$/;
const ABBREVIATION = /(?:^|[\s(])(?:St|Sta|Sto|Mr|Mrs|Ms|Dr|Engr|Atty|Gov|Hon|Sr|Jr|Fr|Rev|No|Nos|Vol|Inc|Co|Ltd|Prof|Sen|Rep|Cong|Brgy|Pres|Gen|Col|Capt|Lt|Mt|Ft|Php|P)\.$/i;
const STARTS_LOWERCASE = /^[a-zà-öø-ÿ]/;

function tidySpacing(paragraph: string): string {
  let text = paragraph
    .replace(/[\u00a0\u2007\u202f\u200b\ufeff]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/(\S) +([,;:!?])(?=\s|$)/g, '$1$2')
    .replace(/(\S) +\.(?=\s|$)/g, '$1.')
    .replace(/\( +/g, '(')
    .replace(/ +\)/g, ')')
    .replace(/“ +/g, '“')
    .replace(/ +”/g, '”');
  // Straight quotation marks come in pairs; trim the space just inside each pair ("Bobet " becomes "Bobet").
  if ((text.match(/"/g) ?? []).length % 2 === 0) {
    text = text.replace(/"\s*([^"]*?)\s*"/g, '"$1"');
  }
  return text.trim();
}

/** Joins lines broken inside a sentence and normalizes paragraph breaks and spacing. */
export function tidyProse(raw: string): string {
  const lines = raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim());

  const paragraphs: string[] = [];
  let current = '';
  for (const line of lines) {
    if (line === '') {
      if (current) paragraphs.push(current);
      current = '';
      continue;
    }
    if (!current) {
      current = line;
      continue;
    }
    const continues = STARTS_LOWERCASE.test(line) || !SENTENCE_END.test(current) || ABBREVIATION.test(current);
    if (!continues) {
      paragraphs.push(current);
      current = line;
    } else if (/[A-Za-z]-$/.test(current) && STARTS_LOWERCASE.test(line)) {
      current += line; // a word hyphenated at the end of a line keeps its hyphen and loses the space
    } else {
      current += ` ${line}`;
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs.map(tidySpacing).filter(Boolean).join('\n\n');
}

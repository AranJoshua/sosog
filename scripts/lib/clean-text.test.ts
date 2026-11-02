import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { tidyProse } from './clean-text.js';

describe('tidyProse', () => {
  test('joins a line that was broken inside a sentence', () => {
    assert.equal(tidyProse('The remaining work consisted of painting the\npermanent buildings,\nremoving temporary structures.'), 'The remaining work consisted of painting the permanent buildings, removing temporary structures.');
  });

  test('keeps a break after a finished sentence as a paragraph break, whether the sheet used one newline or a blank line', () => {
    assert.equal(tidyProse('First paragraph ends here.\n Second paragraph starts here.'), 'First paragraph ends here.\n\nSecond paragraph starts here.');
    assert.equal(tidyProse('First paragraph ends here.\n\n\n\nSecond paragraph starts here.'), 'First paragraph ends here.\n\nSecond paragraph starts here.');
  });

  test('joins after an abbreviation or when the next line starts in lower case', () => {
    assert.equal(tidyProse('It was blessed by Fr.\nJuan Reyes in 1874.'), 'It was blessed by Fr. Juan Reyes in 1874.');
    assert.equal(tidyProse('It stood by the sea.\nand faced the bay.'), 'It stood by the sea. and faced the bay.');
  });

  test('treats Windows line breaks the same as any other', () => {
    assert.equal(tidyProse('One sentence that wraps\r\nacross two lines.\r\n\r\nNext paragraph.'), 'One sentence that wraps across two lines.\n\nNext paragraph.');
  });

  test('removes stray spaces around punctuation, brackets and quotation marks', () => {
    assert.equal(tidyProse('Governor Robert "Bobet " Lee ( the governor ) , who built it .'), 'Governor Robert "Bobet" Lee (the governor), who built it.');
    assert.equal(tidyProse('A  double   space\tand a tab.'), 'A double space and a tab.');
  });

  test('leaves an odd number of quotation marks alone and never changes any words', () => {
    assert.equal(tidyProse('He said "hello there and left.'), 'He said "hello there and left.');
    const words = 'The St. John the Baptist Parish, built in 1816, stands in Castilla.';
    assert.equal(tidyProse(words), words);
  });

  test('keeps a word hyphenated at the end of a line without the space', () => {
    assert.equal(tidyProse('The tower was re-\nconstructed in 1904.'), 'The tower was re-constructed in 1904.');
  });
});

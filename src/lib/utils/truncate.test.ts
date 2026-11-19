import { describe, expect, it } from 'vitest';

import { truncateVisible } from './truncate';

describe('truncateVisible', () => {
  it('leaves a value that fits untouched', () => {
    expect(truncateVisible('Somchai', 12)).toBe('Somchai');
  });

  it('does not count Thai vowel and tone marks as characters', () => {
    // 13 code units, but only 10 letters take width.
    expect('นารี สุขสันต์'.length).toBe(13);
    expect(truncateVisible('นารี สุขสันต์', 10)).toBe('นารี สุขสันต์');
  });

  it('cuts Latin text to max - 1 letters plus an ellipsis', () => {
    expect(truncateVisible('abcdefghij', 5)).toBe('abcd…');
  });

  it('keeps the marks on the last kept letter and never strands one', () => {
    // ประเสริฐ: the sara i (ิ) belongs to ร; cutting after ร keeps it.
    expect(truncateVisible('ประเสริฐ ทองดี', 7)).toBe('ประเสริ…');
  });

  it('drops a trailing space before the ellipsis', () => {
    expect(truncateVisible('ab cd', 3)).toBe('ab…');
  });
});

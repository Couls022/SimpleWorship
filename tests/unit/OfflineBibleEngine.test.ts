import { describe, it, expect } from 'vitest';
import { BIBLE_BOOKS } from '../../src/data/bibleEngine';

describe('Offline Bible Engine', () => {
  it('contains all 66 canonical books of the Bible', () => {
    expect(BIBLE_BOOKS).toHaveLength(66);
    const otBooks = BIBLE_BOOKS.filter(b => b.testament === 'OT');
    const ntBooks = BIBLE_BOOKS.filter(b => b.testament === 'NT');
    expect(otBooks).toHaveLength(39);
    expect(ntBooks).toHaveLength(27);
  });

  it('supports English and Tagalog book name resolution and abbreviations', () => {
    const genesis = BIBLE_BOOKS.find(b => b.id === 'GEN');
    expect(genesis).toBeDefined();
    expect(genesis?.name).toBe('Genesis');
    expect(genesis?.nameTagalog).toBe('Genesis');
    expect(genesis?.abbreviations).toContain('gen');

    const psalms = BIBLE_BOOKS.find(b => b.id === 'PSA');
    expect(psalms).toBeDefined();
    expect(psalms?.name).toBe('Psalms');
    expect(psalms?.nameTagalog).toBe('Mga Awit');
    expect(psalms?.abbreviations).toContain('mga awit');
  });
});

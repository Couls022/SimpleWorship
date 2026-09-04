/**
 * SimpleWorship Enterprise Offline Search Engine
 * 
 * Standalone, high-performance, deterministic local search engine for:
 * - Songs (Song number, exact/partial title, lyrics, sections, author, CCLI, tags, category)
 * - Scriptures (Book names, abbreviations, chapters, verses, ranges, multi-word phrases, verse content)
 * - Generic library items (Presentations, Media, Schedule)
 * 
 * Runs 100% OFFLINE with ZERO cloud dependencies or network calls.
 */

import { Song, ScriptureVerse } from '../types';
import { BIBLE_BOOKS, BibleBook } from '../data/bibleEngine';
import { AUTHENTIC_VERSES_DB } from '../data/fullBibleData';

export interface SongSearchResult {
  song: Song;
  score: number;
  matchReasons: string[];
}

export interface ScriptureParsedReference {
  type: 'full_reference' | 'chapter' | 'book_only' | 'verse_cross_bible' | 'number_only' | 'text_query';
  book?: BibleBook;
  chapter?: number;
  startVerse?: number;
  endVerse?: number;
  cleanedQuery: string;
}

export class OfflineSearchEngine {
  /**
   * Punctuation-tolerant text normalization for search matching.
   * Strips extraneous punctuation, lowercases, and collapses whitespaces.
   */
  static normalizeText(text: string | null | undefined): { normalized: string; tokens: string[] } {
    if (!text) return { normalized: '', tokens: [] };
    
    // Replace punctuation with spaces to prevent word concatenation (e.g., "Holy,Holy" -> "holy holy")
    const cleaned = text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'“”‘’—–\[\]\\<>+@]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const tokens = cleaned.length > 0 ? cleaned.split(' ').filter(t => t.length > 0) : [];
    return { normalized: cleaned, tokens };
  }

  /**
   * Extracts song number if present from number field, id ('hymn-31'), or title ('31. Holy...')
   */
  static extractSongNumber(song: Song): number | null {
    if (typeof (song as any).number === 'number') {
      return (song as any).number;
    }
    if (typeof (song as any).songNumber === 'number') {
      return (song as any).songNumber;
    }
    if (typeof (song as any).songNumber === 'string') {
      const parsed = parseInt((song as any).songNumber, 10);
      if (!isNaN(parsed)) return parsed;
    }
    
    // Check id (e.g. 'hymn-31' or 'song-31')
    if (song.id) {
      const idMatch = song.id.match(/(?:hymn|song)[-_](\d+)/i);
      if (idMatch) {
        return parseInt(idMatch[1], 10);
      }
    }

    // Check title prefix (e.g. '31. Title' or '31 - Title' or '#31 Title')
    if (song.title) {
      const titleMatch = song.title.trim().match(/^#?(\d+)(?:[.\s\-_:]|\s|$)/);
      if (titleMatch) {
        return parseInt(titleMatch[1], 10);
      }
    }

    return null;
  }

  /**
   * Normalizes category of a song into 'Hymns' | 'Special Number'
   */
  static getNormalizedCategory(song: Song): 'Hymns' | 'Special Number' {
    const cat = (song.category || '').toLowerCase();
    if (cat.includes('special') || (song.tags && song.tags.some(t => t.toLowerCase().includes('special')))) {
      return 'Special Number';
    }
    return 'Hymns';
  }

  /**
   * Search songs with tiered ranking, partial token matching, lyrics & metadata inspection.
   */
  static searchSongs(
    songs: Song[],
    rawQuery: string,
    categoryFilter: 'All' | 'Hymns' | 'Special Number' = 'All'
  ): SongSearchResult[] {
    const { normalized: qNorm, tokens: qTokens } = this.normalizeText(rawQuery);

    // Filter by category first
    let candidateSongs = songs;
    if (categoryFilter !== 'All') {
      candidateSongs = songs.filter(s => this.getNormalizedCategory(s) === categoryFilter);
    }

    // Empty query returns all candidate songs in natural order
    if (!qNorm || qTokens.length === 0) {
      return candidateSongs.map(song => ({
        song,
        score: 0,
        matchReasons: ['default']
      }));
    }

    const isNumericQuery = /^\d+$/.test(qNorm) || /^#\d+$/.test(rawQuery.trim());
    const queryNum = isNumericQuery ? parseInt(qNorm.replace('#', ''), 10) : null;

    const scoredResults: SongSearchResult[] = [];

    for (const song of candidateSongs) {
      let score = 0;
      const matchReasons: string[] = [];

      const songNumber = this.extractSongNumber(song);
      const { normalized: titleNorm, tokens: titleTokens } = this.normalizeText(song.title);
      
      const titleCleaned = song.title.replace(/^#?\d+[\.\s\-_:]+/, '').trim();
      const { normalized: titleCleanedNorm, tokens: titleCleanedTokens } = this.normalizeText(titleCleaned);

      const combinedLyrics = (song.lyrics || '') + ' ' + (song.sections ? song.sections.map(s => `${s.name} ${s.text}`).join(' ') : '');
      const { normalized: lyricsNorm, tokens: lyricsTokens } = this.normalizeText(combinedLyrics);
      const { normalized: authorNorm, tokens: authorTokens } = this.normalizeText(song.author || '');
      const ccliStr = (song.ccli || song.ccliNumber || '').toString().toLowerCase().trim();
      const tagsStr = (song.tags || []).join(' ').toLowerCase();

      // 1. Song Number Match (Tier 1: 1000 - 1500)
      if (queryNum !== null && songNumber !== null) {
        if (songNumber === queryNum) {
          score += 1500;
          matchReasons.push(`Song #${songNumber} exact number match`);
        } else if (songNumber.toString().startsWith(queryNum.toString())) {
          score += 600;
          matchReasons.push(`Song #${songNumber} starts with ${queryNum}`);
        }
      }

      // 2. Exact Title Match (Tier 2: 500)
      if (titleNorm === qNorm || titleCleanedNorm === qNorm) {
        score += 500;
        matchReasons.push('Exact title match');
      } else if (titleNorm.startsWith(qNorm) || titleCleanedNorm.startsWith(qNorm)) {
        // 3. Title starts with query (Tier 3: 400)
        score += 400;
        matchReasons.push('Title starts with query');
      } else if (titleNorm.includes(qNorm) || titleCleanedNorm.includes(qNorm)) {
        // 4. Title contains entire query phrase (Tier 4: 300)
        score += 300;
        matchReasons.push('Title contains phrase');
      }

      // 5. Title contains all tokens (Tier 5: 200)
      if (qTokens.length > 1 && (
        qTokens.every(t => titleTokens.includes(t) || titleNorm.includes(t)) ||
        qTokens.every(t => titleCleanedTokens.includes(t) || titleCleanedNorm.includes(t))
      )) {
        score += 220;
        matchReasons.push('All words present in title');
      }

      // 6. Exact Lyric Phrase Match (Tier 6: 150)
      if (lyricsNorm.includes(qNorm)) {
        score += 150;
        matchReasons.push('Exact lyric phrase match');
      }

      // 7. Multi-word lyrics / sections token match (Tier 7: 100)
      const allTokensInLyrics = qTokens.every(t => 
        lyricsTokens.includes(t) || 
        lyricsNorm.includes(t) || 
        titleTokens.includes(t)
      );

      if (allTokensInLyrics && qTokens.length > 1) {
        score += 100;
        matchReasons.push('All query words in lyrics/content');
      }

      // 8. Author / Composer Match (Tier 8: 80)
      if (authorNorm.includes(qNorm)) {
        score += 80;
        matchReasons.push('Author/composer match');
      } else if (qTokens.length > 1 && qTokens.every(t => authorNorm.includes(t))) {
        score += 60;
        matchReasons.push('Author token match');
      }

      // 9. CCLI match
      if (ccliStr && (ccliStr === qNorm || ccliStr.includes(qNorm))) {
        score += 90;
        matchReasons.push(`CCLI #${ccliStr} match`);
      }

      // 10. Tags or Category match
      if (tagsStr.includes(qNorm) || (song.category && song.category.toLowerCase().includes(qNorm))) {
        score += 50;
        matchReasons.push('Category / Tag match');
      }

      // 11. Partial token match fallback (if single token matches start of words)
      if (score === 0) {
        const anyTitleTokenPartial = qTokens.some(qt => titleTokens.some(tt => tt.startsWith(qt) || tt.includes(qt)));
        const anyLyricTokenPartial = qTokens.some(qt => lyricsTokens.some(lt => lt.startsWith(qt)));

        if (anyTitleTokenPartial) {
          score += 40;
          matchReasons.push('Partial title match');
        } else if (anyLyricTokenPartial) {
          score += 20;
          matchReasons.push('Partial lyric match');
        }
      }

      if (score > 0) {
        scoredResults.push({ song, score, matchReasons });
      }
    }

    // Sort descending by score, then ascending by song title
    scoredResults.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.song.title.localeCompare(b.song.title);
    });

    return scoredResults;
  }

  /**
   * Helper returning plain Song[] filtered and ranked
   */
  static filterSongs(
    songs: Song[],
    rawQuery: string,
    categoryFilter: 'All' | 'Hymns' | 'Special Number' = 'All'
  ): Song[] {
    return this.searchSongs(songs, rawQuery, categoryFilter).map(r => r.song);
  }

  /**
   * Parse Scripture search query into reference structure with full support for:
   * - "John 3:16", "John 3:16-18", "1 Cor 13:4-8", "Awit 23:1-6"
   * - "John 3", "Genesis 1", "Awit 23"
   * - "John", "Genesis", "Awit", "Rom" (Book only)
   * - "3:16", "1:1", "23:1" (Chapter:Verse cross-bible)
   * - "3" (Standalone chapter / number)
   * - "born again", "for God so loved", "love" (Text search query)
   */
  static parseScriptureReference(query: string): ScriptureParsedReference {
    const trimmed = query.trim();
    if (!trimmed) {
      return { type: 'text_query', cleanedQuery: '' };
    }

    // Pattern 1: Book + Chapter:Verse Range (e.g. "John 3:16-18" or "1 John 1:9" or "Awit 23:1")
    const fullRefMatch = trimmed.match(/^((?:\d\s+)?[a-zA-Z\s]+?)\s+(\d+)\s*[:.]\s*(\d+)(?:\s*[-–—]\s*(\d+))?$/i);
    if (fullRefMatch) {
      const bookName = fullRefMatch[1].trim();
      const chapter = parseInt(fullRefMatch[2], 10);
      const startVerse = parseInt(fullRefMatch[3], 10);
      const endVerse = fullRefMatch[4] ? parseInt(fullRefMatch[4], 10) : startVerse;

      const book = this.findBibleBook(bookName);
      if (book) {
        return {
          type: 'full_reference',
          book,
          chapter,
          startVerse,
          endVerse,
          cleanedQuery: trimmed
        };
      }
    }

    // Pattern 2: Book + Chapter (e.g. "John 3", "Gen 1", "1 Cor 13", "Awit 23")
    const bookChapMatch = trimmed.match(/^((?:\d\s+)?[a-zA-Z\s]+?)\s+(\d+)$/i);
    if (bookChapMatch) {
      const bookName = bookChapMatch[1].trim();
      const chapter = parseInt(bookChapMatch[2], 10);

      const book = this.findBibleBook(bookName);
      if (book) {
        return {
          type: 'chapter',
          book,
          chapter,
          cleanedQuery: trimmed
        };
      }
    }

    // Pattern 3: Chapter:Verse only without book (e.g. "3:16", "1:1", "23:1", "3.16")
    const crossVerseMatch = trimmed.match(/^(\d+)\s*[:.]\s*(\d+)$/);
    if (crossVerseMatch) {
      const chapter = parseInt(crossVerseMatch[1], 10);
      const verse = parseInt(crossVerseMatch[2], 10);
      return {
        type: 'verse_cross_bible',
        chapter,
        startVerse: verse,
        endVerse: verse,
        cleanedQuery: trimmed
      };
    }

    // Pattern 4: Book name or abbreviation only (e.g. "John", "Genesis", "Awit", "Rom", "1 Cor")
    const bookOnly = this.findBibleBook(trimmed);
    if (bookOnly) {
      return {
        type: 'book_only',
        book: bookOnly,
        chapter: 1,
        cleanedQuery: trimmed
      };
    }

    // Pattern 5: Standalone number query (e.g. "3", "23")
    const numMatch = trimmed.match(/^(\d+)$/);
    if (numMatch) {
      return {
        type: 'number_only',
        chapter: parseInt(numMatch[1], 10),
        cleanedQuery: trimmed
      };
    }

    // Fallback: Text Query (e.g. "born again", "for God so loved")
    return {
      type: 'text_query',
      cleanedQuery: trimmed
    };
  }

  /**
   * Find Bible Book by name (English or Tagalog), ID, or abbreviation
   */
  static findBibleBook(query: string): BibleBook | undefined {
    const q = query.toLowerCase().trim();
    if (!q) return undefined;

    // Direct exact match
    const exact = BIBLE_BOOKS.find(b =>
      b.id.toLowerCase() === q ||
      b.name.toLowerCase() === q ||
      b.nameTagalog.toLowerCase() === q
    );
    if (exact) return exact;

    // Abbreviation exact match
    const byAbbr = BIBLE_BOOKS.find(b =>
      b.abbreviations.some(abbr => abbr.toLowerCase() === q)
    );
    if (byAbbr) return byAbbr;

    // Starts-with match on book name or Tagalog name
    const startsWith = BIBLE_BOOKS.find(b =>
      b.name.toLowerCase().startsWith(q) ||
      b.nameTagalog.toLowerCase().startsWith(q)
    );
    if (startsWith) return startsWith;

    return undefined;
  }

  /**
   * Searches scripture verses in in-memory corpus with deterministic ranking and support for:
   * - exact references (John 3:16)
   * - book + chapter (John 3)
   * - book only (John -> returns John chapter 1)
   * - chapter:verse (3:16 -> returns matching 3:16 across books)
   * - multi-word full-text queries ("born again", "for God so loved")
   */
  static searchScriptures(
    query: string,
    translation: 'KJV' | 'Tagalog' | 'Both' | 'ALL' = 'ALL',
    corpus: {
      kjvData: Record<string, string> | null;
      tagalogData: Record<string, string> | null;
      getVerseCount: (bookId: string, chapter: number) => number;
    },
    activeBookId?: string
  ): ScriptureVerse[] {
    const q = query.trim();
    if (!q) return [];

    const parsed = this.parseScriptureReference(q);
    const trans = translation.toUpperCase();
    const includeKjv = trans === 'ALL' || trans === 'KJV' || trans === 'BOTH';
    const includeTag = trans === 'ALL' || trans === 'TAGALOG' || trans === 'BOTH';

    const getVerseText = (key: string, tr: 'KJV' | 'Tagalog'): string => {
      if (tr === 'KJV') {
        return (corpus.kjvData && corpus.kjvData[key]) || AUTHENTIC_VERSES_DB[key]?.kjv || '';
      }
      return (corpus.tagalogData && corpus.tagalogData[key]) || AUTHENTIC_VERSES_DB[key]?.tagalog || '';
    };

    // Case 1: Full reference (e.g. John 3:16 or John 3:16-18)
    if (parsed.type === 'full_reference' && parsed.book && parsed.chapter && parsed.startVerse) {
      const book = parsed.book;
      const chapter = parsed.chapter;
      const startV = parsed.startVerse;
      const endV = parsed.endVerse || startV;
      const results: ScriptureVerse[] = [];

      for (let v = startV; v <= endV; v++) {
        const key = `${book.id}-${chapter}-${v}`;
        if (includeKjv) {
          const text = getVerseText(key, 'KJV');
          if (text) {
            results.push({
              id: `${book.id.toLowerCase()}-${chapter}-${v}-kjv`,
              translation: 'KJV',
              book: book.name,
              chapter,
              verse: v,
              reference: `${book.name} ${chapter}:${v}`,
              text
            });
          }
        }
        if (includeTag) {
          const text = getVerseText(key, 'Tagalog');
          if (text) {
            results.push({
              id: `${book.id.toLowerCase()}-${chapter}-${v}-tag`,
              translation: 'Tagalog',
              book: book.nameTagalog,
              chapter,
              verse: v,
              reference: `${book.nameTagalog} ${chapter}:${v}`,
              text
            });
          }
        }
      }
      return results;
    }

    // Case 2: Book + Chapter (e.g. John 3, Genesis 1)
    if (parsed.type === 'chapter' && parsed.book && parsed.chapter) {
      const book = parsed.book;
      const chapter = parsed.chapter;
      const totalVerses = corpus.getVerseCount(book.id, chapter);
      const results: ScriptureVerse[] = [];

      for (let v = 1; v <= totalVerses; v++) {
        const key = `${book.id}-${chapter}-${v}`;
        if (includeKjv) {
          const text = getVerseText(key, 'KJV');
          if (text) {
            results.push({
              id: `${book.id.toLowerCase()}-${chapter}-${v}-kjv`,
              translation: 'KJV',
              book: book.name,
              chapter,
              verse: v,
              reference: `${book.name} ${chapter}:${v}`,
              text
            });
          }
        }
        if (includeTag) {
          const text = getVerseText(key, 'Tagalog');
          if (text) {
            results.push({
              id: `${book.id.toLowerCase()}-${chapter}-${v}-tag`,
              translation: 'Tagalog',
              book: book.nameTagalog,
              chapter,
              verse: v,
              reference: `${book.nameTagalog} ${chapter}:${v}`,
              text
            });
          }
        }
      }
      return results;
    }

    // Case 3: Book only (e.g. John, Genesis, Awit) -> Returns Chapter 1 of that book
    if (parsed.type === 'book_only' && parsed.book) {
      const book = parsed.book;
      const totalVerses = corpus.getVerseCount(book.id, 1);
      const results: ScriptureVerse[] = [];

      for (let v = 1; v <= totalVerses; v++) {
        const key = `${book.id}-1-${v}`;
        if (includeKjv) {
          const text = getVerseText(key, 'KJV');
          if (text) {
            results.push({
              id: `${book.id.toLowerCase()}-1-${v}-kjv`,
              translation: 'KJV',
              book: book.name,
              chapter: 1,
              verse: v,
              reference: `${book.name} 1:${v}`,
              text
            });
          }
        }
        if (includeTag) {
          const text = getVerseText(key, 'Tagalog');
          if (text) {
            results.push({
              id: `${book.id.toLowerCase()}-1-${v}-tag`,
              translation: 'Tagalog',
              book: book.nameTagalog,
              chapter: 1,
              verse: v,
              reference: `${book.nameTagalog} 1:${v}`,
              text
            });
          }
        }
      }
      return results;
    }

    // Case 4: Chapter:Verse query cross-bible (e.g. 3:16)
    if (parsed.type === 'verse_cross_bible' && parsed.chapter && parsed.startVerse) {
      const targetCh = parsed.chapter;
      const targetV = parsed.startVerse;
      const results: { verse: ScriptureVerse; priority: number }[] = [];

      // Famous books with 3:16 (John, 2 Tim, 1 Cor, Col, 1 John, Gen) prioritize higher
      const priorityBooks = ['JHN', '2TI', '1CO', 'COL', '1JN', 'GEN', 'REV', 'ROM', 'EPH'];

      for (const book of BIBLE_BOOKS) {
        if (targetCh <= book.chapters) {
          const totalV = corpus.getVerseCount(book.id, targetCh);
          if (targetV <= totalV) {
            const key = `${book.id}-${targetCh}-${targetV}`;
            const prioIdx = priorityBooks.indexOf(book.id);
            const prio = prioIdx !== -1 ? 100 - prioIdx : 10;

            if (includeKjv) {
              const text = getVerseText(key, 'KJV');
              if (text) {
                results.push({
                  priority: prio,
                  verse: {
                    id: `${book.id.toLowerCase()}-${targetCh}-${targetV}-kjv`,
                    translation: 'KJV',
                    book: book.name,
                    chapter: targetCh,
                    verse: targetV,
                    reference: `${book.name} ${targetCh}:${targetV}`,
                    text
                  }
                });
              }
            }
            if (includeTag) {
              const text = getVerseText(key, 'Tagalog');
              if (text) {
                results.push({
                  priority: prio,
                  verse: {
                    id: `${book.id.toLowerCase()}-${targetCh}-${targetV}-tag`,
                    translation: 'Tagalog',
                    book: book.nameTagalog,
                    chapter: targetCh,
                    verse: targetV,
                    reference: `${book.nameTagalog} ${targetCh}:${targetV}`,
                    text
                  }
                });
              }
            }
          }
        }
      }

      results.sort((a, b) => b.priority - a.priority);
      return results.map(r => r.verse);
    }

    // Case 5: Standalone number query (e.g. "3")
    if (parsed.type === 'number_only' && parsed.chapter) {
      const targetCh = parsed.chapter;
      const targetBook = activeBookId ? BIBLE_BOOKS.find(b => b.id === activeBookId) || BIBLE_BOOKS[42] : BIBLE_BOOKS[42]; // default John
      const totalVerses = corpus.getVerseCount(targetBook.id, targetCh);
      const results: ScriptureVerse[] = [];

      for (let v = 1; v <= totalVerses; v++) {
        const key = `${targetBook.id}-${targetCh}-${v}`;
        if (includeKjv) {
          const text = getVerseText(key, 'KJV');
          if (text) {
            results.push({
              id: `${targetBook.id.toLowerCase()}-${targetCh}-${v}-kjv`,
              translation: 'KJV',
              book: targetBook.name,
              chapter: targetCh,
              verse: v,
              reference: `${targetBook.name} ${targetCh}:${v}`,
              text
            });
          }
        }
        if (includeTag) {
          const text = getVerseText(key, 'Tagalog');
          if (text) {
            results.push({
              id: `${targetBook.id.toLowerCase()}-${targetCh}-${v}-tag`,
              translation: 'Tagalog',
              book: targetBook.nameTagalog,
              chapter: targetCh,
              verse: v,
              reference: `${targetBook.nameTagalog} ${targetCh}:${v}`,
              text
            });
          }
        }
      }
      return results;
    }

    // Case 6: Full-text Search across Bible corpus
    const { normalized: qNorm, tokens: qTokens } = this.normalizeText(q);
    if (!qNorm || qTokens.length === 0) return [];

    const scoredResults: { verse: ScriptureVerse; score: number }[] = [];
    const maxResults = 120;

    // Helper to search a dictionary
    const searchDict = (dict: Record<string, string>, transLabel: 'KJV' | 'Tagalog') => {
      for (const [key, rawText] of Object.entries(dict)) {
        if (!rawText) continue;
        const { normalized: textNorm, tokens: textTokens } = this.normalizeText(rawText);

        let score = 0;

        // Exact phrase match
        if (textNorm.includes(qNorm)) {
          score += 500;
        } else if (qTokens.length > 1 && qTokens.every(t => textTokens.includes(t) || textNorm.includes(t))) {
          // All tokens match
          score += 300;
        } else if (qTokens.length > 1) {
          // Majority token match
          const matchCount = qTokens.filter(t => textTokens.includes(t) || textNorm.includes(t)).length;
          if (matchCount >= Math.ceil(qTokens.length * 0.6)) {
            score += 100 * (matchCount / qTokens.length);
          }
        } else if (qTokens.length === 1 && (textTokens.includes(qTokens[0]) || textNorm.includes(qTokens[0]))) {
          score += 200;
        }

        if (score > 0) {
          const [bookId, chapStr, vStr] = key.split('-');
          const book = BIBLE_BOOKS.find(b => b.id === bookId);
          if (book) {
            const chap = parseInt(chapStr, 10);
            const vNum = parseInt(vStr, 10);
            const bookName = transLabel === 'Tagalog' ? book.nameTagalog : book.name;

            scoredResults.push({
              score,
              verse: {
                id: `${bookId.toLowerCase()}-${chap}-${vNum}-${transLabel === 'Tagalog' ? 'tag' : 'kjv'}`,
                translation: transLabel,
                book: bookName,
                chapter: chap,
                verse: vNum,
                reference: `${bookName} ${chap}:${vNum}`,
                text: rawText
              }
            });
          }
        }
      }
    };

    if (includeKjv) {
      if (corpus.kjvData && Object.keys(corpus.kjvData).length > 0) {
        searchDict(corpus.kjvData, 'KJV');
      } else {
        const kjvFallback: Record<string, string> = {};
        for (const [k, v] of Object.entries(AUTHENTIC_VERSES_DB)) {
          if (v.kjv) kjvFallback[k] = v.kjv;
        }
        searchDict(kjvFallback, 'KJV');
      }
    }

    if (includeTag) {
      if (corpus.tagalogData && Object.keys(corpus.tagalogData).length > 0) {
        searchDict(corpus.tagalogData, 'Tagalog');
      } else {
        const tagFallback: Record<string, string> = {};
        for (const [k, v] of Object.entries(AUTHENTIC_VERSES_DB)) {
          if (v.tagalog) tagFallback[k] = v.tagalog;
        }
        searchDict(tagFallback, 'Tagalog');
      }
    }

    // Sort descending by score, then canonical book order
    scoredResults.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.verse.book !== b.verse.book) return a.verse.book.localeCompare(b.verse.book);
      if (a.verse.chapter !== b.verse.chapter) return a.verse.chapter - b.verse.chapter;
      return a.verse.verse - b.verse.verse;
    });

    return scoredResults.slice(0, maxResults).map(r => r.verse);
  }

  /**
   * Generic offline search for presentations, media, or schedule items
   */
  static searchGeneric<T>(
    items: T[],
    rawQuery: string,
    getSearchableFields: (item: T) => (string | undefined | null)[]
  ): T[] {
    const { normalized: qNorm, tokens: qTokens } = this.normalizeText(rawQuery);
    if (!qNorm || qTokens.length === 0) return items;

    const scored = items.map(item => {
      const fields = getSearchableFields(item).filter(Boolean) as string[];
      let score = 0;

      for (const field of fields) {
        const { normalized: fNorm, tokens: fTokens } = this.normalizeText(field);
        if (fNorm === qNorm) {
          score += 500;
        } else if (fNorm.startsWith(qNorm)) {
          score += 300;
        } else if (fNorm.includes(qNorm)) {
          score += 200;
        } else if (qTokens.every(t => fTokens.includes(t) || fNorm.includes(t))) {
          score += 150;
        } else if (qTokens.some(t => fTokens.includes(t) || fNorm.includes(t))) {
          score += 50;
        }
      }

      return { item, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(s => s.item);
  }
}

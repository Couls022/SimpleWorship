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

export interface SongIndexEntry {
  songNumber: number | null;
  titleNorm: string;
  titleTokens: string[];
  titleCleanedNorm: string;
  titleCleanedTokens: string[];
  lyricsNorm: string;
  lyricsTokens: string[];
  authorNorm: string;
  ccliStr: string;
  tagsStr: string;
}

export class OfflineSearchEngine {
  private static songIndexCache = new WeakMap<Song, SongIndexEntry>();
  private static bibleNormalizedCache = new Map<string, { normalized: string; tokens: string[] }>();

  /**
   * Fast indexed retrieval of pre-normalized song metadata with zero memory leaks (WeakMap).
   */
  static getSongIndex(song: Song): SongIndexEntry {
    let entry = this.songIndexCache.get(song);
    if (!entry) {
      const songNumber = this.extractSongNumber(song);
      const { normalized: titleNorm, tokens: titleTokens } = this.normalizeText(song.title);
      const titleCleaned = (song.title || '').replace(/^#?\d+[\.\s\-_:]+/, '').trim();
      const { normalized: titleCleanedNorm, tokens: titleCleanedTokens } = this.normalizeText(titleCleaned);
      const combinedLyrics = (song.lyrics || '') + ' ' + (song.sections ? song.sections.map(s => `${s.name || ''} ${s.text || ''}`).join(' ') : '');
      const { normalized: lyricsNorm, tokens: lyricsTokens } = this.normalizeText(combinedLyrics);
      const { normalized: authorNorm } = this.normalizeText(song.author || '');
      const ccliStr = (song.ccli || (song as any).ccliNumber || '').toString().toLowerCase().trim();
      const tagsStr = (song.tags || []).join(' ').toLowerCase();

      entry = {
        songNumber,
        titleNorm,
        titleTokens,
        titleCleanedNorm,
        titleCleanedTokens,
        lyricsNorm,
        lyricsTokens,
        authorNorm,
        ccliStr,
        tagsStr
      };
      this.songIndexCache.set(song, entry);
    }
    return entry;
  }

  /**
   * Fast LRU-style cached normalization for Bible verses to prevent 60k regex passes per keystroke.
   */
  static getCachedVerseNorm(rawText: string): { normalized: string; tokens: string[] } {
    let hit = this.bibleNormalizedCache.get(rawText);
    if (!hit) {
      hit = this.normalizeText(rawText);
      if (this.bibleNormalizedCache.size > 25000) {
        this.bibleNormalizedCache.clear();
      }
      this.bibleNormalizedCache.set(rawText, hit);
    }
    return hit;
  }
  /**
   * Punctuation-tolerant text normalization for search matching.
   * Strips extraneous punctuation, lowercases, and collapses whitespaces.
   */
  static normalizeText(text: any): { normalized: string; tokens: string[] } {
    if (text === null || text === undefined) return { normalized: '', tokens: [] };
    const str = typeof text === 'string' ? text : String(text);
    if (!str.trim()) return { normalized: '', tokens: [] };
    
    // Replace punctuation with spaces to prevent word concatenation (e.g., "Holy,Holy" -> "holy holy")
    const cleaned = str
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
   * Natural alphanumeric comparator for song titles:
   * 1. Titles starting with numbers ALWAYS precede letters (0-9 before A-Z).
   * 2. Single digit numbers (1-9) ALWAYS precede double digits (10-99), which precede triple digits (100-999).
   * 3. Uses standard natural numeric collation for the rest of the string.
   */
  static compareTitles(a?: string | null, b?: string | null): number {
    const strA = (a || '').trim();
    const strB = (b || '').trim();

    if (!strA && !strB) return 0;
    if (!strA) return 1;
    if (!strB) return -1;

    // Strip leading decorations/symbols like #, (, [, ', ", `, <, >, -, .
    const cleanA = strA.replace(/^[#(\[\x27"`<>\-.\s]+/, '');
    const cleanB = strB.replace(/^[#(\[\x27"`<>\-.\s]+/, '');

    const aStartsWithNum = /^\d/.test(cleanA);
    const bStartsWithNum = /^\d/.test(cleanB);

    // Rule 1: Numbers always come BEFORE letters/words
    if (aStartsWithNum && !bStartsWithNum) return -1;
    if (!aStartsWithNum && bStartsWithNum) return 1;

    // Rule 2: If both start with numbers, compare the leading numeric values:
    // This guarantees single digits (1..9) < double digits (10..99) < triple digits (100..999)
    if (aStartsWithNum && bStartsWithNum) {
      const matchA = cleanA.match(/^(\d+)/);
      const matchB = cleanB.match(/^(\d+)/);
      const numA = matchA ? parseInt(matchA[1], 10) : 0;
      const numB = matchB ? parseInt(matchB[1], 10) : 0;

      if (numA !== numB) {
        return numA - numB;
      }
    }

    // Rule 3: Use Intl.Collator natural numeric comparison
    return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
  }

  /**
   * Search songs with tiered ranking, partial token matching, lyrics & metadata inspection.
   */
  static searchSongs(
    songsOrQuery: Song[] | string,
    queryOrSongs: string | Song[],
    categoryFilter: 'All' | 'Hymns' | 'Special Number' = 'All'
  ): SongSearchResult[] {
    let songs: Song[];
    let rawQuery: string;

    if (Array.isArray(songsOrQuery)) {
      songs = songsOrQuery;
      rawQuery = typeof queryOrSongs === 'string' ? queryOrSongs : '';
    } else {
      rawQuery = typeof songsOrQuery === 'string' ? songsOrQuery : '';
      songs = Array.isArray(queryOrSongs) ? queryOrSongs : [];
    }

    const { normalized: qNorm, tokens: qTokens } = this.normalizeText(rawQuery);

    // Filter by category first
    let candidateSongs = songs;
    if (categoryFilter !== 'All') {
      candidateSongs = songs.filter(s => this.getNormalizedCategory(s) === categoryFilter);
    }

    // Empty query returns all candidate songs in natural title order (numbers first, single < double < triple digits, then letters A-Z)
    if (!qNorm || qTokens.length === 0) {
      const sortedCandidates = [...candidateSongs].sort((a, b) => this.compareTitles(a.title, b.title));
      return sortedCandidates.map(song => ({
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

      const idx = this.getSongIndex(song);
      const songNumber = idx.songNumber;
      const titleNorm = idx.titleNorm;
      const titleTokens = idx.titleTokens;
      const titleCleanedNorm = idx.titleCleanedNorm;
      const titleCleanedTokens = idx.titleCleanedTokens;
      const lyricsNorm = idx.lyricsNorm;
      const lyricsTokens = idx.lyricsTokens;
      const authorNorm = idx.authorNorm;
      const ccliStr = idx.ccliStr;
      const tagsStr = idx.tagsStr;

      if (isNumericQuery && queryNum !== null) {
        // --- 1. ACCURATE NUMERIC SEARCH ---
        // A. Exact Song Number Match (Tier 1: 2000)
        if (songNumber === queryNum) {
          score += 2000;
          matchReasons.push(`Song #${songNumber} exact number match`);
        }

        // B. Title starts with this exact number prefix (e.g., "1. Amazing Grace", "#1 Song", but NOT "11" or "10,000")
        const titleNumMatch = (song.title || '').trim().match(/^#?(\d+)(?:\D|$)/);
        if (titleNumMatch && parseInt(titleNumMatch[1], 10) === queryNum) {
          score += 1800;
          matchReasons.push(`Title starts with song number ${queryNum}`);
        }

        // C. Distinct standalone number token in title (e.g. "Psalm 23" when searching 23)
        if (titleTokens.includes(queryNum.toString()) || titleCleanedTokens.includes(queryNum.toString())) {
          score += 1500;
          matchReasons.push(`Title contains number ${queryNum}`);
        }

        // D. Comma-separated or clean numeric equivalence (e.g. searching "10000" matches "10,000 Reasons")
        const cleanTitleDigits = (song.title || '').replace(/[^\d]/g, '');
        if (cleanTitleDigits && parseInt(cleanTitleDigits, 10) === queryNum) {
          score += 1200;
          matchReasons.push(`Number match ${queryNum}`);
        }
      } else {
        // --- 2. ACCURATE TITLE, WORDS, AND LYRICS SEARCH ---
        // A. Exact Title Match
        if (titleNorm === qNorm || titleCleanedNorm === qNorm) {
          score += 1500;
          matchReasons.push('Exact title match');
        } else if (titleNorm.startsWith(qNorm) || titleCleanedNorm.startsWith(qNorm)) {
          // B. Title starts with query phrase
          score += 1200;
          matchReasons.push('Title starts with query');
        } else if (titleNorm.includes(qNorm) || titleCleanedNorm.includes(qNorm)) {
          // C. Title contains entire query phrase
          score += 1000;
          matchReasons.push('Title contains phrase');
        } else if (
          qTokens.length > 1 &&
          (qTokens.every((t) => titleTokens.some((tt) => tt.startsWith(t) || tt === t) || titleNorm.includes(t)) ||
            qTokens.every((t) => titleCleanedTokens.some((tt) => tt.startsWith(t) || tt === t) || titleCleanedNorm.includes(t)))
        ) {
          // D. All search words present in title
          score += 800;
          matchReasons.push('All query words in title');
        }

        // E. Exact Lyric Phrase Match
        if (qNorm.length >= 3 && lyricsNorm.includes(qNorm)) {
          score += 600;
          matchReasons.push('Exact lyric phrase match');
        } else if (
          qTokens.length > 1 &&
          qTokens.every((t) => lyricsNorm.includes(t) || lyricsTokens.includes(t))
        ) {
          // F. All search words present in lyrics
          score += 400;
          matchReasons.push('All query words present in lyrics');
        } else if (
          qTokens.length === 1 &&
          qNorm.length >= 3 &&
          lyricsTokens.includes(qNorm)
        ) {
          // G. Exact whole word match in lyrics
          score += 300;
          matchReasons.push('Exact word found in lyrics');
        }

        // H. Author / Composer Match
        if (authorNorm.includes(qNorm)) {
          score += 250;
          matchReasons.push('Author/composer match');
        } else if (qTokens.length > 1 && qTokens.every((t) => authorNorm.includes(t))) {
          score += 180;
          matchReasons.push('Author token match');
        }

        // I. CCLI Match
        if (ccliStr && (ccliStr === qNorm || ccliStr.includes(qNorm))) {
          score += 200;
          matchReasons.push(`CCLI #${ccliStr} match`);
        }

        // J. Tags or Category Match
        if (tagsStr.includes(qNorm) || (song.category && song.category.toLowerCase().includes(qNorm))) {
          score += 150;
          matchReasons.push('Category / Tag match');
        }

        // K. Prefix match on title words only (for fast typing in search box, e.g. "vic" matches "Victory")
        if (score === 0 && qNorm.length >= 2) {
          if (qTokens.every((qt) => titleTokens.some((tt) => tt.startsWith(qt)) || titleCleanedTokens.some((tt) => tt.startsWith(qt)))) {
            score += 100;
            matchReasons.push('Title prefix match');
          }
        }
      }

      if (score > 0) {
        scoredResults.push({ song, score, matchReasons });
      }
    }

    // Sort descending by score, then ascending by song title with natural title comparison
    scoredResults.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return this.compareTitles(a.song.title, b.song.title);
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
  static parseScriptureReference(query: string | null | undefined): ScriptureParsedReference {
    const trimmed = typeof query === 'string' ? query.trim() : String(query || '').trim();
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
      const qTokenCount = qTokens.length;
      for (const [key, rawText] of Object.entries(dict)) {
        if (!rawText) continue;

        // Fast native pre-check to bypass 99.5% of verses before regex/token allocations
        const rawLower = rawText.toLowerCase();
        if (qTokenCount === 1) {
          if (!rawLower.includes(qTokens[0])) continue;
        } else {
          let hasAny = false;
          for (let i = 0; i < qTokenCount; i++) {
            if (rawLower.includes(qTokens[i])) {
              hasAny = true;
              break;
            }
          }
          if (!hasAny) continue;
        }

        const { normalized: textNorm, tokens: textTokens } = this.getCachedVerseNorm(rawText);

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

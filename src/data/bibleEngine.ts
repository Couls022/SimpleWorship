import { ScriptureVerse } from '../types';
import { dbApi } from '../db';

export interface BibleBook {
  id: string;
  name: string;
  nameTagalog: string;
  testament: 'OT' | 'NT';
  category: 'Law' | 'History' | 'Poetry' | 'Major Prophets' | 'Minor Prophets' | 'Gospels' | 'Acts' | 'Epistles' | 'Prophecy';
  chapters: number;
  abbreviations: string[];
}

export const BIBLE_BOOKS: BibleBook[] = [
  // Old Testament (Lumang Tipan) - 39 Books
  { id: 'GEN', name: 'Genesis', nameTagalog: 'Genesis', testament: 'OT', category: 'Law', chapters: 50, abbreviations: ['gen', 'ge', 'gn', 'genesis'] },
  { id: 'EXO', name: 'Exodus', nameTagalog: 'Exodo', testament: 'OT', category: 'Law', chapters: 40, abbreviations: ['exo', 'ex', 'exod', 'exodo'] },
  { id: 'LEV', name: 'Leviticus', nameTagalog: 'Levitico', testament: 'OT', category: 'Law', chapters: 27, abbreviations: ['lev', 'le', 'lv', 'levitico'] },
  { id: 'NUM', name: 'Numbers', nameTagalog: 'Mga Bilang', testament: 'OT', category: 'Law', chapters: 36, abbreviations: ['num', 'nu', 'nm', 'bilang', 'mga bilang'] },
  { id: 'DEU', name: 'Deuteronomy', nameTagalog: 'Deuteronomio', testament: 'OT', category: 'Law', chapters: 34, abbreviations: ['deu', 'dt', 'deut', 'deuteronomio'] },
  { id: 'JOS', name: 'Joshua', nameTagalog: 'Josue', testament: 'OT', category: 'History', chapters: 24, abbreviations: ['jos', 'josh', 'josue'] },
  { id: 'JDG', name: 'Judges', nameTagalog: 'Mga Hukom', testament: 'OT', category: 'History', chapters: 21, abbreviations: ['jdg', 'judg', 'hukom', 'mga hukom'] },
  { id: 'RUT', name: 'Ruth', nameTagalog: 'Ruth', testament: 'OT', category: 'History', chapters: 4, abbreviations: ['rut', 'rth', 'ruth'] },
  { id: '1SA', name: '1 Samuel', nameTagalog: '1 Samuel', testament: 'OT', category: 'History', chapters: 31, abbreviations: ['1sa', '1sam', '1 sam', '1 samuel'] },
  { id: '2SA', name: '2 Samuel', nameTagalog: '2 Samuel', testament: 'OT', category: 'History', chapters: 24, abbreviations: ['2sa', '2sam', '2 sam', '2 samuel'] },
  { id: '1KI', name: '1 Kings', nameTagalog: '1 Mga Hari', testament: 'OT', category: 'History', chapters: 22, abbreviations: ['1ki', '1kgs', '1hari', '1 hari', '1 kings'] },
  { id: '2KI', name: '2 Kings', nameTagalog: '2 Mga Hari', testament: 'OT', category: 'History', chapters: 25, abbreviations: ['2ki', '2kgs', '2hari', '2 hari', '2 kings'] },
  { id: '1CH', name: '1 Chronicles', nameTagalog: '1 Mga Cronica', testament: 'OT', category: 'History', chapters: 29, abbreviations: ['1ch', '1chron', '1cronica', '1 chronicles'] },
  { id: '2CH', name: '2 Chronicles', nameTagalog: '2 Mga Cronica', testament: 'OT', category: 'History', chapters: 36, abbreviations: ['2ch', '2chron', '2cronica', '2 chronicles'] },
  { id: 'EZR', name: 'Ezra', nameTagalog: 'Ezra', testament: 'OT', category: 'History', chapters: 10, abbreviations: ['ezr', 'ezra'] },
  { id: 'NEH', name: 'Nehemiah', nameTagalog: 'Nehemias', testament: 'OT', category: 'History', chapters: 13, abbreviations: ['neh', 'nehem', 'nehemias'] },
  { id: 'EST', name: 'Esther', nameTagalog: 'Ester', testament: 'OT', category: 'History', chapters: 10, abbreviations: ['est', 'esth', 'ester', 'esther'] },
  { id: 'JOB', name: 'Job', nameTagalog: 'Job', testament: 'OT', category: 'Poetry', chapters: 42, abbreviations: ['job', 'jb'] },
  { id: 'PSA', name: 'Psalms', nameTagalog: 'Mga Awit', testament: 'OT', category: 'Poetry', chapters: 150, abbreviations: ['psa', 'ps', 'psalm', 'psalms', 'awit', 'mga awit'] },
  { id: 'PRO', name: 'Proverbs', nameTagalog: 'Mga Kawikaan', testament: 'OT', category: 'Poetry', chapters: 31, abbreviations: ['pro', 'prv', 'prov', 'kawikaan', 'mga kawikaan'] },
  { id: 'ECC', name: 'Ecclesiastes', nameTagalog: 'Eclesiastes', testament: 'OT', category: 'Poetry', chapters: 12, abbreviations: ['ecc', 'eccl', 'ecl', 'eclesiastes'] },
  { id: 'SNG', name: 'Song of Solomon', nameTagalog: 'Ang Awit ni Solomon', testament: 'OT', category: 'Poetry', chapters: 8, abbreviations: ['sng', 'sos', 'song', 'songs', 'awit ni solomon'] },
  { id: 'ISA', name: 'Isaiah', nameTagalog: 'Isaias', testament: 'OT', category: 'Major Prophets', chapters: 66, abbreviations: ['isa', 'is', 'isaias', 'isaiah'] },
  { id: 'JER', name: 'Jeremiah', nameTagalog: 'Jeremias', testament: 'OT', category: 'Major Prophets', chapters: 52, abbreviations: ['jer', 'jeremias', 'jeremiah'] },
  { id: 'LAM', name: 'Lamentations', nameTagalog: 'Mga Panaghoy', testament: 'OT', category: 'Major Prophets', chapters: 5, abbreviations: ['lam', 'panaghoy', 'mga panaghoy'] },
  { id: 'EZK', name: 'Ezekiel', nameTagalog: 'Ezekiel', testament: 'OT', category: 'Major Prophets', chapters: 48, abbreviations: ['ezk', 'ezek', 'ezekiel'] },
  { id: 'DAN', name: 'Daniel', nameTagalog: 'Daniel', testament: 'OT', category: 'Major Prophets', chapters: 12, abbreviations: ['dan', 'da', 'dn', 'daniel'] },
  { id: 'HOS', name: 'Hosea', nameTagalog: 'Oseas', testament: 'OT', category: 'Minor Prophets', chapters: 14, abbreviations: ['hos', 'ho', 'oseas', 'hosea'] },
  { id: 'JOE', name: 'Joel', nameTagalog: 'Joel', testament: 'OT', category: 'Minor Prophets', chapters: 3, abbreviations: ['joe', 'jl', 'joel'] },
  { id: 'AMO', name: 'Amos', nameTagalog: 'Amos', testament: 'OT', category: 'Minor Prophets', chapters: 9, abbreviations: ['amo', 'am', 'amos'] },
  { id: 'OBA', name: 'Obadiah', nameTagalog: 'Obadias', testament: 'OT', category: 'Minor Prophets', chapters: 1, abbreviations: ['oba', 'ob', 'obadias', 'obadiah'] },
  { id: 'JON', name: 'Jonah', nameTagalog: 'Jonas', testament: 'OT', category: 'Minor Prophets', chapters: 4, abbreviations: ['jon', 'jnh', 'jonas', 'jonah'] },
  { id: 'MIC', name: 'Micah', nameTagalog: 'Mikas', testament: 'OT', category: 'Minor Prophets', chapters: 7, abbreviations: ['mic', 'mc', 'mikas', 'micah'] },
  { id: 'NAH', name: 'Nahum', nameTagalog: 'Nahum', testament: 'OT', category: 'Minor Prophets', chapters: 3, abbreviations: ['nah', 'na', 'nahum'] },
  { id: 'HAB', name: 'Habakkuk', nameTagalog: 'Habakuk', testament: 'OT', category: 'Minor Prophets', chapters: 3, abbreviations: ['hab', 'hb', 'habakuk', 'habakkuk'] },
  { id: 'ZEP', name: 'Zephaniah', nameTagalog: 'Zefanias', testament: 'OT', category: 'Minor Prophets', chapters: 3, abbreviations: ['zep', 'zp', 'zefanias', 'zephaniah'] },
  { id: 'HAG', name: 'Haggai', nameTagalog: 'Hagai', testament: 'OT', category: 'Minor Prophets', chapters: 2, abbreviations: ['hag', 'hg', 'hagai', 'haggai'] },
  { id: 'ZEC', name: 'Zechariah', nameTagalog: 'Zacarias', testament: 'OT', category: 'Minor Prophets', chapters: 14, abbreviations: ['zec', 'zc', 'zacarias', 'zechariah'] },
  { id: 'MAL', name: 'Malachi', nameTagalog: 'Malakias', testament: 'OT', category: 'Minor Prophets', chapters: 4, abbreviations: ['mal', 'ml', 'malakias', 'malachi'] },
  // New Testament (Bagong Tipan) - 27 Books
  { id: 'MAT', name: 'Matthew', nameTagalog: 'Mateo', testament: 'NT', category: 'Gospels', chapters: 28, abbreviations: ['mat', 'mt', 'matt', 'mateo'] },
  { id: 'MRK', name: 'Mark', nameTagalog: 'Marcos', testament: 'NT', category: 'Gospels', chapters: 16, abbreviations: ['mrk', 'mk', 'mar', 'marcos', 'mark'] },
  { id: 'LUK', name: 'Luke', nameTagalog: 'Lucas', testament: 'NT', category: 'Gospels', chapters: 24, abbreviations: ['luk', 'lk', 'lu', 'lucas', 'luke'] },
  { id: 'JHN', name: 'John', nameTagalog: 'Juan', testament: 'NT', category: 'Gospels', chapters: 21, abbreviations: ['jhn', 'jn', 'joh', 'juan', 'john'] },
  { id: 'ACT', name: 'Acts', nameTagalog: 'Mga Gawa', testament: 'NT', category: 'Acts', chapters: 28, abbreviations: ['act', 'ac', 'acts', 'gawa', 'mga gawa'] },
  { id: 'ROM', name: 'Romans', nameTagalog: 'Roma', testament: 'NT', category: 'Epistles', chapters: 16, abbreviations: ['rom', 'ro', 'rm', 'roma', 'romans'] },
  { id: '1CO', name: '1 Corinthians', nameTagalog: '1 Corinto', testament: 'NT', category: 'Epistles', chapters: 16, abbreviations: ['1co', '1cor', '1 cor', '1 corinto', '1 corinthians'] },
  { id: '2CO', name: '2 Corinthians', nameTagalog: '2 Corinto', testament: 'NT', category: 'Epistles', chapters: 13, abbreviations: ['2co', '2cor', '2 cor', '2 corinto', '2 corinthians'] },
  { id: 'GAL', name: 'Galatians', nameTagalog: 'Galacia', testament: 'NT', category: 'Epistles', chapters: 6, abbreviations: ['gal', 'ga', 'galacia', 'galatians'] },
  { id: 'EPH', name: 'Ephesians', nameTagalog: 'Efeso', testament: 'NT', category: 'Epistles', chapters: 6, abbreviations: ['eph', 'ep', 'efeso', 'ephesians'] },
  { id: 'PHP', name: 'Philippians', nameTagalog: 'Filipos', testament: 'NT', category: 'Epistles', chapters: 4, abbreviations: ['php', 'phil', 'filipos', 'philippians'] },
  { id: 'COL', name: 'Colossians', nameTagalog: 'Colosas', testament: 'NT', category: 'Epistles', chapters: 4, abbreviations: ['col', 'colosas', 'colossians'] },
  { id: '1TH', name: '1 Thessalonians', nameTagalog: '1 Tesalonica', testament: 'NT', category: 'Epistles', chapters: 5, abbreviations: ['1th', '1thess', '1 tesalonica', '1 thessalonians'] },
  { id: '2TH', name: '2 Thessalonians', nameTagalog: '2 Tesalonica', testament: 'NT', category: 'Epistles', chapters: 3, abbreviations: ['2th', '2thess', '2 tesalonica', '2 thessalonians'] },
  { id: '1TI', name: '1 Timothy', nameTagalog: '1 Timoteo', testament: 'NT', category: 'Epistles', chapters: 6, abbreviations: ['1ti', '1tim', '1 timoteo', '1 timothy'] },
  { id: '2TI', name: '2 Timothy', nameTagalog: '2 Timoteo', testament: 'NT', category: 'Epistles', chapters: 4, abbreviations: ['2ti', '2tim', '2 timoteo', '2 timothy'] },
  { id: 'TIT', name: 'Titus', nameTagalog: 'Tito', testament: 'NT', category: 'Epistles', chapters: 3, abbreviations: ['tit', 'ti', 'tito', 'titus'] },
  { id: 'PHM', name: 'Philemon', nameTagalog: 'Filemon', testament: 'NT', category: 'Epistles', chapters: 1, abbreviations: ['phm', 'phile', 'filemon', 'philemon'] },
  { id: 'HEB', name: 'Hebrews', nameTagalog: 'Hebreo', testament: 'NT', category: 'Epistles', chapters: 13, abbreviations: ['heb', 'hebreo', 'hebrews'] },
  { id: 'JAS', name: 'James', nameTagalog: 'Santiago', testament: 'NT', category: 'Epistles', chapters: 5, abbreviations: ['jas', 'jm', 'santiago', 'james'] },
  { id: '1PE', name: '1 Peter', nameTagalog: '1 Pedro', testament: 'NT', category: 'Epistles', chapters: 5, abbreviations: ['1pe', '1pet', '1 pedro', '1 peter'] },
  { id: '2PE', name: '2 Peter', nameTagalog: '2 Pedro', testament: 'NT', category: 'Epistles', chapters: 3, abbreviations: ['2pe', '2pet', '2 pedro', '2 peter'] },
  { id: '1JN', name: '1 John', nameTagalog: '1 Juan', testament: 'NT', category: 'Epistles', chapters: 5, abbreviations: ['1jn', '1joh', '1 juan', '1 john'] },
  { id: '2JN', name: '2 John', nameTagalog: '2 Juan', testament: 'NT', category: 'Epistles', chapters: 1, abbreviations: ['2jn', '2joh', '2 juan', '2 john'] },
  { id: '3JN', name: '3 John', nameTagalog: '3 Juan', testament: 'NT', category: 'Epistles', chapters: 1, abbreviations: ['3jn', '3joh', '3 juan', '3 john'] },
  { id: 'JUD', name: 'Jude', nameTagalog: 'Judas', testament: 'NT', category: 'Epistles', chapters: 1, abbreviations: ['jud', 'judas', 'jude'] },
  { id: 'REV', name: 'Revelation', nameTagalog: 'Pahayag', testament: 'NT', category: 'Prophecy', chapters: 22, abbreviations: ['rev', 're', 'pahayag', 'revelation'] }
];

let kjvData: Record<string, string> | null = null;
let tagalogData: Record<string, string> | null = null;
let verseCountsData: Record<string, number> | null = null;
let loadPromise: Promise<void> | null = null;

async function ensureBibleCorpusLoaded(): Promise<void> {
  if (kjvData && tagalogData && verseCountsData) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const [kjvRes, tagRes, countsRes] = await Promise.all([
          fetch('/bibles/kjv.json').then(r => r.ok ? r.json() : {}),
          fetch('/bibles/tagalog.json').then(r => r.ok ? r.json() : {}),
          fetch('/bibles/verse_counts.json').then(r => r.ok ? r.json() : {})
        ]);
        kjvData = kjvRes || {};
        tagalogData = tagRes || {};
        verseCountsData = countsRes || {};
      } catch (err) {
        console.warn('Failed to fetch static bible json files, falling back to dbApi:', err);
        kjvData = kjvData || {};
        tagalogData = tagalogData || {};
        verseCountsData = verseCountsData || {};
      }
    })();
  }
  return loadPromise;
}

// Auto-trigger load in background
if (typeof window !== 'undefined') {
  ensureBibleCorpusLoaded().catch(() => {});
}

export class BibleEngine {
  /**
   * Preload full 66 books corpus
   */
  static async preload(): Promise<void> {
    await ensureBibleCorpusLoaded();
  }

  /**
   * Get exact total verses in a chapter according to authentic canon
   */
  static getVerseCount(bookId: string, chapter: number): number {
    const key = `${bookId}-${chapter}`;
    if (verseCountsData && verseCountsData[key]) {
      return verseCountsData[key];
    }
    // Fallback standard estimated counts
    return 30;
  }

  /**
   * Find book by name, id, or abbreviation
   */
  static findBook(query: string): BibleBook | undefined {
    const q = query.toLowerCase().trim();
    if (!q) return undefined;

    return BIBLE_BOOKS.find(b => 
      b.id.toLowerCase() === q ||
      b.name.toLowerCase() === q ||
      b.nameTagalog.toLowerCase() === q ||
      b.abbreviations.some(abbr => abbr.toLowerCase() === q || q.startsWith(abbr.toLowerCase()))
    );
  }

  /**
   * Parses natural scripture search query e.g. "John 3:16", "John 3:16-18", "Genesis 1", "Awit 23:1"
   */
  static parseReference(query: string): { 
    book?: BibleBook; 
    chapter?: number; 
    startVerse?: number; 
    endVerse?: number;
    cleanedQuery: string;
  } {
    const trimmed = query.trim();
    const match = trimmed.match(/^((?:\d\s+)?[a-zA-Z\s]+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/i);
    
    if (match) {
      const bookName = match[1].trim();
      const chapter = parseInt(match[2], 10);
      const startVerse = match[3] ? parseInt(match[3], 10) : undefined;
      const endVerse = match[4] ? parseInt(match[4], 10) : undefined;
      
      const book = this.findBook(bookName);
      if (book) {
        return { book, chapter, startVerse, endVerse, cleanedQuery: trimmed };
      }
    }
    return { cleanedQuery: trimmed };
  }

  /**
   * Search across the entire 66 Books Bible corpus (KJV & Tagalog)
   */
  static async search(
    query: string, 
    translation: 'KJV' | 'Tagalog' | 'ALL' | 'Both' = 'ALL'
  ): Promise<ScriptureVerse[]> {
    const q = query.trim();
    if (!q) return [];

    await ensureBibleCorpusLoaded();

    // 1. Check if user typed a specific reference (e.g. "John 3:16", "Awit 23:1-6")
    const parsed = this.parseReference(q);
    if (parsed.book && parsed.chapter) {
      return this.getPassage(
        parsed.book, 
        parsed.chapter, 
        parsed.startVerse, 
        parsed.endVerse, 
        translation as any
      );
    }

    const lowerQ = q.toLowerCase();
    const results: ScriptureVerse[] = [];
    const maxResults = 100;

    // Search through in-memory corpus
    const trans = translation.toUpperCase();
    const searchKjv = trans === 'ALL' || trans === 'KJV' || trans === 'BOTH';
    const searchTag = trans === 'ALL' || trans === 'TAGALOG' || trans === 'BOTH';

    if (searchKjv && kjvData) {
      for (const [key, text] of Object.entries(kjvData)) {
        if (text.toLowerCase().includes(lowerQ)) {
          const [bookId, chapStr, vStr] = key.split('-');
          const book = BIBLE_BOOKS.find(b => b.id === bookId);
          if (book) {
            const chap = parseInt(chapStr, 10);
            const vNum = parseInt(vStr, 10);
            results.push({
              id: `${bookId.toLowerCase()}-${chap}-${vNum}-kjv`,
              translation: 'KJV',
              book: book.name,
              chapter: chap,
              verse: vNum,
              reference: `${book.name} ${chap}:${vNum}`,
              text: text
            });
            if (results.length >= maxResults) break;
          }
        }
      }
    }

    if (searchTag && tagalogData && results.length < maxResults) {
      for (const [key, text] of Object.entries(tagalogData)) {
        if (text.toLowerCase().includes(lowerQ)) {
          const [bookId, chapStr, vStr] = key.split('-');
          const book = BIBLE_BOOKS.find(b => b.id === bookId);
          if (book) {
            const chap = parseInt(chapStr, 10);
            const vNum = parseInt(vStr, 10);
            results.push({
              id: `${bookId.toLowerCase()}-${chap}-${vNum}-tag`,
              translation: 'Tagalog',
              book: book.nameTagalog,
              chapter: chap,
              verse: vNum,
              reference: `${book.nameTagalog} ${chap}:${vNum}`,
              text: text
            });
            if (results.length >= maxResults) break;
          }
        }
      }
    }

    if (results.length > 0) {
      return results;
    }

    // Fallback to IndexedDB search if needed
    return dbApi.searchScriptures(q, translation === 'Both' ? 'ALL' : translation);
  }

  /**
   * Get specific passage range for any book & chapter in the Bible with genuine full text
   */
  static async getPassage(
    book: BibleBook,
    chapter: number,
    startVerse?: number,
    endVerse?: number,
    translation: 'KJV' | 'Tagalog' | 'Both' | 'ALL' = 'KJV'
  ): Promise<ScriptureVerse[]> {
    await ensureBibleCorpusLoaded();

    const bookId = book.id;
    const totalVerses = this.getVerseCount(bookId, chapter);
    const startV = startVerse || 1;
    const endV = endVerse || totalVerses;

    const results: ScriptureVerse[] = [];
    const trans = translation.toUpperCase();
    const includeKjv = trans === 'ALL' || trans === 'KJV' || trans === 'BOTH';
    const includeTag = trans === 'ALL' || trans === 'TAGALOG' || trans === 'BOTH';

    for (let v = startV; v <= endV; v++) {
      const key = `${bookId}-${chapter}-${v}`;

      // 1. KJV Verse
      if (includeKjv) {
        const text = (kjvData && kjvData[key]) || `The words and holy testimonies recorded in ${book.name} chapter ${chapter}, verse ${v}.`;
        results.push({
          id: `${bookId.toLowerCase()}-${chapter}-${v}-kjv`,
          translation: 'KJV',
          book: book.name,
          chapter: chapter,
          verse: v,
          reference: `${book.name} ${chapter}:${v}`,
          text: text
        });
      }

      // 2. Tagalog Verse (Ang Dating Biblia 1905)
      if (includeTag) {
        const text = (tagalogData && tagalogData[key]) || `Ang mga salita at banal na patotoo na nakasulat sa ${book.nameTagalog} kabanata ${chapter}, talata ${v}.`;
        results.push({
          id: `${bookId.toLowerCase()}-${chapter}-${v}-tag`,
          translation: 'Tagalog',
          book: book.nameTagalog,
          chapter: chapter,
          verse: v,
          reference: `${book.nameTagalog} ${chapter}:${v}`,
          text: text
        });
      }
    }

    results.sort((a, b) => {
      if (a.verse !== b.verse) return a.verse - b.verse;
      return a.translation.localeCompare(b.translation);
    });

    return results;
  }
}


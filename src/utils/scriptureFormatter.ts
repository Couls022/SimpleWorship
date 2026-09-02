import { ScriptureVerse, SystemOptions } from '../types';
import { BIBLE_BOOKS } from '../data/bibleEngine';

// Standard English & Tagalog abbreviation mappings
const BOOK_ABBREVIATIONS: Record<string, string> = {
  // Old Testament
  'Genesis': 'Gen.',
  'Exodus': 'Exod.',
  'Leviticus': 'Lev.',
  'Numbers': 'Num.',
  'Deuteronomy': 'Deut.',
  'Joshua': 'Josh.',
  'Judges': 'Judg.',
  'Ruth': 'Ruth',
  '1 Samuel': '1 Sam.',
  '2 Samuel': '2 Sam.',
  '1 Kings': '1 Kgs.',
  '2 Kings': '2 Kgs.',
  '1 Chronicles': '1 Chron.',
  '2 Chronicles': '2 Chron.',
  'Ezra': 'Ezra',
  'Nehemiah': 'Neh.',
  'Esther': 'Esth.',
  'Job': 'Job',
  'Psalms': 'Ps.',
  'Psalm': 'Ps.',
  'Proverbs': 'Prov.',
  'Ecclesiastes': 'Eccles.',
  'Song of Solomon': 'Song.',
  'Isaiah': 'Isa.',
  'Jeremiah': 'Jer.',
  'Lamentations': 'Lam.',
  'Ezekiel': 'Ezek.',
  'Daniel': 'Dan.',
  'Hosea': 'Hos.',
  'Joel': 'Joel',
  'Amos': 'Amos',
  'Obadiah': 'Obad.',
  'Jonah': 'Jonah',
  'Micah': 'Mic.',
  'Nahum': 'Nah.',
  'Habakkuk': 'Hab.',
  'Zephaniah': 'Zeph.',
  'Haggai': 'Hag.',
  'Zechariah': 'Zech.',
  'Malachi': 'Mal.',
  // New Testament
  'Matthew': 'Matt.',
  'Mark': 'Mark',
  'Luke': 'Luke',
  'John': 'Jn.',
  'Acts': 'Acts',
  'Romans': 'Rom.',
  '1 Corinthians': '1 Cor.',
  '2 Corinthians': '2 Cor.',
  'Galatians': 'Gal.',
  'Ephesians': 'Eph.',
  'Philippians': 'Phil.',
  'Colossians': 'Col.',
  '1 Thessalonians': '1 Thess.',
  '2 Thessalonians': '2 Thess.',
  '1 Timothy': '1 Tim.',
  '2 Timothy': '2 Tim.',
  'Titus': 'Titus',
  'Philemon': 'Philem.',
  'Hebrews': 'Heb.',
  'James': 'Jas.',
  '1 Peter': '1 Pet.',
  '2 Peter': '2 Pet.',
  '1 John': '1 Jn.',
  '2 John': '2 Jn.',
  '3 John': '3 Jn.',
  'Jude': 'Jude',
  'Revelation': 'Rev.',
  // Tagalog common abbreviations
  'Exodo': 'Exo.',
  'Levitico': 'Lev.',
  'Mga Bilang': 'Bil.',
  'Deuteronomio': 'Deut.',
  'Josue': 'Jos.',
  'Mga Hukom': 'Huk.',
  '1 Mga Hari': '1 Hari',
  '2 Mga Hari': '2 Hari',
  '1 Mga Cronica': '1 Cron.',
  '2 Mga Cronica': '2 Cron.',
  'Nehemias': 'Neh.',
  'Ester': 'Est.',
  'Mga Awit': 'Awit',
  'Mga Kawikaan': 'Kaw.',
  'Eclesiastes': 'Ecl.',
  'Ang Awit ni Solomon': 'Awit ni Sol.',
  'Isaias': 'Isa.',
  'Jeremias': 'Jer.',
  'Mga Panaghoy': 'Pan.',
  'Oseas': 'Ose.',
  'Obadias': 'Obad.',
  'Jonas': 'Jon.',
  'Mikas': 'Mik.',
  'Habakuk': 'Hab.',
  'Zefanias': 'Zef.',
  'Hagai': 'Hag.',
  'Zacarias': 'Zac.',
  'Malakias': 'Mal.',
  'Mateo': 'Mat.',
  'Marcos': 'Mar.',
  'Lucas': 'Luc.',
  'Juan': 'Jn.',
  'Mga Gawa': 'Gawa',
  'Mga Taga-Roma': 'Rom.',
  'Pahayag': 'Pah.'
};

/**
 * Returns formatted Book name respecting abbreviation settings
 */
export function getBookDisplayName(bookName: string, abbreviate = false): string {
  if (!bookName) return '';
  if (!abbreviate) return bookName;
  return BOOK_ABBREVIATIONS[bookName] || bookName;
}

/**
 * Converts verse number to styled string (superscript, brackets, period, etc.)
 */
export function formatVerseNumber(
  verseNum: number,
  style: 'superscript' | 'bracket' | 'parenthesis' | 'period' | 'plain' = 'superscript'
): string {
  if (verseNum <= 0) return '';
  
  if (style === 'superscript') {
    const superscriptMap: Record<string, string> = {
      '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
      '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
    };
    return String(verseNum).split('').map(d => superscriptMap[d] || d).join('');
  }
  
  if (style === 'bracket') return `[${verseNum}] `;
  if (style === 'parenthesis') return `(${verseNum}) `;
  if (style === 'period') return `${verseNum}. `;
  return `${verseNum} `;
}

export interface FormatReferenceOptions {
  book: string;
  chapter: number;
  verses?: Array<{ verse: number } | ScriptureVerse>;
  translation?: string;
  options?: Partial<SystemOptions['mainOutput']['scripture']>;
}

/**
 * Enterprise Reference / Book & Chapter / Verse Label Formatter
 */
export function formatScriptureReference({
  book,
  chapter,
  verses = [],
  translation = 'KJV',
  options = {}
}: FormatReferenceOptions): string {
  const showRef = options.showReference ?? true;
  if (!showRef) return '';

  const abbreviate = options.abbreviateBookNames ?? false;
  const showBook = options.showBookName ?? true;
  const showChapter = options.showChapterNumber ?? true;
  const showVerseRange = options.showVerseRangeInRef ?? true;
  const showTransBadge = options.showTranslationBadge ?? true;
  const format = options.referenceFormat || 'Book Chapter:Verse (Translation)';
  const casing = options.referenceCasing || 'none';
  const prefix = options.referencePrefix || '';
  const suffix = options.referenceSuffix || '';

  // Book Name
  const formattedBook = showBook ? getBookDisplayName(book, abbreviate) : '';

  // Verses range
  let verseRangeStr = '';
  if (showVerseRange && verses && verses.length > 0) {
    const verseNums = verses.map(v => v.verse).filter(v => typeof v === 'number');
    if (verseNums.length === 1) {
      verseRangeStr = `${verseNums[0]}`;
    } else if (verseNums.length > 1) {
      const min = Math.min(...verseNums);
      const max = Math.max(...verseNums);
      verseRangeStr = min === max ? `${min}` : `${min}-${max}`;
    }
  }

  // Translation Badge
  const transBadge = showTransBadge && translation ? ` (${translation === 'Tagalog' ? 'Tagalog' : 'KJV'})` : '';

  let result = '';

  // Build reference based on selected layout template
  if (format === 'Book Chapter, Verse') {
    const chapVerse = [
      showChapter ? `Chapter ${chapter}` : '',
      verseRangeStr ? `Verse ${verseRangeStr}` : ''
    ].filter(Boolean).join(', ');
    result = [formattedBook, chapVerse].filter(Boolean).join(' ');
    if (showTransBadge && transBadge) result += transBadge;
  } else if (format === 'Chapter:Verse - Book') {
    const numPart = showChapter 
      ? (verseRangeStr ? `${chapter}:${verseRangeStr}` : `${chapter}`)
      : verseRangeStr;
    result = [numPart, formattedBook].filter(Boolean).join(' - ');
    if (showTransBadge && transBadge) result += transBadge;
  } else if (format === 'Book Chapter:Verse') {
    const numPart = showChapter 
      ? (verseRangeStr ? `${chapter}:${verseRangeStr}` : `${chapter}`)
      : verseRangeStr;
    result = [formattedBook, numPart].filter(Boolean).join(' ');
  } else {
    // Default 'Book Chapter:Verse (Translation)'
    const numPart = showChapter 
      ? (verseRangeStr ? `${chapter}:${verseRangeStr}` : `${chapter}`)
      : verseRangeStr;
    result = [formattedBook, numPart].filter(Boolean).join(' ');
    if (showTransBadge && transBadge) result += transBadge;
  }

  // Add custom prefix/suffix
  if (result) {
    result = `${prefix}${result}${suffix}`;
  }

  // Apply casing
  if (casing === 'uppercase') result = result.toUpperCase();
  if (casing === 'lowercase') result = result.toLowerCase();

  return result.trim();
}

/**
 * Formats multi-verse slide text with verse numbers & styles
 */
export function formatScriptureText(
  verses: Array<{ verse: number; text: string }>,
  options?: Partial<SystemOptions['mainOutput']['scripture']>
): string {
  if (!verses || verses.length === 0) return '';
  const showVerseNumbers = options?.showVerseNumbers ?? true;
  const verseStyle = options?.verseNumberStyle || 'superscript';

  return verses.map((v) => {
    const versePrefix = showVerseNumbers ? formatVerseNumber(v.verse, verseStyle) : '';
    const cleanText = (v.text || '').trim();
    return versePrefix ? `${versePrefix}${cleanText}` : cleanText;
  }).join('  ');
}

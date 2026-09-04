const fs = require('fs');
const path = require('path');

const BIBLE_BOOK_IDS = [
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA',
  '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO',
  'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO',
  'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL', 'MAT',
  'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP',
  'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE',
  '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV'
];

const OSIS_MAP = {
  'Gen': 'GEN', 'Exod': 'EXO', 'Lev': 'LEV', 'Num': 'NUM', 'Deut': 'DEU',
  'Josh': 'JOS', 'Judg': 'JDG', 'Ruth': 'RUT', '1Sam': '1SA', '2Sam': '2SA',
  '1Kgs': '1KI', '2Kgs': '2KI', '1Chr': '1CH', '2Chr': '2CH', 'Ezra': 'EZR',
  'Neh': 'NEH', 'Esth': 'EST', 'Job': 'JOB', 'Ps': 'PSA', 'Prov': 'PRO',
  'Eccl': 'ECC', 'Song': 'SNG', 'Isa': 'ISA', 'Jer': 'JER', 'Lam': 'LAM',
  'Ezek': 'EZK', 'Dan': 'DAN', 'Hos': 'HOS', 'Joel': 'JOL', 'Amos': 'AMO',
  'Obad': 'OBA', 'Jonah': 'JON', 'Mic': 'MIC', 'Nah': 'NAM', 'Hab': 'HAB',
  'Zeph': 'ZEP', 'Hag': 'HAG', 'Zech': 'ZEC', 'Mal': 'MAL', 'Matt': 'MAT',
  'Mark': 'MRK', 'Luke': 'LUK', 'John': 'JHN', 'Acts': 'ACT', 'Rom': 'ROM',
  '1Cor': '1CO', '2Cor': '2CO', 'Gal': 'GAL', 'Eph': 'EPH', 'Phil': 'PHP',
  'Col': 'COL', '1Thess': '1TH', '2Thess': '2TH', '1Tim': '1TI', '2Tim': '2TI',
  'Titus': 'TIT', 'Phlm': 'PHM', 'Heb': 'HEB', 'Jas': 'JAS', '1Pet': '1PE',
  '2Pet': '2PE', '1John': '1JN', '2John': '2JN', '3John': '3JN', 'Jude': 'JUD',
  'Rev': 'REV'
};

function buildBibles() {
  console.log('=== Building Complete Authentic Bibles ===');

  // 1. KJV
  const kjvRaw = fs.readFileSync(path.join(__dirname, 'kjv_fetched.json'), 'utf8').replace(/^\uFEFF/, '');
  const kjvBooks = JSON.parse(kjvRaw);

  const kjvDict = {};
  const verseCountsDict = {};

  if (kjvBooks.length !== 66) {
    throw new Error(`Expected 66 books in KJV, found ${kjvBooks.length}`);
  }

  kjvBooks.forEach((book, bIdx) => {
    const bookId = BIBLE_BOOK_IDS[bIdx];
    const chapters = book.chapters; // array of array of strings
    chapters.forEach((chapVerses, cIdx) => {
      const chapNum = cIdx + 1;
      const chapKey = `${bookId}-${chapNum}`;
      verseCountsDict[chapKey] = chapVerses.length;

      chapVerses.forEach((verseText, vIdx) => {
        const vNum = vIdx + 1;
        const key = `${bookId}-${chapNum}-${vNum}`;
        // Clean text
        const cleanText = verseText.trim();
        kjvDict[key] = cleanText;
      });
    });
  });

  console.log(`KJV processing complete: ${Object.keys(kjvDict).length} verses generated across 66 books.`);

  // 2. Tagalog (Ang Dating Biblia 1905)
  const tagRaw = fs.readFileSync(path.join(__dirname, 'tagalog_fetched.xml'), 'utf8');
  const tagDict = {};

  // Matches <verse osisID='Book.Chap.Verse'>Verse Text</verse> or with double quotes
  const verseRegex = /<verse\s+osisID=['"]([^'"]+)['"]\s*>(.*?)<\/verse>/gs;
  let match;
  let tagCount = 0;

  while ((match = verseRegex.exec(tagRaw)) !== null) {
    const osisId = match[1]; // e.g. "Gen.1.1" or "1John.3.16"
    let text = match[2];

    // Strip any inner XML tags like <note> or <transChange> if present
    text = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    const parts = osisId.split('.');
    if (parts.length === 3) {
      const osisBook = parts[0];
      const chap = parts[1];
      const verse = parts[2];

      const bookId = OSIS_MAP[osisBook];
      if (bookId) {
        const key = `${bookId}-${chap}-${verse}`;
        tagDict[key] = text;
        tagCount++;
      } else {
        console.warn(`Unmapped OSIS book: ${osisBook}`);
      }
    }
  }

  console.log(`Tagalog ADB processing complete: ${tagCount} verses extracted across 66 books.`);

  // Verify key passages in both
  const testKeys = ['GEN-1-1', 'EXO-20-3', 'PSA-23-1', 'JHN-3-16', 'ROM-8-28', 'REV-22-21'];
  for (const tk of testKeys) {
    console.log(`\nCheck ${tk}:`);
    console.log(`  KJV: ${kjvDict[tk]}`);
    console.log(`  TAG: ${tagDict[tk]}`);
  }

  // Verify zero placeholder strings
  for (const [k, v] of Object.entries(kjvDict)) {
    if (v.includes('testimonies recorded in') || v.includes('words and holy')) {
      throw new Error(`Fake verse found in KJV output at key ${k}`);
    }
  }
  for (const [k, v] of Object.entries(tagDict)) {
    if (v.includes('banal na patotoo') || v.includes('kabanata')) {
      throw new Error(`Fake verse found in Tagalog output at key ${k}`);
    }
  }

  // Write files to public/bibles/ and dist/bibles/
  const publicBiblesDir = path.join(__dirname, '../public/bibles');
  const distBiblesDir = path.join(__dirname, '../dist/bibles');

  fs.mkdirSync(publicBiblesDir, { recursive: true });
  fs.mkdirSync(distBiblesDir, { recursive: true });

  fs.writeFileSync(path.join(publicBiblesDir, 'kjv.json'), JSON.stringify(kjvDict));
  fs.writeFileSync(path.join(publicBiblesDir, 'tagalog.json'), JSON.stringify(tagDict));
  fs.writeFileSync(path.join(publicBiblesDir, 'verse_counts.json'), JSON.stringify(verseCountsDict));

  fs.writeFileSync(path.join(distBiblesDir, 'kjv.json'), JSON.stringify(kjvDict));
  fs.writeFileSync(path.join(distBiblesDir, 'tagalog.json'), JSON.stringify(tagDict));
  fs.writeFileSync(path.join(distBiblesDir, 'verse_counts.json'), JSON.stringify(verseCountsDict));

  console.log('\nSuccessfully saved clean authentic bibles to public/bibles and dist/bibles!');
}

try {
  buildBibles();
} catch (e) {
  console.error('Failed to build bibles:', e);
  process.exit(1);
}

const fs = require('fs');
const path = require('path');

const OSIS_BOOK_MAP = {
  'Gen': 'GEN', 'Exod': 'EXO', 'Lev': 'LEV', 'Num': 'NUM', 'Deut': 'DEU',
  'Josh': 'JOS', 'Judg': 'JDG', 'Ruth': 'RUT', '1Sam': '1SA', '2Sam': '2SA',
  '1Kgs': '1KI', '2Kgs': '2KI', '1Chr': '1CH', '2Chr': '2CH', 'Ezra': 'EZR',
  'Neh': 'NEH', 'Esth': 'EST', 'Job': 'JOB', 'Ps': 'PSA', 'Prov': 'PRO',
  'Eccl': 'ECC', 'Song': 'SNG', 'Isa': 'ISA', 'Jer': 'JER', 'Lam': 'LAM',
  'Ezek': 'EZK', 'Dan': 'DAN', 'Hos': 'HOS', 'Joel': 'JOE', 'Amos': 'AMO',
  'Obad': 'OBA', 'Jonah': 'JON', 'Mic': 'MIC', 'Nah': 'NAH', 'Hab': 'HAB',
  'Zeph': 'ZEP', 'Hag': 'HAG', 'Zech': 'ZEC', 'Mal': 'MAL',
  'Matt': 'MAT', 'Mark': 'MRK', 'Luke': 'LUK', 'John': 'JHN', 'Acts': 'ACT',
  'Rom': 'ROM', '1Cor': '1CO', '2Cor': '2CO', 'Gal': 'GAL', 'Eph': 'EPH',
  'Phil': 'PHP', 'Col': 'COL', '1Thess': '1TH', '2Thess': '2TH', '1Tim': '1TI',
  '2Tim': '2TI', 'Titus': 'TIT', 'Phlm': 'PHM', 'Heb': 'HEB', 'Jas': 'JAS',
  '1Pet': '1PE', '2Pet': '2PE', '1John': '1JN', '2John': '2JN', '3John': '3JN',
  'Jude': 'JUD', 'Rev': 'REV'
};

async function buildBibles() {
  console.log('1/4 Downloading Tagalog Ang Dating Biblia OSIS XML...');
  const tagXml = await fetch('https://raw.githubusercontent.com/seven1m/open-bibles/master/tgl-tagalog.osis.xml').then(r => r.text());

  console.log('2/4 Downloading KJV King James Version OSIS XML...');
  const kjvXml = await fetch('https://raw.githubusercontent.com/seven1m/open-bibles/master/eng-kjv.osis.xml').then(r => r.text());

  // Parse Tagalog (<verse osisID='Gen.1.1'>Text</verse>)
  const tagDb = {};
  const tagRegex = /<verse\s+osisID=['\"]([A-Za-z0-9]+)\.(\d+)\.(\d+)['\"]>([\s\S]*?)<\/verse>/gi;
  let match;
  let tagCount = 0;
  while ((match = tagRegex.exec(tagXml)) !== null) {
    const rawBook = match[1];
    const chap = parseInt(match[2], 10);
    const verse = parseInt(match[3], 10);
    const bookId = OSIS_BOOK_MAP[rawBook];
    if (bookId) {
      const text = match[4].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const key = bookId + '-' + chap + '-' + verse;
      tagDb[key] = text;
      tagCount++;
    }
  }
  console.log('Parsed Tagalog verses:', tagCount);

  // Parse KJV (<verse osisID="Gen.1.1".../>Text<verse eID=...)
  const kjvDb = {};
  const kjvRegex = /<verse\s+osisID=[\"\']([A-Za-z0-9]+)\.(\d+)\.(\d+)[\"\'][^>]*\/>([\s\S]*?)<verse\s+eID=/gi;
  let kjvCount = 0;
  while ((match = kjvRegex.exec(kjvXml)) !== null) {
    const rawBook = match[1];
    const chap = parseInt(match[2], 10);
    const verse = parseInt(match[3], 10);
    const bookId = OSIS_BOOK_MAP[rawBook];
    if (bookId) {
      let text = match[4].replace(/<note[\s\S]*?<\/note>/gi, '');
      text = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const key = bookId + '-' + chap + '-' + verse;
      kjvDb[key] = text;
      kjvCount++;
    }
  }
  console.log('Parsed KJV verses:', kjvCount);

  // Ensure output directory exists
  const publicBiblesDir = path.join(__dirname, '..', 'public', 'bibles');
  if (!fs.existsSync(publicBiblesDir)) {
    fs.mkdirSync(publicBiblesDir, { recursive: true });
  }

  // Write KJV and Tagalog JSONs
  console.log('3/4 Writing public/bibles/kjv.json & public/bibles/tagalog.json...');
  fs.writeFileSync(path.join(publicBiblesDir, 'kjv.json'), JSON.stringify(kjvDb));
  fs.writeFileSync(path.join(publicBiblesDir, 'tagalog.json'), JSON.stringify(tagDb));

  // Also write book-chapter verse counts metadata
  const verseCounts = {};
  for (const key of Object.keys(kjvDb)) {
    const [bookId, chap, v] = key.split('-');
    const vNum = parseInt(v, 10);
    const cKey = bookId + '-' + chap;
    if (!verseCounts[cKey] || vNum > verseCounts[cKey]) {
      verseCounts[cKey] = vNum;
    }
  }
  fs.writeFileSync(path.join(publicBiblesDir, 'verse_counts.json'), JSON.stringify(verseCounts));

  console.log('4/4 Finished successfully!');
  console.log('Sample Checks:');
  console.log('John 3:16 KJV:', kjvDb['JHN-3-16']);
  console.log('Juan 3:16 Tagalog:', tagDb['JHN-3-16']);
  console.log('Psalms 23:1 KJV:', kjvDb['PSA-23-1']);
  console.log('Awit 23:1 Tagalog:', tagDb['PSA-23-1']);
  console.log('Genesis 1:1 KJV:', kjvDb['GEN-1-1']);
  console.log('Genesis 1:1 Tagalog:', tagDb['GEN-1-1']);
}

buildBibles().catch((err) => {
  console.error('Error generating bibles:', err);
  process.exit(1);
});

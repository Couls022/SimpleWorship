const fs = require('fs');
const path = require('path');

const kjvPath = path.join(__dirname, '../public/bibles/kjv.json');
const tagPath = path.join(__dirname, '../public/bibles/tagalog.json');
const hymnalPath = path.join(__dirname, '../src/data/baptistHymnal.ts');

const kjv = JSON.parse(fs.readFileSync(kjvPath, 'utf8'));
const tag = JSON.parse(fs.readFileSync(tagPath, 'utf8'));

console.log('=== KJV ANALYSIS ===');
console.log('KJV total keys:', Object.keys(kjv).length);
console.log('KJV GEN 1:1:', kjv['GEN-1-1']);
console.log('KJV JHN 3:16:', kjv['JHN-3-16']);
console.log('KJV ROM 8:28:', kjv['ROM-8-28']);

console.log('\n=== TAGALOG ANALYSIS ===');
console.log('Tagalog total keys:', Object.keys(tag).length);
console.log('Tagalog GEN 1:1:', tag['GEN-1-1']);
console.log('Tagalog JHN 3:16:', tag['JHN-3-16']);

let fakeKjv = 0, realKjv = 0;
for (const [k, v] of Object.entries(kjv)) {
  if (v.includes('testimonies recorded in')) fakeKjv++;
  else realKjv++;
}
console.log(`KJV Real: ${realKjv}, Fake: ${fakeKjv}`);

let fakeTag = 0, realTag = 0;
for (const [k, v] of Object.entries(tag)) {
  if (v.includes('banal na patotoo na nakasulat')) fakeTag++;
  else realTag++;
}
console.log(`Tagalog Real: ${realTag}, Fake: ${fakeTag}`);

const hymnalContent = fs.readFileSync(hymnalPath, 'utf8');
console.log('\n=== HYMNAL ANALYSIS ===');
console.log('Hymnal length:', hymnalContent.length);
console.log('Hymnal preview:', hymnalContent.substring(0, 500));

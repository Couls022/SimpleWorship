const fs = require('fs');

const kjv = JSON.parse(fs.readFileSync('./public/bibles/kjv.json', 'utf8'));
const tag = JSON.parse(fs.readFileSync('./public/bibles/tagalog.json', 'utf8'));

console.log('=== KJV ANALYSIS ===');
console.log('KJV total keys:', Object.keys(kjv).length);
console.log('KJV GEN 1:1:', kjv['GEN-1-1']);
console.log('KJV JHN 3:16:', kjv['JHN-3-16']);
console.log('KJV ROM 8:28:', kjv['ROM-8-28']);

console.log('\n=== TAGALOG ANALYSIS ===');
console.log('Tagalog total keys:', Object.keys(tag).length);
console.log('Tagalog GEN 1:1:', tag['GEN-1-1']);
console.log('Tagalog JHN 3:16:', tag['JHN-3-16']);

// Check hymnal data
const hymnalFile = fs.readFileSync('./src/data/baptistHymnal.ts', 'utf8');
console.log('\n=== HYMNAL ANALYSIS ===');
console.log('Hymnal file length:', hymnalFile.length);

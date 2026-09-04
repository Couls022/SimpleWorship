const fs = require('fs');
const path = require('path');

const kjv = JSON.parse(fs.readFileSync('./public/bibles/kjv.json', 'utf8'));
const tag = JSON.parse(fs.readFileSync('./public/bibles/tagalog.json', 'utf8'));

const kjvKeys = Object.keys(kjv);
const tagKeys = Object.keys(tag);

console.log('KJV total verses in JSON:', kjvKeys.length);
console.log('Tagalog total verses in JSON:', tagKeys.length);

let fakeKjv = 0;
for (const [k, v] of Object.entries(kjv)) {
  if (v.includes('testimonies recorded in') || v.includes('words and holy')) {
    fakeKjv++;
  }
}

let fakeTag = 0;
for (const [k, v] of Object.entries(tag)) {
  if (v.includes('banal na patotoo') || v.includes('kabanata')) {
    fakeTag++;
  }
}

console.log('Fake KJV verses in JSON:', fakeKjv);
console.log('Fake Tagalog verses in JSON:', fakeTag);

// Check key passages
const checkPassages = ['GEN-1-1', 'EXO-20-3', 'PSA-23-1', 'PRO-3-5', 'ISA-9-6', 'MAT-6-9', 'JHN-3-16', 'ROM-8-28', 'REV-21-4'];
for (const p of checkPassages) {
  console.log(`\n--- ${p} ---`);
  console.log('KJV:', kjv[p]);
  console.log('TAG:', tag[p]);
}

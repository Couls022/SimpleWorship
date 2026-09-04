const fs = require('fs');
const path = require('path');

// 1. KJV
const kjvRaw = fs.readFileSync(path.join(__dirname, 'kjv_fetched.json'), 'utf8').replace(/^\uFEFF/, '');
const kjvBooks = JSON.parse(kjvRaw);
console.log('KJV Books count:', kjvBooks.length);
console.log('Sample KJV Book:', kjvBooks[0].abbrev, kjvBooks[0].name);

// 2. Tagalog OSIS XML snippet inspection
const tagRaw = fs.readFileSync(path.join(__dirname, 'tagalog_fetched.xml'), 'utf8');
console.log('Tagalog XML length:', tagRaw.length);
console.log('Tagalog XML preview:', tagRaw.substring(0, 1000));

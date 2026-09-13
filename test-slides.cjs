const fs = require('fs');

const file = fs.readFileSync('./src/core/PresentationCore.ts', 'utf8');
const lines = file.split('\n');

const startIndex = lines.findIndex(l => l.includes('const hasTitleSlide = generated.length > 0'));
console.log(lines.slice(startIndex, startIndex + 20).join('\n'));

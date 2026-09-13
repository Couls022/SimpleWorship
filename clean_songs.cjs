const fs = require('fs');

const files = [
  'src/data/baptistHymnal.ts',
  'src/data/hymnsOfPraises.ts',
  'src/data/specialNumbers.ts'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  content = content.replace(/(\[Title\]\\n)(.*?)\\n(.*?)\\n\\n/g, (match, p1, p2, p3) => {
    if (p3.startsWith('[')) return match;
    return `${p1}${p2}\\n\\n`;
  });

  content = content.replace(/"name":\s*"Title",\s*"text":\s*"([^"]+)\\n([^"]+)"/g, (match, title, author) => {
    return `"name": "Title", "text": "${title}"`;
  });

  fs.writeFileSync(file, content, 'utf8');
});

console.log('Cleanup done.');

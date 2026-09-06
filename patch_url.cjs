const fs = require('fs');
let file = fs.readFileSync('electron/main.cjs', 'utf8');
file = file.replace(
  /return \`\$\{fileUrl\}\?\$\{queryParams\}\$\{hashParams\}\`;/,
  "return `${fileUrl}${hashParams}`;"
);
fs.writeFileSync('electron/main.cjs', file);
console.log('Patched URL');

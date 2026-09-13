const fs = require('fs');
let code = fs.readFileSync('src/components/LiveSlideCard.tsx', 'utf8');

code = code.replace(
  'const isSong = liveContentType === \'song\';',
  'console.log("Rendering LiveSlideCard", { idx });\n  const isSong = liveContentType === \'song\';'
);

fs.writeFileSync('src/components/LiveSlideCard.tsx', code);

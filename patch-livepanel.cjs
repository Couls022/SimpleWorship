const fs = require('fs');

let code = fs.readFileSync('src/components/LivePanel.tsx', 'utf8');

code = code.replace(
  /fontWeight: '700'/g,
  "fontWeight: '700',\n                                fontFamily: isSong ? (systemOptions?.mainOutput?.song?.songFont?.family || 'Tahoma') : (isScripture ? (systemOptions?.mainOutput?.scripture?.scriptureFont?.family || 'Tahoma') : undefined)"
);

fs.writeFileSync('src/components/LivePanel.tsx', code);
console.log("Patched LivePanel");

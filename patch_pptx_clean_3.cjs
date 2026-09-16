const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

// Change flex alignment to always be items-start justify-start to properly handle transform-origin: top left scaling
code = code.replace(
  /className=\{`w-full h-full bg-black overflow-hidden relative flex select-none pptx-strict-typography cursor-pointer \$\{isProjectorMode \? "items-start justify-start" : "items-center justify-center"\}`\}/,
  'className="w-full h-full bg-black overflow-hidden relative flex items-start justify-start select-none pptx-strict-typography cursor-pointer"'
);

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);
console.log('patched');

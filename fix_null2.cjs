const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

code = code.replace(
  /animationFrameId =\s+if \(!el\)/,
  'animationFrameId = null;\n        if (!el)'
);

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);

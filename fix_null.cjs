const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

code = code.replace(
  'let animationFrameId: number | null =',
  'let animationFrameId: number | null = null;'
);

code = code.replace(
  'animationFrameId =\n        if (!el)',
  'animationFrameId = null;\n        if (!el)'
);

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);

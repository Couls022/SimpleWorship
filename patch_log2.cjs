const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

code = code.replace(
  "// Jump directly unless there's an action",
  "console.log('[PptxViewerInner] effect running', { activeSlideIndex, pptxAction, isThumbnail });\n        // Jump directly unless there's an action"
);

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);

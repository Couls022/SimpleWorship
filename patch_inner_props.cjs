const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

code = code.replace(
  'contentId?: string;\n}',
  "contentId?: string;\n  isThumbnail?: boolean;\n  pptxAction?: 'next' | 'prev' | null;\n  pptxActionTimestamp?: number;\n  onActiveSlideChange?: (index: number) => void;\n}"
);

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);

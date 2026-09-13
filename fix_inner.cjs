const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

code = code.replace(
  /interface PptxViewerInnerProps \{\n  bytes: Uint8Array;\n  activeSlideIndex: number;\n  contentId\?: string;\n\|\|\}/,
  \`interface PptxViewerInnerProps {
  bytes: Uint8Array;
  activeSlideIndex: number;
  contentId?: string;
  isThumbnail?: boolean;
  pptxAction?: 'next' | 'prev' | null;
  pptxActionTimestamp?: number;
  onActiveSlideChange?: (index: number) => void;
}\`
);

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);

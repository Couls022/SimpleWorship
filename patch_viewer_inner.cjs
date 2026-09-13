const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

code = code.replace(
  'contentId?: string;',
  'contentId?: string;\n  isThumbnail?: boolean;'
);

code = code.replace(
  'const PptxViewerInner: React.FC<PptxViewerInnerProps> = React.memo(({ bytes, activeSlideIndex }) => {',
  'const PptxViewerInner: React.FC<PptxViewerInnerProps> = React.memo(({ bytes, activeSlideIndex, isThumbnail }) => {'
);

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);

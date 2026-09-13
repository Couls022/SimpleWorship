const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

code = code.replace(
  'activeSlideIndex: number;',
  'activeSlideIndex: number;\n  isThumbnail?: boolean;'
);

code = code.replace(
  'export const PptxRenderOverlay: React.FC<PptxRenderOverlayProps> = React.memo(({ fileBytes, contentId, activeSlideIndex }) => {',
  'export const PptxRenderOverlay: React.FC<PptxRenderOverlayProps> = React.memo(({ fileBytes, contentId, activeSlideIndex, isThumbnail }) => {'
);

code = code.replace(
  '<PptxViewerInner bytes={localBytes} activeSlideIndex={activeSlideIndex} contentId={contentId} />',
  '<PptxViewerInner bytes={localBytes} activeSlideIndex={activeSlideIndex} contentId={contentId} isThumbnail={isThumbnail} />'
);

code = code.replace(
  'activeSlideIndex: number;',
  'activeSlideIndex: number;\n  isThumbnail?: boolean;' // Wait, PptxViewerInnerProps
);
fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);

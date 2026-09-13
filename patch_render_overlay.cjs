const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

code = code.replace(
  'isThumbnail?: boolean;',
  "isThumbnail?: boolean;\n  pptxAction?: 'next' | 'prev' | null;\n  pptxActionTimestamp?: number;\n  onActiveSlideChange?: (index: number) => void;"
);

code = code.replace(
  'export const PptxRenderOverlay: React.FC<PptxRenderOverlayProps> = React.memo(({ fileBytes, contentId, activeSlideIndex, isThumbnail }) => {',
  'export const PptxRenderOverlay: React.FC<PptxRenderOverlayProps> = React.memo(({ fileBytes, contentId, activeSlideIndex, isThumbnail, pptxAction, pptxActionTimestamp, onActiveSlideChange }) => {'
);

code = code.replace(
  '<PptxViewerInner bytes={localBytes} activeSlideIndex={activeSlideIndex} contentId={contentId} isThumbnail={isThumbnail} />',
  '<PptxViewerInner bytes={localBytes} activeSlideIndex={activeSlideIndex} contentId={contentId} isThumbnail={isThumbnail} pptxAction={pptxAction} pptxActionTimestamp={pptxActionTimestamp} onActiveSlideChange={onActiveSlideChange} />'
);

code = code.replace(
  'isThumbnail?: boolean;', // wait, this was PptxViewerInnerProps!
  "isThumbnail?: boolean;\n  pptxAction?: 'next' | 'prev' | null;\n  pptxActionTimestamp?: number;\n  onActiveSlideChange?: (index: number) => void;" // will replace the second one
);

code = code.replace(
  'const PptxViewerInner: React.FC<PptxViewerInnerProps> = React.memo(({ bytes, activeSlideIndex, isThumbnail }) => {',
  'const PptxViewerInner: React.FC<PptxViewerInnerProps> = React.memo(({ bytes, activeSlideIndex, isThumbnail, pptxAction, pptxActionTimestamp, onActiveSlideChange }) => {'
);

code = code.replace(
  'canEdit: false,',
  'canEdit: false,\n    onActiveSlideChange,'
);

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);

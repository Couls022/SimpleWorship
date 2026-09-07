const fs = require('fs');

// 1. Add canonical key generator to SlideRenderCache.ts
let cacheCode = fs.readFileSync('src/utils/SlideRenderCache.ts', 'utf8');
const canonicalFn = `
export function getSlideRenderKey(contentId?: string, bytes?: Uint8Array | null): string {
  if (contentId) {
    return \`pptx_item_\${contentId}\`;
  }
  if (bytes) {
    const len = bytes.length;
    return \`pptx_bytes_\${len}_\${bytes.slice(0, 32).join('_')}\`;
  }
  return '';
}
`;
if (!cacheCode.includes('getSlideRenderKey')) {
  cacheCode += canonicalFn;
  fs.writeFileSync('src/utils/SlideRenderCache.ts', cacheCode);
}

// 2. Update PptxRenderOverlay.tsx
let overlayCode = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');
overlayCode = overlayCode.replace(
  "import { useSlideRenderCache } from '../utils/SlideRenderCache';",
  "import { useSlideRenderCache, getSlideRenderKey } from '../utils/SlideRenderCache';"
);
overlayCode = overlayCode.replace(
  `interface PptxViewerInnerProps {
  bytes: Uint8Array;
  activeSlideIndex: number;
}`,
  `interface PptxViewerInnerProps {
  bytes: Uint8Array;
  activeSlideIndex: number;
  contentId?: string;
}`
);
overlayCode = overlayCode.replace(
  `const PptxViewerInner: React.FC<PptxViewerInnerProps> = ({ bytes, activeSlideIndex }) => {`,
  `const PptxViewerInner: React.FC<PptxViewerInnerProps> = ({ bytes, activeSlideIndex, contentId }) => {`
);
overlayCode = overlayCode.replace(
  `  const bytesKey = useMemo(() => {
    if (!bytes) return '';
    const len = bytes.length;
    return \`pptx_bytes_\${len}_\${bytes.slice(0, 32).join('_')}\`;
  }, [bytes]);`,
  `  const bytesKey = useMemo(() => getSlideRenderKey(contentId, bytes), [contentId, bytes]);`
);
overlayCode = overlayCode.replace(
  `<PptxViewerInner bytes={localBytes} activeSlideIndex={activeSlideIndex}/>`,
  `<PptxViewerInner bytes={localBytes} activeSlideIndex={activeSlideIndex} contentId={contentId} />`
);
fs.writeFileSync('src/components/PptxRenderOverlay.tsx', overlayCode);

// 3. Update PptxSlideThumbnail.tsx
let thumbCode = fs.readFileSync('src/components/PptxSlideThumbnail.tsx', 'utf8');
thumbCode = thumbCode.replace(
  "import { useSlideRenderCache } from '../utils/SlideRenderCache';",
  "import { useSlideRenderCache, getSlideRenderKey } from '../utils/SlideRenderCache';"
);
thumbCode = thumbCode.replace(
  /const bytesKey = useMemo\(\(\) => \{[\s\S]*?\}, \[slide, liveItem\]\);/,
  `const bytesKey = useMemo(() => {
    const slideBytes = (slide as any).fileBytes || liveItem?.data?.fileBytes;
    const uint8Bytes = toValidPptxUint8Array(slideBytes);
    const contentId = liveItem?.contentId || liveItem?.id;
    return getSlideRenderKey(contentId, uint8Bytes);
  }, [slide, liveItem]);`
);
fs.writeFileSync('src/components/PptxSlideThumbnail.tsx', thumbCode);

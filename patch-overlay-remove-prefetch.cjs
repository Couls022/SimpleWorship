const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

const prefetchStart = `const PrefetchSlide: React.FC<{`;
const prefetchStartIdx = code.indexOf(prefetchStart);

const nextComponentStart = `interface PptxViewerInnerProps`;
const nextComponentStartIdx = code.indexOf(nextComponentStart);

if (prefetchStartIdx !== -1 && nextComponentStartIdx !== -1) {
  code = code.slice(0, prefetchStartIdx) + code.slice(nextComponentStartIdx);
}

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);

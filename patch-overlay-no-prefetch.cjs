const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

// Replace the prefetch stuff with nothing, only render SlideCanvas
const innerStart = `const PptxViewerInner: React.FC<PptxViewerInnerProps> = ({ bytes, activeSlideIndex, contentId }) => {`;
const innerStartIdx = code.indexOf(innerStart);

code = code.replace(
  /const \[prefetchQueue, setPrefetchQueue\] = useState<number\[\]>\(\[\]\);\s*const \[prefetchIndex, setPrefetchIndex\] = useState<number \| null>\(null\);\s*const onPrefetchCaptured = \(\) => \{\s*setPrefetchQueue\(prev => \{\s*const nextQueue = prev\.slice\(1\);\s*setPrefetchIndex\(nextQueue\.length > 0 \? nextQueue\[0\] : null\);\s*return nextQueue;\s*\}\);\s*\};/,
  ''
);

code = code.replace(
  /useEffect\(\(\) => \{\s*if \(cachedFrame\?\.objectUrl && prefetchQueue\.length === 0 && prefetchIndex === null\) \{.*?\s*\}\s*\}, \[cachedFrame\?\.objectUrl, blocks\.canvasProps\?\.allSlides\?\.length, activeSlideIndex\]\);/s,
  ''
);

code = code.replace(
  /\{prefetchIndex !== null && \(\s*<PrefetchSlide bytesKey=\{bytesKey\} slideIndex=\{prefetchIndex\} blocks=\{blocks\} customZoom=\{customZoom\} onCaptured=\{onPrefetchCaptured\} \/>\s*\)\}/,
  ''
);

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);

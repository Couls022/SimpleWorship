const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

// We are going to find PptxViewerInner and replace its body up to blocks
const innerStart = `const PptxViewerInner: React.FC<PptxViewerInnerProps> = ({ bytes, activeSlideIndex, contentId }) => {`;
const innerStartIdx = code.indexOf(innerStart);
if (innerStartIdx !== -1) {
  // Replace the prefetchState definition
  code = code.replace(
    /const \[prefetchState, setPrefetchState\] = useState<"idle" \| "prev" \| "next" \| "done">\(.*?\);/,
    `const [prefetchQueue, setPrefetchQueue] = useState<number[]>([]);
  const [prefetchIndex, setPrefetchIndex] = useState<number | null>(null);

  const onPrefetchCaptured = () => {
    setPrefetchQueue(prev => {
      const nextQueue = prev.slice(1);
      setPrefetchIndex(nextQueue.length > 0 ? nextQueue[0] : null);
      return nextQueue;
    });
  };`
  );

  // Remove the old useEffect that triggers prefetchState="prev"
  code = code.replace(
    /useEffect\(\(\) => \{\s*if \(cachedFrame\?\.objectUrl && prefetchState === "idle"\) \{\s*setPrefetchState\("prev"\);\s*\}\s*\}, \[cachedFrame\?\.objectUrl, prefetchState\]\);/,
    `useEffect(() => {
    if (cachedFrame?.objectUrl && prefetchQueue.length === 0 && prefetchIndex === null) {
      if (!blocks.canvasProps) return;
      const totalSlides = blocks.canvasProps.totalSlides || 1;
      const queue: number[] = [];
      for (let offset = 1; offset < totalSlides; offset++) {
        if (activeSlideIndex + offset < totalSlides) queue.push(activeSlideIndex + offset);
        if (activeSlideIndex - offset >= 0) queue.push(activeSlideIndex - offset);
      }
      setPrefetchQueue(queue);
      setPrefetchIndex(queue.length > 0 ? queue[0] : null);
    }
  }, [cachedFrame?.objectUrl, blocks.canvasProps?.totalSlides, activeSlideIndex]);`
  );

  // Replace the render block
  code = code.replace(
    /\{prefetchState === "prev".*?onCaptured=\{\(\) => setPrefetchState\("next"\)\}.*?\n.*?\n.*?\}/s,
    `{prefetchIndex !== null && (
        <PrefetchSlide bytesKey={bytesKey} slideIndex={prefetchIndex} blocks={blocks} customZoom={customZoom} onCaptured={onPrefetchCaptured} />
      )}`
  );
}

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);

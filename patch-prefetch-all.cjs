const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

const newPrefetch = `  const [prefetchQueue, setPrefetchQueue] = useState<number[]>([]);
  const [prefetchIndex, setPrefetchIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!blocks.canvasProps) return;
    const totalSlides = blocks.canvasProps.totalSlides || 1;
    const queue: number[] = [];
    for (let offset = 1; offset < totalSlides; offset++) {
      if (activeSlideIndex + offset < totalSlides) queue.push(activeSlideIndex + offset);
      if (activeSlideIndex - offset >= 0) queue.push(activeSlideIndex - offset);
    }
    setPrefetchQueue(queue);
    setPrefetchIndex(queue.length > 0 ? queue[0] : null);
  }, [activeSlideIndex, blocks.canvasProps?.totalSlides]);

  const onPrefetchCaptured = () => {
    setPrefetchQueue(prev => {
      const nextQueue = prev.slice(1);
      setPrefetchIndex(nextQueue.length > 0 ? nextQueue[0] : null);
      return nextQueue;
    });
  };
`;

code = code.replace(
  `  const [prefetchState, setPrefetchState] = useState<"idle" | "prev" | "next" | "done">("idle");`,
  newPrefetch
);

code = code.replace(
  `  useEffect(() => {
    setPrefetchState("prev");
  }, [activeSlideIndex]);`,
  ``
);

code = code.replace(
  `      {prefetchState === "prev" && activeSlideIndex > 0 && (
        <PrefetchSlide bytesKey={bytesKey} slideIndex={activeSlideIndex - 1} blocks={blocks} customZoom={customZoom} onCaptured={() => setPrefetchState("next")} />
      )}
      {prefetchState === "next" && (
        <PrefetchSlide bytesKey={bytesKey} slideIndex={activeSlideIndex + 1} blocks={blocks} customZoom={customZoom} onCaptured={() => setPrefetchState("done")} />
      )}`,
  `      {prefetchIndex !== null && (
        <PrefetchSlide bytesKey={bytesKey} slideIndex={prefetchIndex} blocks={blocks} customZoom={customZoom} onCaptured={onPrefetchCaptured} />
      )}`
);

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);

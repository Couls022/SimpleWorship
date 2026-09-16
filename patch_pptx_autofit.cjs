const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

// 1. Add containerSize state and ResizeObserver useEffect right after `const containerRef = useRef<HTMLDivElement>(null);`
const refRegex = /const containerRef = useRef<HTMLDivElement>\(null\);/;
const resizeLogic = `const containerRef = useRef<HTMLDivElement>(null);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    let animationFrameId = null;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      
      // Use requestAnimationFrame to debounce and prevent ResizeObserver loop limit errors
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize(prev => prev.width === width && prev.height === height ? prev : { width, height });
        }
      });
    });
    
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    };
  }, []);
`;
code = code.replace(refRegex, resizeLogic);

// 2. Modify customZoom to calculate and inject editorScale
const zoomRegex = /const customZoom = useMemo\(\(\) => \{[\s\S]*?\}, \[blocks\.canvasProps\?\.zoom\]\);/;
const zoomLogic = `const customZoom = useMemo(() => {
    let scale = 1;
    if (containerSize.width > 0 && containerSize.height > 0 && canvasWidth > 0 && canvasHeight > 0) {
      // Calculate scale to fit container width/height perfectly
      scale = Math.min(containerSize.width / canvasWidth, containerSize.height / canvasHeight);
    }
    
    if (!blocks.canvasProps?.zoom) return { editorScale: scale };
    return { ...blocks.canvasProps.zoom, editorScale: scale };
  }, [blocks.canvasProps?.zoom, containerSize.width, containerSize.height, canvasWidth, canvasHeight]);`;
code = code.replace(zoomRegex, zoomLogic);

// 3. Make sure the container is flex items-center justify-center
const containerClassRegex = /className="w-full h-full bg-black overflow-hidden relative flex items-start justify-start select-none pptx-strict-typography cursor-pointer"/;
code = code.replace(containerClassRegex, 'className="w-full h-full bg-black overflow-hidden relative flex items-center justify-center select-none pptx-strict-typography cursor-pointer"');

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);
console.log('patched');

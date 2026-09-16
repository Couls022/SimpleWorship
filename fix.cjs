const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/components/PptxRenderOverlay.tsx');
let code = fs.readFileSync(file, 'utf8');

const t1 = `  const containerRef = useRef<HTMLDivElement>(null);
  const lastReportedSlideRef = useRef<number>(-1);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 1920, height: 1080 });
  const [slideCount, setSlideCount] = useState<number>(1);
  const [allSlidesState, setAllSlidesState] = useState<any[]>([]);

  const handleSlideChange = useCallback((index: number) => {`;

const r1 = `  const containerRef = useRef<HTMLDivElement>(null);
  const lastReportedSlideRef = useRef<number>(-1);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [slideCount, setSlideCount] = useState<number>(1);
  const [allSlidesState, setAllSlidesState] = useState<any[]>([]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    let animationFrameId = null;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      
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

  const handleSlideChange = useCallback((index: number) => {`;

code = code.replace(t1, r1);

const t2 = `  const customZoom = useMemo(() => {
    if (!blocks.canvasProps?.zoom) return undefined;
    return blocks.canvasProps.zoom;
  }, [blocks.canvasProps?.zoom]);`;

const r2 = `  const customZoom = useMemo(() => {
    let scale = 1;
    if (containerSize.width > 0 && containerSize.height > 0 && canvasWidth > 0 && canvasHeight > 0) {
      scale = Math.min(containerSize.width / canvasWidth, containerSize.height / canvasHeight);
    }
    
    if (!blocks.canvasProps?.zoom) return { editorScale: scale };
    return { ...blocks.canvasProps.zoom, editorScale: scale };
  }, [blocks.canvasProps?.zoom, containerSize.width, containerSize.height, canvasWidth, canvasHeight]);`;

code = code.replace(t2, r2);

const t3 = `className="w-full h-full bg-black overflow-hidden relative flex items-center justify-center select-none pptx-strict-typography cursor-pointer"`;
const r3 = `className="w-full h-full bg-black overflow-hidden relative flex items-start justify-start select-none pptx-strict-typography cursor-pointer"`;

code = code.replace(t3, r3);

fs.writeFileSync(file, code);
console.log('patched successfully');

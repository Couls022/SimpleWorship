const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

// 1. Add containerSize state
const stateCode = `  const [slideCount, setSlideCount] = useState<number>(1);`;
const stateReplacement = `  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 1920, height: 1080 });\n  const [slideCount, setSlideCount] = useState<number>(1);`;
if(code.includes(stateCode) && !code.includes('const [containerSize')) {
    code = code.replace(stateCode, stateReplacement);
}

// 2. Add ResizeObserver back
const observerCode = `  const lastProcessedActionTsRef = useRef<number | null>(null);`;
const observerReplacement = `  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let animationFrameId = null;

    const getUnscaledDimensions = () => {
      const rect = el.getBoundingClientRect();
      let width = rect.width;
      let height = rect.height;
      if (!width || !height) {
        let parent = el.parentElement;
        while (parent && (!width || !height)) {
          const prect = parent.getBoundingClientRect();
          width = prect.width;
          height = prect.height;
          parent = parent.parentElement;
        }
      }
      return { width: width > 0 ? width : 1920, height: height > 0 ? height : 1080 };
    };

    const updateSize = (entries) => {
      if (animationFrameId !== null) return;
      animationFrameId = requestAnimationFrame(() => {
        animationFrameId = null;
        if (!el) return;
        
        let dims = { width: 0, height: 0 };
        if (entries && entries.length > 0 && entries[0].contentRect.width > 0) {
          dims = { 
            width: entries[0].contentRect.width, 
            height: entries[0].contentRect.height 
          };
        } else {
          dims = getUnscaledDimensions();
        }

        if (dims.width > 0 && dims.height > 0) {
          setContainerSize(prev => (Math.abs(prev.width - dims.width) < 1 && Math.abs(prev.height - dims.height) < 1 ? prev : dims));
        }
      });
    };

    const ro = new ResizeObserver((entries) => updateSize(entries));
    ro.observe(el);
    updateSize();

    return () => {
      ro.disconnect();
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const lastProcessedActionTsRef = useRef<number | null>(null);`;

if(code.includes(observerCode) && !code.includes('const getUnscaledDimensions')) {
    code = code.replace(observerCode, observerReplacement);
}

// 3. Define canvas size and scale wrapper
const zoomCode = `  const customZoom = useMemo(() => {
    if (!blocks.canvasProps?.zoom) return undefined;
    return blocks.canvasProps.zoom;
  }, [blocks.canvasProps?.zoom]);`;

const zoomReplacement = `  const canvasWidth = blocks.canvasProps?.canvasSize?.width || 960;
  const canvasHeight = blocks.canvasProps?.canvasSize?.height || 540;

  const targetScale = useMemo(() => {
    const targetW = containerSize.width;
    const targetH = containerSize.height;
    if (!targetW || !targetH || !canvasWidth || !canvasHeight) return 1;
    const scale = Math.min(targetW / canvasWidth, targetH / canvasHeight);
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  }, [containerSize.width, containerSize.height, canvasWidth, canvasHeight]);

  const customZoom = useMemo(() => {
    return { ...(blocks.canvasProps?.zoom || {}), editorScale: 1 };
  }, [blocks.canvasProps?.zoom]);`;

if(code.includes(zoomCode)) {
    code = code.replace(zoomCode, zoomReplacement);
}

// 4. Wrap SlideCanvas in the scaled div
const renderCode = `      <SlideCanvas 
        {...blocks.canvasProps} 
        activeSlide={effectiveActiveSlide}
        presentationElementStates={!isThumbnail ? presentationElementStates : undefined}
        presentationKeyframesCss={!isThumbnail ? presentationKeyframesCss : undefined}
        zoom={customZoom} 
        mode="present"
        showRulers={false} 
        showGrid={false} 
        canEdit={false} 
      />`;

const renderReplacement = `      <div 
        className="absolute transform-gpu"
        style={{
          width: canvasWidth,
          height: canvasHeight,
          transform: \`scale(\${targetScale})\`,
          transformOrigin: 'center center'
        }}
      >
        <SlideCanvas 
          {...blocks.canvasProps} 
          activeSlide={effectiveActiveSlide}
          presentationElementStates={!isThumbnail ? presentationElementStates : undefined}
          presentationKeyframesCss={!isThumbnail ? presentationKeyframesCss : undefined}
          zoom={customZoom} 
          mode="present"
          showRulers={false} 
          showGrid={false} 
          canEdit={false} 
        />
      </div>`;

if(code.includes(renderCode) && !code.includes('className="absolute transform-gpu"')) {
    code = code.replace(renderCode, renderReplacement);
}

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);
console.log('patched PptxRenderOverlay scale logic');

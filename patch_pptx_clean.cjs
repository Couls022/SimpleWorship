const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

// 1. Remove my targetScale useMemo
code = code.replace(/const targetScale = useMemo\(\(\) => \{[\s\S]*?\}, \[containerSize\.width, containerSize\.height, canvasWidth, canvasHeight\]\);\s*/, '');

// 2. Restore customZoom to original
const customZoomRegex = /const customZoom = useMemo\(\(\) => \{[\s\S]*?\}, \[blocks\.canvasProps\?\.zoom, isProjectorMode\]\);/;
const customZoomReplacement = `  const customZoom = useMemo(() => {
    if (!blocks.canvasProps?.zoom) return undefined;
    return blocks.canvasProps.zoom;
  }, [blocks.canvasProps?.zoom]);`;
code = code.replace(customZoomRegex, customZoomReplacement);

// 3. Remove containerSize state and ResizeObserver
code = code.replace(/const \[containerSize, setContainerSize\] = useState[^;]+;\n/, '');
code = code.replace(/useEffect\(\(\) => \{\n\s*const el = containerRef\.current;[\s\S]*?ro\.disconnect\(\);\n\s*if \(animationFrameId !== null\) cancelAnimationFrame\(animationFrameId\);\n\s*\}\;\n\s*\}, \[\]\);\n/, '');

// 4. Restore the render block to just SlideCanvas, but remove flex centering for projector
const renderRegex = /\{isProjectorMode \? \([\s\S]*?\}\)/;
const renderReplacement = `<SlideCanvas 
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
code = code.replace(renderRegex, renderReplacement);

// 5. Change flex centering in outer div conditionally
code = code.replace(/className="w-full h-full bg-black overflow-hidden relative flex items-center justify-center select-none pptx-strict-typography cursor-pointer"/, 
  'className={`w-full h-full bg-black overflow-hidden relative flex select-none pptx-strict-typography cursor-pointer ${isProjectorMode ? "items-start justify-start" : "items-center justify-center"}`}');

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);
console.log('patched');

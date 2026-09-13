const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

const effectCode = `
  useEffect(() => {
    if (handleRef.current && typeof handleRef.current.goTo === 'function') {
      try {
        if (handleRef.current.getMode && handleRef.current.getMode() !== 'present') {
          handleRef.current.setMode('present');
        }
        handleRef.current.goTo(activeSlideIndex);
      } catch (e) {
        console.warn('[PptxViewerInner] goTo slide index error:', e);
      }
    }
  }, [activeSlideIndex, blocks.loading]);
`;

const oldEffectCode = `
  useEffect(() => {
    if (handleRef.current && typeof handleRef.current.goTo === 'function') {
      try {
        handleRef.current.goTo(activeSlideIndex);
      } catch (e) {
        console.warn('[PptxViewerInner] goTo slide index error:', e);
      }
    }
  }, [activeSlideIndex, blocks.loading]);
`;

if(code.includes('handleRef.current.goTo(activeSlideIndex);')) {
    code = code.replace(oldEffectCode.trim(), effectCode.trim());
    
    // ensure SlideCanvas is clean
    const oldSlideCanvas = `<SlideCanvas 
          {...blocks.canvasProps} 
          {...(currentSlide ? { activeSlide: currentSlide } : {})}
          activeSlideIndex={activeSlideIndex}
          zoom={customZoom || blocks.canvasProps.zoom} 
          mode="present"
          showRulers={false} 
          showGrid={false} 
          canEdit={false} 
        />`;

    const cleanSlideCanvas = `<SlideCanvas 
          {...blocks.canvasProps} 
          {...(currentSlide ? { activeSlide: currentSlide } : {})}
          activeSlideIndex={activeSlideIndex}
          zoom={customZoom || blocks.canvasProps.zoom} 
          mode="present"
          showRulers={false} 
          showGrid={false} 
          canEdit={false} 
        />`;
    
    fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);
    console.log('patched');
} else {
    console.log('not found');
}

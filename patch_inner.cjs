const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

const oldEffect = `
  useEffect(() => {
    if (handleRef.current && typeof handleRef.current.goTo === 'function') {
      try {
        const isPresent = handleRef.current.getMode && handleRef.current.getMode() === 'present';
        if (!isPresent) {
          handleRef.current.setMode('present');
        }
        
        // When in present mode, pptx-react-viewer's internal goTo() doesn't properly trigger entrance animations
        // We dispatch keyboard events to simulate jumping to the slide number (which triggers the proper internal navigateToSlide).
        const slideNumber = (activeSlideIndex + 1).toString();
        for (const char of slideNumber) {
           window.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        }
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        
      } catch (e) {
        console.warn('[PptxViewerInner] goTo slide index error:', e);
      }
    }
  }, [activeSlideIndex, blocks.loading]);
`;

const newEffect = `
  useEffect(() => {
    if (handleRef.current && typeof handleRef.current.goTo === 'function') {
      try {
        if (isThumbnail) {
           if (handleRef.current.getMode && handleRef.current.getMode() !== 'view') {
             handleRef.current.setMode('view');
           }
           handleRef.current.goTo(activeSlideIndex);
           return;
        }

        const isPresent = handleRef.current.getMode && handleRef.current.getMode() === 'present';
        if (!isPresent) {
          handleRef.current.setMode('present');
        }
        
        // When in present mode, pptx-react-viewer's internal goTo() doesn't properly trigger entrance animations
        // We dispatch keyboard events to simulate jumping to the slide number (which triggers the proper internal navigateToSlide).
        const slideNumber = (activeSlideIndex + 1).toString();
        for (const char of slideNumber) {
           window.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        }
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        
      } catch (e) {
        console.warn('[PptxViewerInner] goTo slide index error:', e);
      }
    }
  }, [activeSlideIndex, blocks.loading, isThumbnail]);
`;

code = code.replace(oldEffect.trim(), newEffect.trim());

const oldCanvas = `<SlideCanvas 
          {...blocks.canvasProps} 
          zoom={customZoom || blocks.canvasProps.zoom} 
          mode="present"
          showRulers={false} 
          showGrid={false} 
          canEdit={false} 
        />`;

const newCanvas = `<SlideCanvas 
          {...blocks.canvasProps} 
          zoom={customZoom || blocks.canvasProps.zoom} 
          mode={isThumbnail ? "view" : "present"}
          showRulers={false} 
          showGrid={false} 
          canEdit={false} 
        />`;

code = code.replace(oldCanvas.trim(), newCanvas.trim());
fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);

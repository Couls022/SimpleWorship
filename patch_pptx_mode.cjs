const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

const originalSlideCanvas = `<SlideCanvas 
          {...blocks.canvasProps} 
          {...(currentSlide ? { activeSlide: currentSlide } : {})}
          activeSlideIndex={activeSlideIndex}
          zoom={customZoom || blocks.canvasProps.zoom} 
          showRulers={false} 
          showGrid={false} 
          canEdit={false} 
        />`;

const newSlideCanvas = `<SlideCanvas 
          {...blocks.canvasProps} 
          {...(currentSlide ? { activeSlide: currentSlide } : {})}
          activeSlideIndex={activeSlideIndex}
          zoom={customZoom || blocks.canvasProps.zoom} 
          mode="present"
          showRulers={false} 
          showGrid={false} 
          canEdit={false} 
        />`;

if(code.includes('canEdit={false}')) {
    code = code.replace(originalSlideCanvas, newSlideCanvas);
    fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);
    console.log('patched');
} else {
    console.log('not found');
}

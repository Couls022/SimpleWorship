const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

const oldCanvas = `<SlideCanvas 
          {...blocks.canvasProps} 
          {...(currentSlide ? { activeSlide: currentSlide } : {})}
          activeSlideIndex={activeSlideIndex}
          zoom={customZoom || blocks.canvasProps.zoom} 
          mode="present"
          showRulers={false} 
          showGrid={false} 
          canEdit={false} 
        />`;

const newCanvas = `<SlideCanvas 
          {...blocks.canvasProps} 
          zoom={customZoom || blocks.canvasProps.zoom} 
          mode="present"
          showRulers={false} 
          showGrid={false} 
          canEdit={false} 
        />`;

code = code.replace(oldCanvas, newCanvas);
fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);
console.log('patched SlideCanvas to use native props');

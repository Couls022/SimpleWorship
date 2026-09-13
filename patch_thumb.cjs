const fs = require('fs');
let code = fs.readFileSync('src/components/PptxSlideThumbnail.tsx', 'utf8');
const search = `        <PresentationSlideView 
          slide={slide} 
          slideIndex={slideIndex} 
          totalSlides={totalSlides} 
          mode="thumbnail" 
          themeStyles={themeStyles} 
        />`;

const replace = `
        {fileBytes ? (
          <div className="w-full h-full pointer-events-none">
            <PptxRenderOverlay 
              activeSlideIndex={slideIndex} 
              fileBytes={fileBytes} 
              contentId={contentId} 
            />
          </div>
        ) : (
          <PresentationSlideView 
            slide={slide} 
            slideIndex={slideIndex} 
            totalSlides={totalSlides} 
            mode="thumbnail" 
            themeStyles={themeStyles} 
          />
        )}`;

code = code.replace(search, replace);
code = `import { PptxRenderOverlay } from './PptxRenderOverlay';\n` + code;
fs.writeFileSync('src/components/PptxSlideThumbnail.tsx', code);

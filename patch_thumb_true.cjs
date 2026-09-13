const fs = require('fs');
let code = fs.readFileSync('src/components/PptxSlideThumbnail.tsx', 'utf8');
code = code.replace(
  '<PptxRenderOverlay \n              activeSlideIndex={slideIndex} \n              fileBytes={fileBytes} \n              contentId={contentId} \n            />',
  '<PptxRenderOverlay \n              activeSlideIndex={slideIndex} \n              fileBytes={fileBytes} \n              contentId={contentId} \n              isThumbnail={true}\n            />'
);
fs.writeFileSync('src/components/PptxSlideThumbnail.tsx', code);

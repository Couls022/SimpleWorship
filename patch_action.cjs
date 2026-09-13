const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

const oldEffect = `
        // Jump directly
        handleRef.current.goTo(activeSlideIndex);
`;

const newEffect = `
        // Jump directly unless there's an action
        if (pptxAction === 'next') {
           handleRef.current.goNext();
        } else if (pptxAction === 'prev') {
           handleRef.current.goPrev();
        } else {
           handleRef.current.goTo(activeSlideIndex);
        }
`;

code = code.replace(oldEffect.trim(), newEffect.trim());

// Also we need to add pptxAction and pptxActionTimestamp to the dependency array
code = code.replace(
  '}, [activeSlideIndex, blocks.loading, isThumbnail]);',
  '}, [activeSlideIndex, blocks.loading, isThumbnail, pptxAction, pptxActionTimestamp]);'
);

// We should also make sure PptxRenderOverlay passes onActiveSlideChange down
// Wait, I already added onActiveSlideChange to the inner props and usage!

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);

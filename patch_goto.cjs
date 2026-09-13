const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

const oldEffect = `
        if (activeSlideIndex === prev + 1) {
           // Sequential advance: trigger native transition
           window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true }));
        } else if (activeSlideIndex === prev - 1) {
           // Sequential back
           window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true }));
        } else {
           // Jump directly
           const slideNumber = (activeSlideIndex + 1).toString();
           for (const char of slideNumber) {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
           }
           window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }
`;

const newEffect = `
        // Jump directly
        handleRef.current.goTo(activeSlideIndex);
`;

code = code.replace(oldEffect.trim(), newEffect.trim());
fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);

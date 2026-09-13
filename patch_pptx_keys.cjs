const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

const playCode = `
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

// regex replace the old useEffect handling goTo
code = code.replace(/useEffect\(\(\) => \{\s+if \(handleRef\.current.*(?:[\s\S]*?)\[activeSlideIndex, blocks\.loading\]\);/m, playCode.trim());
fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);
console.log('patched to use keyboard simulation');

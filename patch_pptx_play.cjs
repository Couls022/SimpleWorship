const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

const playCode = `
  useEffect(() => {
    if (handleRef.current && typeof handleRef.current.goTo === 'function') {
      try {
        if (handleRef.current.getMode && handleRef.current.getMode() !== 'present') {
          handleRef.current.setMode('present');
        }
        handleRef.current.goTo(activeSlideIndex);
        
        // Ensure animations play by triggering action
        if (handleRef.current.playAnimations) {
           handleRef.current.playAnimations();
        } else if (handleRef.current.resume) {
           handleRef.current.resume();
        }
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

if(code.includes('handleRef.current.goTo(activeSlideIndex);')) {
    code = code.replace(oldEffectCode.trim(), playCode.trim());
    fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);
    console.log('patched play sequence');
} else {
    console.log('not found');
}

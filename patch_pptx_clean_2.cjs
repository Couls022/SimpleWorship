const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

// The file has a syntax error between `onClickCapture` and `LRUCache`. We'll just replace that entire chunk!
const startMark = "      onClickCapture={(e) => {";
const endMark = "class LRUCache<K, V> {";
const startIndex = code.indexOf(startMark);
const endIndex = code.indexOf(endMark);

const correctChunk = `      onClickCapture={(e) => {
        // Prevent PPTX viewer from handling the click internally
        e.stopPropagation();
        
        // If we are in the moderator preview panel (not projector, not thumbnail), trigger next step
        if (!isProjectorMode && !isThumbnail) {
          window.dispatchEvent(new CustomEvent('simpleworship:pptx-click'));
        }
      }}
    >
      <SlideCanvas 
        {...blocks.canvasProps} 
        activeSlide={effectiveActiveSlide}
        presentationElementStates={!isThumbnail ? presentationElementStates : undefined}
        presentationKeyframesCss={!isThumbnail ? presentationKeyframesCss : undefined}
        zoom={customZoom} 
        mode="present"
        showRulers={false} 
        showGrid={false} 
        canEdit={false} 
      />
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.activeSlideIndex === nextProps.activeSlideIndex && 
    prevProps.bytes === nextProps.bytes &&
    prevProps.isThumbnail === nextProps.isThumbnail &&
    prevProps.isProjectorMode === nextProps.isProjectorMode &&
    prevProps.pptxAction === nextProps.pptxAction &&
    prevProps.pptxActionTimestamp === nextProps.pptxActionTimestamp
  );
});

`;

code = code.substring(0, startIndex) + correctChunk + code.substring(endIndex);

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);
console.log('patched');

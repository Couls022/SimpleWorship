const fs = require('fs');

// 1. Fix MonitorPreviewCanvas
let monitorCode = fs.readFileSync('src/components/MonitorPreviewCanvas.tsx', 'utf8');
monitorCode = monitorCode.replace(
  'useStore.getState().setStagedGroupState(groupId || \\'group-congregation\\', {\\n                          activeSlideIndex: index,\\n                          pptxAction: null,\\n                       });',
  'const currentState = useStore.getState().stagedGroupStates[groupId || \\'group-congregation\\'];\\n                       if (currentState?.activeSlideIndex !== index || currentState?.pptxAction !== null) {\\n                         useStore.getState().setStagedGroupState(groupId || \\'group-congregation\\', {\\n                            activeSlideIndex: index,\\n                            pptxAction: null,\\n                         });\\n                       }'
);
fs.writeFileSync('src/components/MonitorPreviewCanvas.tsx', monitorCode);

// 2. Fix PptxRenderOverlay custom memo
let overlayCode = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');
overlayCode = overlayCode.replace(
  '    prevProps.fileBytes === nextProps.fileBytes\\n  );\\n});',
  '    prevProps.fileBytes === nextProps.fileBytes &&\\n    prevProps.isThumbnail === nextProps.isThumbnail &&\\n    prevProps.pptxAction === nextProps.pptxAction &&\\n    prevProps.pptxActionTimestamp === nextProps.pptxActionTimestamp\\n  );\\n});'
);

// 3. Make sure to fix mode='view' to mode='preview'
overlayCode = overlayCode.replace(
  'handleRef.current.getMode() !== \\'view\\'',
  'handleRef.current.getMode() !== \\'preview\\''
);
overlayCode = overlayCode.replace(
  'handleRef.current.setMode(\\'view\\');',
  'handleRef.current.setMode(\\'preview\\');'
);

// 4. Memoize the onActiveSlideChange in MonitorPreviewCanvas
// Actually, it doesn't matter if it's inline if we only update store when necessary!

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', overlayCode);

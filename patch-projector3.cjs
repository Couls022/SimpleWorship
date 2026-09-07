const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectorView.tsx', 'utf8');

const hookInsertStr = `
  const pptxBytesKey = React.useMemo(() => {
    const isPptx = activeItem?.type === 'presentation' || activeItem?.type === 'ppt';
    if (!isPptx) return '';
    const bytes = activeItem?.data?.fileBytes;
    if (bytes) {
      return getSlideRenderKey(activeItem?.contentId, toValidPptxUint8Array(bytes));
    }
    return getSlideRenderKey(activeItem?.contentId, null);
  }, [activeItem]);

  const { cachedFrame } = useSlideRenderCache(pptxBytesKey, presentationState.activeSlideIndex || 0);
`;

code = code.replace(
  `  const activeItem = PresentationCore.getActiveContent(
    activeSchedule, 
    presentationState, 
    presentationState.directLiveItem
  );`,
  `  const activeItem = PresentationCore.getActiveContent(
    activeSchedule, 
    presentationState, 
    presentationState.directLiveItem
  );\n${hookInsertStr}`
);

fs.writeFileSync('src/components/ProjectorView.tsx', code);

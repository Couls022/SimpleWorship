const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectorView.tsx', 'utf8');

if (!code.includes('useSlideRenderCache')) {
  code = code.replace(
    `import { PptxRenderOverlay } from './PptxRenderOverlay';`,
    `import { PptxRenderOverlay } from './PptxRenderOverlay';\nimport { useSlideRenderCache, getSlideRenderKey } from '../utils/SlideRenderCache';\nimport { toValidPptxUint8Array } from '../utils/pptxValidator';`
  );
}

const hookInsertStr = `const pptxBytesKey = useMemo(() => {
    if (!isPptx) return '';
    const bytes = activeItem?.data?.fileBytes;
    if (bytes) {
      return getSlideRenderKey(activeItem?.contentId, toValidPptxUint8Array(bytes));
    }
    return getSlideRenderKey(activeItem?.contentId, null);
  }, [isPptx, activeItem?.contentId, activeItem?.data?.fileBytes]);

  const { cachedFrame } = useSlideRenderCache(pptxBytesKey, presentationState.activeSlideIndex || 0);`;

// Let's inject this hook inside ProjectorView
code = code.replace(
  /const isPptx = activeItem\?\.type === 'presentation' \|\| activeItem\?\.type === 'ppt';/,
  `const isPptx = activeItem?.type === 'presentation' || activeItem?.type === 'ppt';\n  ${hookInsertStr}`
);

// Now change the rendering
code = code.replace(
  /<PptxRenderOverlay\s*fileBytes=\{activeItem\?\.data\?\.fileBytes\}\s*contentId=\{activeItem\?\.contentId\}\s*activeSlideIndex=\{presentationState\.activeSlideIndex \|\| 0\}\s*\/>/s,
  `{cachedFrame?.objectUrl ? (
              <img src={cachedFrame.objectUrl} alt="" className="w-full h-full object-contain pointer-events-none" />
            ) : (
              <div className="w-full h-full bg-black flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}`
);

fs.writeFileSync('src/components/ProjectorView.tsx', code);

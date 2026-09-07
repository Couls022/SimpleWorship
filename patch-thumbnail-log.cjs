const fs = require('fs');
let code = fs.readFileSync('src/components/PptxSlideThumbnail.tsx', 'utf8');

code = code.replace(
  `  const { cachedFrame, status } = useSlideRenderCache(bytesKey, slideIndex);`,
  `  const { cachedFrame, status } = useSlideRenderCache(bytesKey, slideIndex);
  
  React.useEffect(() => {
    console.log('[PptxSlideThumbnail]', { bytesKey, slideIndex, status, hasUrl: !!cachedFrame?.objectUrl });
  }, [bytesKey, slideIndex, status, cachedFrame?.objectUrl]);`
);

fs.writeFileSync('src/components/PptxSlideThumbnail.tsx', code);

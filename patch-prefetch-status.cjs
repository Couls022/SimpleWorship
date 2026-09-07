const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

code = code.replace(
  `  const { cachedFrame, registerRenderedFrame } = useSlideRenderCache(bytesKey, slideIndex);
  
  useEffect(() => {
    if (cachedFrame?.objectUrl) {
      onCaptured();
      return;
    }`,
  `  const { cachedFrame, status, registerRenderedFrame } = useSlideRenderCache(bytesKey, slideIndex);
  
  useEffect(() => {
    if (cachedFrame?.objectUrl || status === 'error') {
      onCaptured();
      return;
    }`
);

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);

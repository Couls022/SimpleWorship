const fs = require('fs');
let code = fs.readFileSync('src/components/PptxSlideThumbnail.tsx', 'utf8');

code = code.replace(
  `  const { cachedFrame } = useSlideRenderCache(bytesKey, slideIndex);`,
  `  const { cachedFrame, status } = useSlideRenderCache(bytesKey, slideIndex);`
);

code = code.replace(
  `<span className="text-[9px] font-mono text-gray-400 z-10">Syncing Frame...</span>`,
  `{status === 'error' ? (
        <span className="text-[9px] font-mono text-red-400 z-10">Render failed</span>
      ) : status === 'rendering' ? (
        <span className="text-[9px] font-mono text-amber-400 z-10">Syncing Frame...</span>
      ) : (
        <span className="text-[9px] font-mono text-gray-400 z-10">Pending ({status})</span>
      )}`
);

code = code.replace(
  `<div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin z-10 mb-2" />`,
  `{status !== 'error' && <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin z-10 mb-2" />}`
);

fs.writeFileSync('src/components/PptxSlideThumbnail.tsx', code);

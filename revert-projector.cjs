const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectorView.tsx', 'utf8');

// Replace the injected hook
code = code.replace(
  /\n\s*const pptxBytesKey = React\.useMemo\(\(\) => \{[\s\S]*?const \{ cachedFrame \} = useSlideRenderCache\(pptxBytesKey, presentationState\.activeSlideIndex \|\| 0\);\n/,
  ''
);

// Replace the img checking with PptxRenderOverlay
code = code.replace(
  /\{cachedFrame\?\.objectUrl \? \([\s\S]*?<div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" \/>\s*<\/div>\s*\)\}/,
  `<PptxRenderOverlay
              fileBytes={activeItem?.data?.fileBytes}
              contentId={activeItem?.contentId}
              activeSlideIndex={presentationState.activeSlideIndex || 0}
            />`
);

fs.writeFileSync('src/components/ProjectorView.tsx', code);

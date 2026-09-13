const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

const oldContainer = `    <div 
      ref={containerRef} 
      className="w-full h-full bg-black overflow-hidden relative flex items-center justify-center select-none"`;

const newContainer = `    <div 
      ref={containerRef} 
      className="w-full h-full bg-black overflow-hidden relative flex items-center justify-center select-none pptx-strict-typography"`;

if(code.includes(oldContainer)) {
    code = code.replace(oldContainer, newContainer);
    fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);
    console.log('patched PptxRenderOverlay container');
} else {
    console.log('not found');
}

let cssCode = fs.readFileSync('src/index.css', 'utf8');
const strictCss = `
.pptx-strict-typography,
.pptx-strict-typography * {
  line-height: normal !important;
  letter-spacing: normal !important;
  font-feature-settings: normal !important;
  font-variant: normal !important;
  text-transform: none;
  -webkit-font-smoothing: auto;
}
`;
if(!cssCode.includes('pptx-strict-typography')) {
    cssCode = cssCode + strictCss;
    fs.writeFileSync('src/index.css', cssCode);
    console.log('patched css');
}

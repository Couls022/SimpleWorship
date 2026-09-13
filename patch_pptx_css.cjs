const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

const pptxResetCss = `
/* PROTECT PPTX RENDERER FROM TAILWIND GLOBAL STYLES */
.pptx-presenter-override,
[data-pptx-viewport],
[data-pptx-fullscreen-stage] {
  line-height: normal !important;
  letter-spacing: normal !important;
  text-align: left; /* reset tailwind defaults */
}

.pptx-presenter-override *,
[data-pptx-viewport] *,
[data-pptx-fullscreen-stage] * {
  line-height: inherit;
  letter-spacing: inherit;
  box-sizing: border-box;
}
`;

if(!code.includes('PROTECT PPTX RENDERER FROM TAILWIND GLOBAL STYLES')) {
    code = code.replace("/* PPTX PRESENTER & VIEWER ENTERPRISE STYLES */", "/* PPTX PRESENTER & VIEWER ENTERPRISE STYLES */\n" + pptxResetCss);
    fs.writeFileSync('src/index.css', code);
    console.log('patched index.css');
} else {
    console.log('already patched');
}

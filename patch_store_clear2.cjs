const fs = require('fs');
let code = fs.readFileSync('src/store/useStore.ts', 'utf8');

code = code.replace(/activeSlideIndex: slideIndex,/g, 'activeSlideIndex: slideIndex,\n        pptxAction: null,');

fs.writeFileSync('src/store/useStore.ts', code);

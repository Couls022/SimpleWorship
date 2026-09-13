const fs = require('fs');
let code = fs.readFileSync('src/components/LivePanel.tsx', 'utf8');

code = code.replace(/\{ activeSlideIndex: idx \}/g, '{ activeSlideIndex: idx, pptxAction: null }');
code = code.replace(/\{ activeSlideIndex: prev \}/g, '{ activeSlideIndex: prev, pptxAction: null }');
code = code.replace(/\{ activeSlideIndex: next \}/g, '{ activeSlideIndex: next, pptxAction: null }');
code = code.replace(/\{ activeSlideIndex: current \+ 1 \}/g, '{ activeSlideIndex: current + 1, pptxAction: null }');

fs.writeFileSync('src/components/LivePanel.tsx', code);

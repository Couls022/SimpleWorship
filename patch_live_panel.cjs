const fs = require('fs');
let code = fs.readFileSync('src/components/LivePanel.tsx', 'utf8');

code = code.replace(
  '{ activeSlideIndex: idx }',
  '{ activeSlideIndex: idx, pptxAction: null }'
);

code = code.replace(
  '{ activeSlideIndex: prev }',
  '{ activeSlideIndex: prev, pptxAction: null }'
);

code = code.replace(
  '{ activeSlideIndex: next }',
  '{ activeSlideIndex: next, pptxAction: null }'
);

code = code.replace(
  '{ activeSlideIndex: current + 1 }',
  '{ activeSlideIndex: current + 1, pptxAction: null }'
);

code = code.replace(
  'activeSlideIndex: 0,',
  'activeSlideIndex: 0,\n      pptxAction: null,'
);

fs.writeFileSync('src/components/LivePanel.tsx', code);

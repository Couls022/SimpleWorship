const fs = require('fs');
let code = fs.readFileSync('src/store/useStore.ts', 'utf8');

code = code.replace(
  /        pptxAction: null,\s+pptxAction: null,\s+pptxAction: null,/g,
  '        pptxAction: null,\n        pptxActionTimestamp: Date.now(),'
);

code = code.replace(
  /        pptxAction: null,\s+pptxAction: null,/g,
  '        pptxAction: null,\n        pptxActionTimestamp: Date.now(),'
);

fs.writeFileSync('src/store/useStore.ts', code);

const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

code = code.replace(
  'isVideoMuted?: boolean;',
  "isVideoMuted?: boolean;\n  pptxAction?: 'next' | 'prev' | null;\n  pptxActionTimestamp?: number;"
);

fs.writeFileSync('src/types.ts', code);

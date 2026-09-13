const fs = require('fs');
let code = fs.readFileSync('src/store/useStore.ts', 'utf8');

code = code.replace(
  /        directLiveItem: liveItem \|\| null,\n        isBlack: false,\n        isClear: false,/g,
  '        directLiveItem: liveItem || null,\n        isBlack: false,\n        isClear: false,\n        isVideoPlaying: true,'
);

fs.writeFileSync('src/store/useStore.ts', code);

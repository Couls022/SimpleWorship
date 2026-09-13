const fs = require('fs');
let code = fs.readFileSync('src/store/useStore.ts', 'utf8');

code = code.replace(
  '    get().setStagedGroupState(targetGroupId, { showLogo: nextLogo, isBlack: false });',
  '    const updates: any = { showLogo: nextLogo, isBlack: false };\n    if (nextLogo) updates.isVideoPlaying = true;\n    get().setStagedGroupState(targetGroupId, updates);'
);

fs.writeFileSync('src/store/useStore.ts', code);

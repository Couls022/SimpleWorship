const fs = require('fs');

let code = fs.readFileSync('src/components/LivePanel.tsx', 'utf8');

code = code.replace(
  /store\.toggleLiveEnabled\(groupId\)/g,
  'store.toggleMasterLive(groupId)'
);

fs.writeFileSync('src/components/LivePanel.tsx', code);
console.log('patched livepanel 3');

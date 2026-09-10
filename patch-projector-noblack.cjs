const fs = require('fs');

let code = fs.readFileSync('src/components/ProjectorView.tsx', 'utf8');

code = code.replace(
  /if \(winState && \(winState\.isBlack || !winState\.isLiveEnabled\)\) \{/,
  'if (winState && winState.isBlack) {'
);

fs.writeFileSync('src/components/ProjectorView.tsx', code);
console.log('patched projector noblack');

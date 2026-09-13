const fs = require('fs');
let code = fs.readFileSync('src/components/MonitorPreviewCanvas.tsx', 'utf8');

code = code.replace(
  'onActiveSlideChange={(index) => {',
  'onActiveSlideChange={(index) => {\nconsole.log("[MonitorPreviewCanvas] onActiveSlideChange called:", index);'
);

fs.writeFileSync('src/components/MonitorPreviewCanvas.tsx', code);

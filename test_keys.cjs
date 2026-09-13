const fs = require('fs');
const js = fs.readFileSync('node_modules/pptx-react-viewer/dist/chunk-3NIJ5HIZ.js', 'utf8');
const match = js.match(/function mapPresentationKey[\s\S]*?return \{[\s\S]*?\}/);
console.log(match ? match[0] : "Not found");

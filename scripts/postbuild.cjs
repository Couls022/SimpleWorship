const fs = require('fs');
const path = require('path');
const htmlPath = path.join(__dirname, '../dist/index.html');
if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  // Remove crossorigin attribute and its variations
  html = html.replace(/ crossorigin="?[a-zA-Z0-9-]*"?/g, '');
  html = html.replace(/ crossorigin/g, '');
  fs.writeFileSync(htmlPath, html);
  console.log('Removed crossorigin from index.html');
}

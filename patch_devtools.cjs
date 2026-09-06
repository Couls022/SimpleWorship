const fs = require('fs');
let file = fs.readFileSync('electron/main.cjs', 'utf8');

if (!file.includes('openDevTools')) {
  file = file.replace(/mainWindow\.loadFile\(path\.join\(__dirname, '\.\.\/dist\/index\.html'\)\);/, 
  "mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));\n    mainWindow.webContents.openDevTools({ mode: 'detach' });");
  fs.writeFileSync('electron/main.cjs', file);
  console.log('Patched DevTools');
}

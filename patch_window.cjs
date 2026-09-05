const fs = require('fs');
const code = fs.readFileSync('electron/main.cjs', 'utf8');
const patched = code.replace(
  /mainWindow = new BrowserWindow\(\{\n\s+width: 1440,\n\s+height: 900,\n\s+minWidth: 1280,\n\s+minHeight: 720,/,
  `
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width: Math.min(1440, width),
    height: Math.min(900, height),
    minWidth: 1024,
    minHeight: 720,
`
);
fs.writeFileSync('electron/main.cjs', patched);

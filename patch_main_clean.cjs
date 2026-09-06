const fs = require('fs');
let code = fs.readFileSync('electron/main.cjs', 'utf8');

// Replace aggressive GPU switches
const gpuPattern = /\/\/ =+\s*\/\/ HARDWARE ACCELERATION[\s\S]*?\/\/ 5\. Windows D3D11 Compositor Optimization[\s\S]*?}/;
const cleanGpuSwitches = `// Standard robust Electron flags for smooth Windows rendering
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');`;

if (gpuPattern.test(code)) {
  code = code.replace(gpuPattern, cleanGpuSwitches);
}

// Replace sandbox: true with sandbox: false everywhere
code = code.replaceAll('sandbox: true', 'sandbox: false');

// Ensure mainWindow uses show: false, ready-to-show, no openDevTools
code = code.replace(
  /mainWindow = new BrowserWindow\(\{[\s\S]*?backgroundColor: '#0c0d10',/,
  `mainWindow = new BrowserWindow({
    width: Math.min(1440, width),
    height: Math.min(900, height),
    minWidth: 1024,
    minHeight: 720,
    show: false,
    frame: false,
    backgroundColor: '#0c0d10',`
);

// Remove openDevTools
code = code.replace(/mainWindow\.webContents\.openDevTools\(\{ mode: 'detach' \}\);/g, '');

// Add ready-to-show handler if not already present
if (!code.includes("mainWindow.once('ready-to-show'")) {
  code = code.replace(
    /mainWindow\.loadFile\(path\.join\(__dirname, '\.\.\/dist\/index\.html'\)\);/,
    `mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));\n  mainWindow.once('ready-to-show', () => {\n    mainWindow.show();\n    mainWindow.focus();\n  });`
  );
}

fs.writeFileSync('electron/main.cjs', code);
console.log('electron/main.cjs patched cleanly');

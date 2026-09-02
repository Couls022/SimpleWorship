# PRODUCTION DEPLOYMENT & NATIVE MIGRATION GUIDE

Since SimpleWorship is currently running in a cloud container, you must perform the final Electron packaging on a physical Windows machine to generate the `.exe`.

## 1. Prerequisites (On your Windows Machine)
- Install **Node.js** (v18 or higher)
- Install **Git**

## 2. Clone and Install
```bash
git clone <your-repository-url> simpleworship
cd simpleworship
npm install
```

## 3. Add Electron Dependencies
Install the native shell tools:
```bash
npm install electron -D
npm install electron-builder -D
```

## 4. Electron Boilerplate
Create the following files in your repository root to bridge the Vite frontend with the Electron backend:

### `main.js` (Electron Entry Point)
```javascript
const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // In production, load the built Vite index.html
  mainWindow.loadFile('dist/index.html');
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('get-displays', () => {
    return screen.getAllDisplays();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

### `preload.js`
```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  // Add projector window spawning methods here later
});
```

## 5. Update package.json
Modify your `package.json` to include the Electron build targets:
```json
{
  "main": "main.js",
  "scripts": {
    "build:electron": "vite build && electron-builder"
  },
  "build": {
    "appId": "com.simpleworship.app",
    "win": {
      "target": "nsis"
    }
  }
}
```

## 6. Build the Installer
Run the production compiler:
```bash
npm run build:electron
```
This will generate `SimpleWorship-Setup.exe` in a `dist/` or `out/` folder. 

## 7. Clean Machine Test
Copy `SimpleWorship-Setup.exe` to a fresh Windows machine (no Node.js installed).
1. Run the installer.
2. Launch SimpleWorship.
3. Test `.sws` generation (File -> Save Service).
4. Verify offline functionality.

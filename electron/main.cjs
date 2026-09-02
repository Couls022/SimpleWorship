const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
const projectorWindows = new Map();

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      // Check for .sws file argument
      const swsFile = commandLine.find(arg => arg.endsWith('.sws'));
      if (swsFile && fs.existsSync(swsFile)) {
        mainWindow.webContents.send('file:opened-via-association', swsFile);
      }
    }
  });

  app.whenReady().then(createMainWindow);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0c0d10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Forward SWS file on initial cold-start launch
  mainWindow.webContents.on('did-finish-load', () => {
    const swsFile = process.argv.slice(app.isPackaged ? 1 : 2).find(arg => arg && arg.endsWith('.sws'));
    if (swsFile && fs.existsSync(swsFile)) {
      mainWindow.webContents.send('file:opened-via-association', swsFile);
    }
  });

  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:state-changed', true);
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:state-changed', false);
    }
  });

  mainWindow.on('enter-full-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:state-changed', true);
    }
  });

  mainWindow.on('leave-full-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:state-changed', false);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    projectorWindows.forEach(win => {
      if (win && !win.isDestroyed()) win.close();
    });
    projectorWindows.clear();
  });
}

// -------------------------------------------------------------
// WINDOW MANAGEMENT IPC HANDLERS
// -------------------------------------------------------------
ipcMain.handle('window:minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
    return true;
  }
  return false;
});

ipcMain.handle('window:toggle-maximize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    } else {
      mainWindow.maximize();
      return true;
    }
  }
  return false;
});

ipcMain.handle('window:is-maximized', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow.isMaximized();
  }
  return false;
});

ipcMain.handle('window:close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
    return true;
  }
  return false;
});

// Display Hot-Plug & Metrics Monitoring
app.whenReady().then(() => {
  screen.on('display-added', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('display:changed', { type: 'added' });
    }
  });
  screen.on('display-removed', (event, oldDisplay) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('display:changed', { type: 'removed', displayId: oldDisplay.id });
    }
  });
  screen.on('display-metrics-changed', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('display:changed', { type: 'metrics-changed' });
    }
  });
});

// -------------------------------------------------------------
// NATIVE IPC HANDLERS
// -------------------------------------------------------------

// Display Enumeration
ipcMain.handle('display:get-all', () => {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();

  return displays.map((d, index) => ({
    id: `display-${d.id}`,
    displayId: d.id,
    name: d.id === primaryDisplay.id ? `Monitor ${index + 1} (Primary)` : `Monitor ${index + 1} (Secondary)`,
    bounds: d.bounds,
    workArea: d.workArea,
    scaleFactor: d.scaleFactor,
    isPrimary: d.id === primaryDisplay.id,
    isInternal: d.internal || false
  }));
});

// Projector Management
ipcMain.handle('projector:open', (event, { groupId, displayId, bounds }) => {
  if (projectorWindows.has(groupId)) {
    const existing = projectorWindows.get(groupId);
    if (!existing.isDestroyed()) {
      existing.focus();
      return { success: true, reused: true };
    }
  }

  const win = new BrowserWindow({
    x: bounds?.x ?? 1920,
    y: bounds?.y ?? 0,
    width: bounds?.width ?? 1920,
    height: bounds?.height ?? 1080,
    frame: false,
    fullscreen: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const url = process.env.NODE_ENV === 'development' || !app.isPackaged
    ? `http://localhost:3000/#/projector?group=${groupId}`
    : `file://${path.join(__dirname, '../dist/index.html')}#/projector?group=${groupId}`;

  win.loadURL(url);

  win.on('closed', () => {
    projectorWindows.delete(groupId);
  });

  projectorWindows.set(groupId, win);
  return { success: true };
});

ipcMain.handle('projector:close', (event, { groupId }) => {
  if (projectorWindows.has(groupId)) {
    const win = projectorWindows.get(groupId);
    if (!win.isDestroyed()) win.close();
    projectorWindows.delete(groupId);
    return { success: true };
  }
  return { success: false, message: 'Window not found' };
});

// Native File Pickers
ipcMain.handle('file:save-sws', async (event, { defaultName, data }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save SimpleWorship Service',
    defaultPath: defaultName || 'Sunday Worship.sws',
    filters: [{ name: 'SimpleWorship Service (*.sws)', extensions: ['sws'] }]
  });

  if (canceled || !filePath) return { canceled: true };

  const buffer = Buffer.from(data);
  fs.writeFileSync(filePath, buffer);
  return { canceled: false, filePath };
});

ipcMain.handle('file:open-sws', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Open SimpleWorship Service',
    filters: [{ name: 'SimpleWorship Service (*.sws)', extensions: ['sws'] }],
    properties: ['openFile']
  });

  if (canceled || filePaths.length === 0) return { canceled: true };

  const buffer = fs.readFileSync(filePaths[0]);
  return { canceled: false, filePath: filePaths[0], data: buffer };
});

ipcMain.handle('file:read-sws-path', async (event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { canceled: true, error: 'File does not exist' };
    }
    const buffer = fs.readFileSync(filePath);
    return { canceled: false, filePath, data: buffer };
  } catch (err) {
    return { canceled: true, error: err.message };
  }
});


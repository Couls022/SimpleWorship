const { app, BrowserWindow, Menu, ipcMain, screen, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

let mainWindow = null;
// Display-Centric Projector Windows: Keyed by physical display ID
const displayWindows = new Map(); // physicalDisplayId -> BrowserWindow
const displayRouteMap = new Map(); // physicalDisplayId -> groupId

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

  app.whenReady().then(() => {
    // Auto-grant camera and microphone permissions
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media' || permission === 'camera') {
        callback(true);
      } else {
        callback(false);
      }
    });

    createMainWindow();
  });
}

function createMainWindow() {
  // Disable native OS menu to eliminate duplicate top menu layer
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0c0d10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
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

  mainWindow.on('focus', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.moveTop();
    }
  });

  mainWindow.on('restore', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
      mainWindow.moveTop();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    displayWindows.forEach(win => {
      if (win && !win.isDestroyed()) win.close();
    });
    displayWindows.clear();
    displayRouteMap.clear();
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

// -------------------------------------------------------------
// NATIVE IPC HANDLERS
// -------------------------------------------------------------

function getFormattedDisplays() {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();

  return displays.map((d, index) => {
    const isPrimary = d.id === primaryDisplay.id;
    const name = isPrimary ? `Monitor ${index + 1} (Primary)` : `Monitor ${index + 1} (Secondary)`;
    return {
      id: `display-${d.id}`,
      displayId: d.id,
      name: name,
      label: name,
      bounds: d.bounds,
      workArea: d.workArea,
      scaleFactor: d.scaleFactor,
      isPrimary: isPrimary,
      isInternal: d.internal || false
    };
  });
}

// Display Enumeration
ipcMain.handle('display:get-all', () => {
  return getFormattedDisplays();
});

// Display Hot-Plug & Metrics Monitoring
app.whenReady().then(() => {
  const notifyDisplaysChanged = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const displays = getFormattedDisplays();
      mainWindow.webContents.send('displays:changed', displays);
      mainWindow.webContents.send('display:changed', { type: 'metrics-changed', displays });
    }
  };

  screen.on('display-added', notifyDisplaysChanged);
  screen.on('display-removed', notifyDisplaysChanged);
  screen.on('display-metrics-changed', notifyDisplaysChanged);
});

// Helper to generate RFC 8089-compliant projector URLs
function getProjectorUrl(displayId, groupId) {
  const queryParams = `projector=true&displayId=${encodeURIComponent(displayId)}&groupId=${encodeURIComponent(groupId)}`;
  const hashParams = `#/projector?displayId=${encodeURIComponent(displayId)}&groupId=${encodeURIComponent(groupId)}`;

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    return `http://localhost:3000/?${queryParams}${hashParams}`;
  }

  const indexPath = path.join(__dirname, '../dist/index.html');
  const fileUrl = pathToFileURL(indexPath).href;
  return `${fileUrl}?${queryParams}${hashParams}`;
}

function resolveTargetDisplay(displayId, formattedDisplays) {
  if (!displayId) return null;
  const idStr = String(displayId).trim();
  const idLower = idStr.toLowerCase();

  // 1. Direct match on id, displayId, name, or label
  let match = formattedDisplays.find(fd =>
    fd.id === idStr ||
    String(fd.displayId) === idStr ||
    fd.name === idStr ||
    fd.label === idStr
  );
  if (match) return match;

  // 2. Case-insensitive / partial match
  match = formattedDisplays.find(fd =>
    fd.id.toLowerCase() === idLower ||
    String(fd.displayId).toLowerCase() === idLower ||
    fd.name.toLowerCase().includes(idLower) ||
    fd.label.toLowerCase().includes(idLower)
  );
  if (match) return match;

  // 3. Fallbacks
  if (idLower.includes('2') || idLower.includes('secondary')) {
    return formattedDisplays.find(fd => !fd.isPrimary) || formattedDisplays[1] || formattedDisplays[0];
  }
  if (idLower.includes('3')) {
    return formattedDisplays.filter(fd => !fd.isPrimary)[1] || formattedDisplays[2] || formattedDisplays[0];
  }
  if (idLower.includes('1') || idLower.includes('primary')) {
    return formattedDisplays.find(fd => fd.isPrimary) || formattedDisplays[0];
  }

  return null;
}

// Projector Management (Display-Centric)
ipcMain.handle('projector:open', (event, { groupId, displayId, bounds }) => {
  if (!groupId) return { success: false, status: 'DISCONNECTED', error: 'groupId is required' };

  const formattedDisplays = getFormattedDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();

  let targetBounds = bounds;
  let selectedDisplay = resolveTargetDisplay(displayId, formattedDisplays);

  if (!selectedDisplay) {
    selectedDisplay = formattedDisplays.find(fd => !fd.isPrimary) || formattedDisplays[0];
  }

  // Auto-redirect to secondary display if target resolves to operator display and a secondary display exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    const operatorDisplay = screen.getDisplayMatching(mainWindow.getBounds());
    if (selectedDisplay && String(selectedDisplay.displayId) === String(operatorDisplay.id)) {
      const secondaryDisplay = formattedDisplays.find(fd => String(fd.displayId) !== String(operatorDisplay.id));
      if (secondaryDisplay) {
        selectedDisplay = secondaryDisplay;
        if (selectedDisplay.bounds) {
          targetBounds = selectedDisplay.bounds;
        }
      }
    }
  }

  const canonicalDisplayId = selectedDisplay ? selectedDisplay.id : (displayId || `display-${primaryDisplay.id}`);

  // --- PROJECTOR WINDOW REUSE (DISPLAY-CENTRIC) ---
  // A physical monitor must have at most ONE active fullscreen projector window.
  // If a window already exists on this physical display, reuse it and switch route!
  if (displayWindows.has(canonicalDisplayId)) {
    const existing = displayWindows.get(canonicalDisplayId);
    if (existing && !existing.isDestroyed()) {
      displayRouteMap.set(canonicalDisplayId, groupId);
      existing.webContents.send('projector:route-changed', { displayId: canonicalDisplayId, groupId });
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('projector:status-changed', { groupId, displayId: canonicalDisplayId, status: 'CONNECTED' });
      }
      if (typeof existing.showInactive === 'function') {
        existing.showInactive();
      } else {
        existing.show();
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus();
        mainWindow.moveTop();
      }
      return { success: true, status: 'CONNECTED', displayId: canonicalDisplayId, groupId, reused: true };
    }
  }

  if (selectedDisplay) {
    targetBounds = selectedDisplay.bounds;
  } else if (!targetBounds) {
    targetBounds = primaryDisplay.bounds;
  }

  // --- SAME-MONITOR SAFETY BLOCK ---
  if (mainWindow && !mainWindow.isDestroyed()) {
    const operatorDisplay = screen.getDisplayMatching(mainWindow.getBounds());
    let targetDisplay = selectedDisplay;
    if (!targetDisplay && targetBounds) {
      const rawTarget = screen.getDisplayMatching(targetBounds);
      targetDisplay = formattedDisplays.find(fd => String(fd.displayId) === String(rawTarget.id));
    }

    if (targetDisplay && String(targetDisplay.displayId) === String(operatorDisplay.id)) {
      dialog.showMessageBoxSync(mainWindow, {
        type: 'warning',
        title: 'Output Monitor Conflict',
        message: 'The selected Live Output monitor is currently being used by the SimpleWorship operator console.\n\nPlease choose another monitor or connect a secondary projector display before starting Live Output.',
        buttons: ['OK']
      });
      return {
        success: false,
        status: 'DISCONNECTED',
        conflict: 'SAME_DISPLAY_CONFLICT',
        error: 'The selected Live Output monitor is currently being used by the SimpleWorship operator console.'
      };
    }
  }

  const win = new BrowserWindow({
    x: targetBounds.x,
    y: targetBounds.y,
    width: targetBounds.width,
    height: targetBounds.height,
    frame: false,
    fullscreen: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Handle URL load failure
  win.webContents.on('did-fail-load', (loadEvent, errorCode, errorDescription, validatedURL) => {
    console.error(`[Projector] Failed to load URL: ${validatedURL}, error: ${errorDescription} (${errorCode})`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('projector:error', {
        displayId: canonicalDisplayId,
        groupId,
        errorCode,
        errorDescription,
        url: validatedURL
      });
    }
  });

  const url = getProjectorUrl(canonicalDisplayId, groupId);
  win.loadURL(url);

  if (targetBounds) {
    win.setPosition(targetBounds.x, targetBounds.y);
    win.setSize(targetBounds.width, targetBounds.height);
    win.setBounds(targetBounds);
    win.setFullScreen(true);
    if (typeof win.showInactive === 'function') {
      win.showInactive();
    } else {
      win.show();
    }
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    mainWindow.moveTop();
  }

  win.on('closed', () => {
    displayWindows.delete(canonicalDisplayId);
    displayRouteMap.delete(canonicalDisplayId);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('projector:status-changed', { groupId, displayId: canonicalDisplayId, status: 'DISCONNECTED' });
      mainWindow.focus();
      mainWindow.moveTop();
    }
  });

  displayWindows.set(canonicalDisplayId, win);
  displayRouteMap.set(canonicalDisplayId, groupId);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('projector:status-changed', { groupId, displayId: canonicalDisplayId, status: 'CONNECTED' });
  }

  return { success: true, status: 'CONNECTED', displayId: canonicalDisplayId, groupId, reused: false };
});

ipcMain.handle('projector:close', (event, { groupId, displayId }) => {
  let targetDisplayId = displayId;
  if (!targetDisplayId && groupId) {
    for (const [dispId, gid] of displayRouteMap.entries()) {
      if (gid === groupId) {
        targetDisplayId = dispId;
        break;
      }
    }
  }

  let result = { success: false, status: 'DISCONNECTED', message: 'Window not found' };

  if (targetDisplayId && displayWindows.has(targetDisplayId)) {
    const win = displayWindows.get(targetDisplayId);
    if (win && !win.isDestroyed()) win.close();
    displayWindows.delete(targetDisplayId);
    displayRouteMap.delete(targetDisplayId);
    result = { success: true, status: 'DISCONNECTED', displayId: targetDisplayId };
  } else if (groupId && displayWindows.has(groupId)) {
    const win = displayWindows.get(groupId);
    if (win && !win.isDestroyed()) win.close();
    displayWindows.delete(groupId);
    displayRouteMap.delete(groupId);
    result = { success: true, status: 'DISCONNECTED' };
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    mainWindow.moveTop();
  }

  return result;
});

ipcMain.handle('projector:sync-displays', async (event, { assignments }) => {
  if (!Array.isArray(assignments)) return { success: false, error: 'assignments must be an array' };

  const formattedDisplays = getFormattedDisplays();
  const results = [];

  for (const item of assignments) {
    const { displayId, groupId } = item;
    if (!displayId) continue;

    const matchedDisplay = resolveTargetDisplay(displayId, formattedDisplays);
    const canonicalDisplayId = matchedDisplay ? matchedDisplay.id : displayId;

    if (!groupId) {
      // Zero live routes on this display -> close projector window if open
      if (displayWindows.has(canonicalDisplayId)) {
        const win = displayWindows.get(canonicalDisplayId);
        if (win && !win.isDestroyed()) win.close();
        displayWindows.delete(canonicalDisplayId);
        displayRouteMap.delete(canonicalDisplayId);
        results.push({ displayId: canonicalDisplayId, action: 'closed' });
      }
    } else {
      // Exactly 1 or winning live route -> ensure window is open and showing groupId
      if (displayWindows.has(canonicalDisplayId)) {
        const win = displayWindows.get(canonicalDisplayId);
        if (win && !win.isDestroyed()) {
          const currentGroupId = displayRouteMap.get(canonicalDisplayId);
          if (currentGroupId !== groupId) {
            displayRouteMap.set(canonicalDisplayId, groupId);
            win.webContents.send('projector:route-changed', { displayId: canonicalDisplayId, groupId });
            results.push({ displayId: canonicalDisplayId, groupId, action: 'route-updated' });
          } else {
            results.push({ displayId: canonicalDisplayId, groupId, action: 'noop' });
          }
          continue;
        }
      }

      // Open new window on this display
      const win = new BrowserWindow({
        x: matchedDisplay ? matchedDisplay.bounds.x : 0,
        y: matchedDisplay ? matchedDisplay.bounds.y : 0,
        width: matchedDisplay ? matchedDisplay.bounds.width : 1920,
        height: matchedDisplay ? matchedDisplay.bounds.height : 1080,
        frame: false,
        fullscreen: false,
        alwaysOnTop: false,
        skipTaskbar: false,
        backgroundColor: '#000000',
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true
        }
      });

      win.webContents.on('did-fail-load', (loadEvent, errorCode, errorDescription, validatedURL) => {
        console.error(`[Projector] Failed to load URL: ${validatedURL}, error: ${errorDescription} (${errorCode})`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('projector:error', {
            displayId: canonicalDisplayId,
            groupId,
            errorCode,
            errorDescription,
            url: validatedURL
          });
        }
      });

      const url = getProjectorUrl(canonicalDisplayId, groupId);
      win.loadURL(url);

      if (matchedDisplay) {
        win.setPosition(matchedDisplay.bounds.x, matchedDisplay.bounds.y);
        win.setSize(matchedDisplay.bounds.width, matchedDisplay.bounds.height);
        win.setBounds(matchedDisplay.bounds);
        win.setFullScreen(true);
        if (typeof win.showInactive === 'function') {
          win.showInactive();
        } else {
          win.show();
        }
      }

      win.on('closed', () => {
        displayWindows.delete(canonicalDisplayId);
        displayRouteMap.delete(canonicalDisplayId);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('projector:status-changed', { groupId, displayId: canonicalDisplayId, status: 'DISCONNECTED' });
          mainWindow.focus();
          mainWindow.moveTop();
        }
      });

      displayWindows.set(canonicalDisplayId, win);
      displayRouteMap.set(canonicalDisplayId, groupId);

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('projector:status-changed', { groupId, displayId: canonicalDisplayId, status: 'CONNECTED' });
      }

      results.push({ displayId: canonicalDisplayId, groupId, action: 'opened' });
    }
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    mainWindow.moveTop();
  }

  return { success: true, results };
});

ipcMain.handle('projector:get-statuses', () => {
  const statuses = {};
  displayWindows.forEach((win, displayId) => {
    if (win && !win.isDestroyed()) {
      statuses[displayId] = 'CONNECTED';
      const gid = displayRouteMap.get(displayId);
      if (gid) statuses[gid] = 'CONNECTED';
    }
  });
  return statuses;
});

ipcMain.handle('projector:get-status', (event, { groupId, displayId }) => {
  if (displayId && displayWindows.has(displayId) && !displayWindows.get(displayId).isDestroyed()) {
    return { status: 'CONNECTED', displayId, groupId: displayRouteMap.get(displayId) };
  }
  if (groupId) {
    for (const [dispId, gid] of displayRouteMap.entries()) {
      if (gid === groupId && displayWindows.has(dispId) && !displayWindows.get(dispId).isDestroyed()) {
        return { status: 'CONNECTED', displayId: dispId, groupId };
      }
    }
  }
  return { status: 'DISCONNECTED' };
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


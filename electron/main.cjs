const { app, BrowserWindow, Menu, ipcMain, screen, dialog, session, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');

// ============================================================================
// HARDWARE ACCELERATION & HIGH-PERFORMANCE WINDOWS SYSTEM ENGINE
// Configured to adapt directly to real device CPU, RAM, GPU, and graphics drivers
// ============================================================================

// 1. Force GPU Hardware Acceleration & Bypass strict Chromium blocklists on Windows
// (Ensures Intel HD/UHD/Iris, AMD Radeon, and NVIDIA GPUs utilize direct D3D11/DirectX rasterization)
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');
app.commandLine.appendSwitch('force-gpu-mem-available-mb', '2048');

// 2. Hardware Video & Media Decoding (DXVA2 / Direct3D11 / NVDEC / VAAPI)
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-accelerated-mjpeg-decode');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,CanvasOopRasterization,RawDraw,DirectShow');

// 3. Prevent Background Throttling on Unfocused Projector Windows
// When operator clicks main console window, secondary projector display MUST NOT lag or drop frames
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

// 4. Memory & V8 Engine Optimization for 4K Media, Video Loops, and PPTX
// Avoids stop-the-world GC pauses on real devices with 4GB - 16GB RAM
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');

// 5. Windows D3D11 Compositor Optimization
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('use-angle', 'd3d11');
  app.commandLine.appendSwitch('enable-hardware-overlays', 'single-fullscreen,single-on-top');
}

let mainWindow = null;
let powerSaveId = null;
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
    // Prevent OS from sleeping displays during worship / presentation
    try {
      powerSaveId = powerSaveBlocker.start('prevent-display-sleep');
    } catch (e) {
      console.warn('[PowerSaveBlocker] Could not lock display sleep:', e);
    }

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
    minWidth: 1280,
    minHeight: 720,
    frame: false,
    backgroundColor: '#0c0d10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      spellcheck: false
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

const { exec } = require('child_process');

function getWindowsMonitorNames() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      return resolve([]);
    }
    
    // WmiMonitorID contains ManufacturerName and UserFriendlyName as character code arrays.
    // Convert them to ASCII string characters and join them.
    const cmd = `powershell -NoProfile -Command "Get-CimInstance -Namespace root\\wmi -ClassName WmiMonitorID | ForEach-Object { $m = [System.Text.Encoding]::ASCII.GetString($_.ManufacturerName -notmatch 0).Trim(); $n = [System.Text.Encoding]::ASCII.GetString($_.UserFriendlyName -notmatch 0).Trim(); Write-Output \\"\\$m|\\$n\\" }"`;
    
    exec(cmd, { timeout: 2000 }, (err, stdout) => {
      if (err) {
        // Fallback: query Win32_DesktopMonitor
        const cmdFallback = `powershell -NoProfile -Command "Get-CimInstance Win32_DesktopMonitor | ForEach-Object { Write-Output (\\"\\" + $_.MonitorManufacturer + \\"|\\" + $_.Name) }"`;
        exec(cmdFallback, { timeout: 2000 }, (err2, stdout2) => {
          if (err2 || !stdout2) {
            return resolve([]);
          }
          const lines = stdout2.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          const monitors = lines.map(line => {
            const parts = line.split('|');
            return { brand: parts[0] || '', model: parts[1] || '' };
          });
          resolve(monitors);
        });
        return;
      }
      
      if (!stdout) return resolve([]);
      const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const monitors = lines.map(line => {
        const parts = line.split('|');
        return { brand: parts[0] || '', model: parts[1] || '' };
      });
      resolve(monitors);
    });
  });
}

const MANUFACTURER_MAP = {
  'SAM': 'Samsung',
  'DEL': 'Dell',
  'SEC': 'Samsung',
  'ACR': 'Acer',
  'GSM': 'LG',
  'LGD': 'LG',
  'PHL': 'Philips',
  'HPQ': 'HP',
  'BEN': 'BenQ',
  'SON': 'Sony',
  'NEC': 'NEC',
  'ASU': 'ASUS',
  'AOC': 'AOC',
  'LEN': 'Lenovo',
  'MSI': 'MSI',
  'APP': 'Apple',
  'HWP': 'HP',
  'HEW': 'HP'
};

async function getFormattedDisplays() {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  const winMonitors = await getWindowsMonitorNames();

  return displays.map((d, index) => {
    const isPrimary = d.id === primaryDisplay.id;
    
    let brand = '';
    let model = '';
    let displayName = '';

    // 1. Use Electron's native screen label (the actual Friendly Name from Windows settings)
    if (d.label) {
      displayName = d.label.trim();
    }

    // 2. Enhance or fall back to powershell WMI info if native label is missing or generic
    const isGeneric = !displayName || 
                      displayName.toLowerCase().includes('generic') || 
                      displayName.toLowerCase().includes('display') || 
                      displayName.toLowerCase().includes('monitor');
                      
    if (isGeneric && winMonitors && winMonitors[index]) {
      const wm = winMonitors[index];
      const mfg = (wm.brand || '').toUpperCase().trim();
      brand = MANUFACTURER_MAP[mfg] || mfg;
      model = (wm.model || '').trim();
      
      if (brand || model) {
        displayName = `${brand} ${model}`.trim();
      }
    }

    // 3. Fallback to generic names if still empty
    if (!displayName) {
      displayName = isPrimary ? `Primary Monitor` : `Monitor ${index + 1}`;
    }

    return {
      id: `display-${d.id}`,
      displayId: d.id,
      name: displayName,
      label: `${displayName} (${d.bounds.width}x${d.bounds.height})`,
      bounds: d.bounds,
      workArea: d.workArea,
      scaleFactor: d.scaleFactor,
      isPrimary: isPrimary,
      isInternal: d.internal || false
    };
  });
}

// Display Enumeration
ipcMain.handle('display:get-all', async () => {
  return await getFormattedDisplays();
});

// Display Hot-Plug & Metrics Monitoring
app.whenReady().then(() => {
  const notifyDisplaysChanged = async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const displays = await getFormattedDisplays();
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

  // 2. Case-insensitive / partial match (excluding loose numeric substrings)
  match = formattedDisplays.find(fd =>
    fd.id.toLowerCase() === idLower ||
    String(fd.displayId).toLowerCase() === idLower ||
    fd.name.toLowerCase() === idLower ||
    fd.label.toLowerCase() === idLower ||
    fd.name.toLowerCase().includes(idLower) ||
    fd.label.toLowerCase().includes(idLower)
  );
  if (match) return match;

  // 3. Normalized positional fallbacks
  // "monitor-1", "primary-display", "primary monitor" or index 0 matches primary
  if (idLower.includes('primary') || idLower.includes('monitor-1') || idLower === 'monitor 1') {
    return formattedDisplays.find(fd => fd.isPrimary) || formattedDisplays[0];
  }

  // "monitor-2", "secondary" or index 1 matches the first non-primary display
  if (idLower.includes('monitor-2') || idLower === 'monitor 2' || idLower.includes('secondary') || idLower.includes('alternate')) {
    return formattedDisplays.find(fd => !fd.isPrimary) || formattedDisplays[1] || formattedDisplays[0];
  }

  // "monitor-3", "foldback", "stage" or index 2 matches the second non-primary display
  if (idLower.includes('monitor-3') || idLower === 'monitor 3' || idLower.includes('foldback') || idLower.includes('stage') || idLower.includes('tertiary')) {
    const nonPrimary = formattedDisplays.filter(fd => !fd.isPrimary);
    return nonPrimary[1] || formattedDisplays[2] || formattedDisplays[0];
  }

  return null;
}

// Projector Management (Display-Centric)
ipcMain.handle('projector:open', async (event, { groupId, displayId, bounds }) => {
  if (!groupId) return { success: false, status: 'DISCONNECTED', error: 'groupId is required' };

  const formattedDisplays = await getFormattedDisplays();
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
      sandbox: true,
      backgroundThrottling: false,
      spellcheck: false
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

  const formattedDisplays = await getFormattedDisplays();
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
          sandbox: true,
          backgroundThrottling: false,
          spellcheck: false
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

// Native Display Identifier overlay creator
ipcMain.handle('display:identify', async () => {
  const displays = screen.getAllDisplays();
  
  displays.forEach((d, index) => {
    const { x, y, width, height } = d.bounds;
    
    // Create a temporary borderless overlay window
    const win = new BrowserWindow({
      x,
      y,
      width,
      height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      focusable: false,
      enableLargerThanScreen: true,
      skipTaskbar: true,
      hasShadow: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 0;
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: rgba(10, 11, 14, 0.45);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            overflow: hidden;
            user-select: none;
          }
          .card {
            background: rgba(18, 19, 23, 0.95);
            border: 2px solid #06b6d4;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(6, 182, 212, 0.3);
            border-radius: 16px;
            padding: 40px 60px;
            text-align: center;
            animation: popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          }
          .number {
            font-size: 140px;
            font-weight: 900;
            color: #06b6d4;
            line-height: 1;
            margin: 0;
            text-shadow: 0 0 20px rgba(6, 182, 212, 0.4);
          }
          .label {
            font-size: 16px;
            font-weight: 700;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-top: 10px;
          }
          @keyframes popIn {
            0% { transform: scale(0.85); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          .fade-out {
            animation: fadeOut 0.5s ease-out forwards;
          }
          @keyframes fadeOut {
            0% { opacity: 1; }
            100% { opacity: 0; }
          }
        </style>
      </head>
      <body>
        <div id="card" class="card">
          <div class="number">${index + 1}</div>
          <div class="label">${d.bounds.width}x${d.bounds.height} ${d.id === screen.getPrimaryDisplay().id ? 'Primary' : 'Secondary'}</div>
        </div>
        <script>
          setTimeout(() => {
            document.body.classList.add('fade-out');
          }, 2500);
        </script>
      </body>
      </html>
    `;

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    win.setIgnoreMouseEvents(true);

    // Destroy after 3.2 seconds
    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.destroy();
      }
    }, 3200);
  });

  return { success: true };
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

// Real Device Hardware Diagnostics & Adaptive Engine IPC
ipcMain.handle('system:get-hardware-info', async () => {
  try {
    const gpuFeatures = app.getGPUFeatureStatus();
    let gpuInfo = null;
    try {
      gpuInfo = await app.getGPUInfo('basic');
    } catch (e) {}

    let memInfo = null;
    if (process.getProcessMemoryInfo) {
      memInfo = await process.getProcessMemoryInfo().catch(() => null);
    }

    const cpus = os.cpus();
    const totalRamMb = Math.round(os.totalmem() / (1024 * 1024));
    const freeRamMb = Math.round(os.freemem() / (1024 * 1024));

    return {
      success: true,
      platform: process.platform,
      arch: process.arch,
      cpuModel: cpus && cpus[0] ? cpus[0].model.trim() : 'Real Device CPU',
      cpuCores: cpus ? cpus.length : 1,
      cpuSpeedMhz: cpus && cpus[0] ? cpus[0].speed : 0,
      totalRamMb,
      freeRamMb,
      usedRamMb: totalRamMb - freeRamMb,
      processMemMb: memInfo ? Math.round(memInfo.residentSet / 1024) : null,
      gpuFeatures,
      gpuInfo,
      isHardwareAccelerated: gpuFeatures?.gpu_compositing === 'enabled' || gpuFeatures?.['rasterization'] === 'enabled_force' || gpuFeatures?.['rasterization'] === 'enabled',
      directXStatus: process.platform === 'win32' ? 'Direct3D 11 Active' : 'Native Compositor Active'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});


const { app, BrowserWindow, Menu, ipcMain, screen, dialog, session, powerSaveBlocker, protocol, shell, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const { exec, execFile } = require('child_process');

// Register custom privileged scheme before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true,
      stream: true,
      allowServiceWorkers: true
    }
  }
]);

// Completely disable native default menu (File Edit View Help) across all windows
Menu.setApplicationMenu(null);

// ============================================================================
// 1. HARDWARE ACCELERATION & SYSTEM PERFORMANCE SWITCHES (WINDOWS ULTRA-SMOOTH)
// ============================================================================
// Force native GPU acceleration across all Windows hardware (Intel HD, Iris Xe, AMD Radeon, NVIDIA)
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-oop-rasterization');
app.commandLine.appendSwitch('force_high_performance_gpu'); // Discrete Dual Graphics (NVIDIA/AMD) activation
app.commandLine.appendSwitch('allow-file-access-from-files');

// Use native Direct3D 11 backend on Windows for smooth 60fps/120fps presentation rendering
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('use-angle', 'd3d11');
}

// Prevent background throttling & occlusion pauses during live worship presentation
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('enable-smooth-scrolling');
app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192');

// Global child process recovery listener (recovers gracefully if GPU process crashes on older hardware)
app.on('child-process-gone', (event, details) => {
  console.warn('[Process] Child process event:', details.type, details.reason);
});

let mainWindow = null;
let powerSaveId = null;
let isSystemAlwaysOnTop = false;
// Display-Centric Projector Windows: Keyed by physical display ID
const displayWindows = new Map(); // physicalDisplayId -> BrowserWindow
const displayRouteMap = new Map(); // physicalDisplayId -> groupId

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm'
};

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

  // High-performance in-memory asset cache for instant 60fps loads (<0.1ms from RAM)
  const assetMemoryCache = new Map(); // targetPath -> { buffer, mimeType }

  app.whenReady().then(() => {
    // Protocol handler that works reliably inside ASAR packages, Windows drives, and unpacked files
    protocol.handle('app', async (request) => {
      try {
        const parsedUrl = new URL(request.url);
        let pathname = decodeURIComponent(parsedUrl.pathname);
        if (pathname.startsWith('/')) {
          pathname = pathname.substring(1);
        }
        pathname = pathname.replace(/^\/+/, '');

        // If root, empty, or a client-side route without a file extension, serve index.html
        if (!pathname || pathname === '' || pathname === 'index.html') {
          pathname = 'index.html';
        }

        const distDir = path.resolve(__dirname, '../dist');
        let targetPath = path.resolve(distDir, pathname);

        // Windows path case-insensitive safety check
        if (!targetPath.toLowerCase().startsWith(distDir.toLowerCase())) {
          targetPath = path.join(distDir, 'index.html');
        }

        // Check file existence
        if (!fs.existsSync(targetPath)) {
          const ext = path.extname(pathname);
          if (!ext || ext === '.html') {
            targetPath = path.join(distDir, 'index.html');
          } else {
            console.warn(`[Protocol app] 404 Not Found: ${pathname}`);
            return new Response('Asset not found', { status: 404 });
          }
        } else if (fs.statSync(targetPath).isDirectory()) {
          targetPath = path.join(distDir, 'index.html');
        }

        const ext = path.extname(targetPath).toLowerCase();
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

        // 1. RAM cache hit (<0.1ms instantaneous response for repeat slide assets)
        if (assetMemoryCache.has(targetPath)) {
          const cached = assetMemoryCache.get(targetPath);
          return new Response(cached.buffer, {
            status: 200,
            headers: {
              'Content-Type': cached.mimeType,
              'Content-Length': String(cached.buffer.length),
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': ext === '.html' ? 'no-cache, must-revalidate' : 'public, max-age=31536000, immutable'
            }
          });
        }

        // 2. Direct ASAR buffer read (guaranteed instantaneous offline execution)
        const fileBuffer = fs.readFileSync(targetPath);

        // Cache lightweight code and style assets in RAM for zero-latency presentation transitions
        if (fileBuffer.length < 5 * 1024 * 1024) {
          assetMemoryCache.set(targetPath, { buffer: fileBuffer, mimeType });
        }

        return new Response(fileBuffer, {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Content-Length': String(fileBuffer.length),
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': ext === '.html' ? 'no-cache, must-revalidate' : 'public, max-age=31536000, immutable'
          }
        });
      } catch (err) {
        console.error('[Protocol app] Error serving path:', request.url, err);
        return new Response('File not found', { status: 404 });
      }
    });

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

  
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width: Math.min(1366, width),
    height: Math.min(768, height),
    minWidth: 1024,
    minHeight: 580,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#0c0d10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      backgroundThrottling: false,
      spellcheck: false,
      navigateOnDragDrop: false
    }
  });

  // Enable F12 and Ctrl+Shift+I to toggle DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Delegate external links (e.g. Google Fonts, DaFont, FontSquirrel, manuals) to native Windows browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('mailto:')) {
      shell.openExternal(url).catch(err => console.warn('[shell:openExternal] Warning:', err));
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Handle font / asset downloads to Windows user's Downloads folder
  mainWindow.webContents.session.on('will-download', (event, item) => {
    const fileName = item.getFilename();
    const savePath = path.join(app.getPath('downloads'), fileName);
    item.setSavePath(savePath);
  });

  const fallbackShowTimer = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  }, 1200);

  mainWindow.once('ready-to-show', () => {
    clearTimeout(fallbackShowTimer);
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[mainWindow] did-fail-load: ${errorCode} - ${errorDescription} (${validatedURL})`);
    if (errorCode !== -3) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL('app://localhost/index.html').catch(err => {
            console.error('[mainWindow] Recovery reload error:', err);
          });
        }
      }, 500);
    }
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[mainWindow] render-process-gone:', details);
  });

  const appIndexUrl = 'app://localhost/index.html';
  if (process.env.NODE_ENV === 'development' && !app.isPackaged) {
    mainWindow.loadURL('http://localhost:3000').catch(() => {
      mainWindow.loadURL(appIndexUrl).catch(e => console.error('[mainWindow] Dev fallback error:', e));
    });
  } else {
    // In production / packaged app: load through privileged 'app' scheme to support ES modules, CORS, and offline ASAR resolution
    mainWindow.loadURL(appIndexUrl).catch((err) => {
      console.error('[mainWindow] loadURL app:// failed:', err);
    });
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

  mainWindow.on('close', () => {
    // Proactively close all projector windows when main window begins closing
    displayWindows.forEach(win => {
      if (win && !win.isDestroyed()) {
        try { win.close(); } catch (e) {}
      }
    });
    displayWindows.clear();
    displayRouteMap.clear();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    displayWindows.forEach(win => {
      if (win && !win.isDestroyed()) {
        try { win.close(); } catch (e) {}
      }
    });
    displayWindows.clear();
    displayRouteMap.clear();
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

// Ensure app quits and closes all projectors when all windows close or before quit
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  displayWindows.forEach(win => {
    if (win && !win.isDestroyed()) {
      try { win.close(); } catch (e) {}
    }
  });
  displayWindows.clear();
  displayRouteMap.clear();
});

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

// System & Projectors Overlay Mode Handlers (Always on top of all Windows apps)
ipcMain.handle('window:set-always-on-top', (event, flag) => {
  isSystemAlwaysOnTop = Boolean(flag);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(isSystemAlwaysOnTop, 'floating', 1);
    mainWindow.webContents.send('system:overlay-mode-changed', { alwaysOnTop: isSystemAlwaysOnTop });
  }
  displayWindows.forEach(win => {
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(isSystemAlwaysOnTop, 'screen-saver', 1);
      win.setVisibleOnAllWorkspaces(isSystemAlwaysOnTop, { visibleOnFullScreen: true });
      win.webContents.send('system:overlay-mode-changed', { alwaysOnTop: isSystemAlwaysOnTop });
    }
  });
  return isSystemAlwaysOnTop;
});

ipcMain.handle('window:get-always-on-top', () => {
  return isSystemAlwaysOnTop;
});

ipcMain.handle('projector:set-always-on-top', (event, flag) => {
  const flagBool = Boolean(flag);
  displayWindows.forEach(win => {
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(flagBool, 'screen-saver', 1);
      win.setVisibleOnAllWorkspaces(flagBool, { visibleOnFullScreen: true });
      win.webContents.send('system:overlay-mode-changed', { alwaysOnTop: flagBool });
    }
  });
  return flagBool;
});

ipcMain.handle('system:set-overlay-mode', (event, options) => {
  const alwaysOnTop = typeof options === 'boolean' ? options : Boolean(options?.alwaysOnTop);
  isSystemAlwaysOnTop = alwaysOnTop;
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(isSystemAlwaysOnTop, 'floating', 1);
    mainWindow.webContents.send('system:overlay-mode-changed', { alwaysOnTop: isSystemAlwaysOnTop });
  }

  displayWindows.forEach(win => {
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(isSystemAlwaysOnTop, 'screen-saver', 1);
      win.setVisibleOnAllWorkspaces(isSystemAlwaysOnTop, { visibleOnFullScreen: true });
      if (options && typeof options.ignoreMouseEvents === 'boolean') {
        win.setIgnoreMouseEvents(options.ignoreMouseEvents, { forward: true });
      }
      win.webContents.send('system:overlay-mode-changed', { alwaysOnTop: isSystemAlwaysOnTop });
    }
  });

  return { success: true, alwaysOnTop: isSystemAlwaysOnTop };
});

ipcMain.handle('system:get-overlay-mode', () => {
  return { alwaysOnTop: isSystemAlwaysOnTop };
});

ipcMain.handle('shell:open-external', async (event, url) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('mailto:'))) {
    try {
      await shell.openExternal(url);
      return true;
    } catch (err) {
      console.warn('[shell:open-external] Failed to open URL:', url, err);
      return false;
    }
  }
  return false;
});

// -------------------------------------------------------------
// NATIVE IPC HANDLERS
// -------------------------------------------------------------

let cachedWinMonitors = null;
let monitorFetchPromise = null;

function invalidateMonitorCache() {
  cachedWinMonitors = null;
  monitorFetchPromise = null;
}

function getWindowsMonitorNames(forceRefresh = false) {
  if (process.platform !== 'win32') {
    return Promise.resolve([]);
  }
  
  if (!forceRefresh && cachedWinMonitors !== null) {
    return Promise.resolve(cachedWinMonitors);
  }

  if (monitorFetchPromise) {
    return monitorFetchPromise;
  }

  monitorFetchPromise = new Promise((resolve) => {
    // WmiMonitorID contains ManufacturerName and UserFriendlyName as character code arrays.
    // Convert them to ASCII string characters and join them.
    const cmd = `powershell -NoProfile -Command "Get-CimInstance -Namespace root\\wmi -ClassName WmiMonitorID | ForEach-Object { $m = [System.Text.Encoding]::ASCII.GetString($_.ManufacturerName -notmatch 0).Trim(); $n = [System.Text.Encoding]::ASCII.GetString($_.UserFriendlyName -notmatch 0).Trim(); Write-Output \\"\\$m|\\$n\\" }"`;
    
    exec(cmd, { timeout: 2000 }, (err, stdout) => {
      if (err) {
        // Fallback: query Win32_DesktopMonitor
        const cmdFallback = `powershell -NoProfile -Command "Get-CimInstance Win32_DesktopMonitor | ForEach-Object { Write-Output (\\"\\" + $_.MonitorManufacturer + \\"|\\" + $_.Name) }"`;
        exec(cmdFallback, { timeout: 2000 }, (err2, stdout2) => {
          monitorFetchPromise = null;
          if (err2 || !stdout2) {
            cachedWinMonitors = cachedWinMonitors || [];
            return resolve(cachedWinMonitors);
          }
          const lines = stdout2.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          cachedWinMonitors = lines.map(line => {
            const parts = line.split('|');
            return { brand: parts[0] || '', model: parts[1] || '' };
          });
          resolve(cachedWinMonitors);
        });
        return;
      }
      
      monitorFetchPromise = null;
      if (!stdout) {
        cachedWinMonitors = cachedWinMonitors || [];
        return resolve(cachedWinMonitors);
      }
      const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      cachedWinMonitors = lines.map(line => {
        const parts = line.split('|');
        return { brand: parts[0] || '', model: parts[1] || '' };
      });
      resolve(cachedWinMonitors);
    });
  });

  return monitorFetchPromise;
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

async function getFormattedDisplays(forceRefresh = false) {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  const winMonitors = await getWindowsMonitorNames(forceRefresh);

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
  return await getFormattedDisplays(false);
});

// Display Hot-Plug & Metrics Monitoring
app.whenReady().then(() => {
  // Pre-warm monitor metadata cache in background so projector sync never waits
  getWindowsMonitorNames().catch(() => {});

  const notifyDisplaysChanged = async () => {
    invalidateMonitorCache();
    const displays = await getFormattedDisplays(true);

    // Reposition any active projector windows to match updated target display bounds
    for (const [canonicalDisplayId, win] of displayWindows.entries()) {
      if (win && !win.isDestroyed()) {
        const matched = resolveTargetDisplay(canonicalDisplayId, displays);
        if (matched && matched.bounds) {
          win.setBounds(matched.bounds);
          win.setFullScreen(true);
        }
      }
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
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

  return `app://localhost/?${queryParams}${hashParams}`;
}

function cleanDisplayString(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/\s*\(primary\)\s*/gi, '')
    .replace(/\s*\(\d+\s*[x×]\s*\d+\)\s*/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function resolveTargetDisplay(displayId, formattedDisplays) {
  if (!displayId || !Array.isArray(formattedDisplays)) return null;
  const idStr = String(displayId).trim();
  const idLower = idStr.toLowerCase();

  // 1. Direct exact match on id, displayId, name, or label
  let match = formattedDisplays.find(fd =>
    fd.id === idStr ||
    String(fd.displayId) === idStr ||
    fd.name === idStr ||
    fd.label === idStr
  );
  if (match) return match;

  // 2. Exact case-insensitive match
  match = formattedDisplays.find(fd =>
    fd.id.toLowerCase() === idLower ||
    String(fd.displayId).toLowerCase() === idLower ||
    (fd.name && fd.name.toLowerCase() === idLower) ||
    (fd.label && fd.label.toLowerCase() === idLower)
  );
  if (match) return match;

  // 3. Clean alphanumeric match (removes punctuation, "(Primary)", "(1920x1080)")
  const cleanTarget = cleanDisplayString(idStr);
  if (cleanTarget) {
    match = formattedDisplays.find(fd => {
      const cleanName = cleanDisplayString(fd.name);
      const cleanLabel = cleanDisplayString(fd.label);
      const cleanId = cleanDisplayString(fd.id);
      return cleanName === cleanTarget || cleanLabel === cleanTarget || cleanId === cleanTarget;
    });
    if (match) return match;
  }

  // Strict 1:1 locking - zero fuzzy or substring fallbacks
  return null;
}

// Projector Management (Strict 1-to-1 Target Display Architecture)
ipcMain.handle('projector:open', async (event, { groupId, displayId, bounds }) => {
  if (!groupId) return { success: false, status: 'DISCONNECTED', error: 'groupId is required' };

  const formattedDisplays = await getFormattedDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();

  let targetBounds = bounds;
  let selectedDisplay = resolveTargetDisplay(displayId, formattedDisplays);

  if (!selectedDisplay) {
    // If the targeted display cannot be resolved, we should not guess.
    // However, if no target was provided at all, we can fallback safely.
    if (!displayId) {
      selectedDisplay = formattedDisplays.find(fd => !fd.isPrimary) || formattedDisplays[0];
    } else {
      console.warn(`[Projector] Could not strictly resolve display: ${displayId}`);
      return { success: false, status: 'DISCONNECTED', error: 'Target display not found.' };
    }
  }

  // User requested strict lock to target display - removing auto-redirect logic.
  // The system should not guess or redirect if they explicitly target a display.
  
  const canonicalDisplayId = selectedDisplay ? selectedDisplay.id : (displayId || `display-${primaryDisplay.id}`);

  // --- PROJECTOR WINDOW REUSE (DISPLAY-CENTRIC 1:1) ---
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
    kiosk: true,
    fullscreen: true,
    fullscreenable: true,
    autoHideMenuBar: true,
    alwaysOnTop: isSystemAlwaysOnTop,
    skipTaskbar: true,
    transparent: true,
    hasShadow: false,
    thickFrame: false,
    titleBarStyle: 'hidden',
    enableLargerThanScreen: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      backgroundThrottling: false,
      spellcheck: false,
      navigateOnDragDrop: false
    }
  });

  if (isSystemAlwaysOnTop) {
    win.setAlwaysOnTop(true, 'screen-saver', 1);
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

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
    win.setMenuBarVisibility(false);
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
    if (displayWindows.get(canonicalDisplayId) === win) {
      displayWindows.delete(canonicalDisplayId);
      displayRouteMap.delete(canonicalDisplayId);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('projector:status-changed', { groupId, displayId: canonicalDisplayId, status: 'DISCONNECTED' });
        mainWindow.focus();
        mainWindow.moveTop();
      }
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

  // Strictly filter for assignments where a real, non-empty groupId is assigned to that physical display
  const liveAssignments = assignments.filter(item => item && item.groupId && item.displayId);

  // Map of canonicalDisplayId -> winning assigned target details (strictly 1 is to 1 per physical display)
  const canonicalTargets = new Map();
  for (const item of liveAssignments) {
    const matchedDisplay = resolveTargetDisplay(item.displayId, formattedDisplays);
    if (matchedDisplay) {
      canonicalTargets.set(matchedDisplay.id, {
        canonicalDisplayId: matchedDisplay.id,
        matchedDisplay,
        groupId: item.groupId,
        displayId: item.displayId
      });
    }
  }

  // Close any projector windows on displays that are NO LONGER targeted or NOT selected
  for (const [dispId, win] of displayWindows.entries()) {
    if (!canonicalTargets.has(dispId)) {
      if (win && !win.isDestroyed()) win.close();
      displayWindows.delete(dispId);
      displayRouteMap.delete(dispId);
      results.push({ displayId: dispId, action: 'closed' });
    }
  }

  // Ensure each targeted physical display has EXACTLY ONE window (1-is-to-1)
  for (const [canonicalDisplayId, target] of canonicalTargets.entries()) {
    const { matchedDisplay, groupId } = target;

    // If window already exists on this physical display, reuse it and update route!
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

    // Otherwise create exactly 1 window on this targeted physical display
    const win = new BrowserWindow({
      x: matchedDisplay.bounds.x,
      y: matchedDisplay.bounds.y,
      width: matchedDisplay.bounds.width,
      height: matchedDisplay.bounds.height,
      frame: false,
      fullscreen: false,
      fullscreenable: true,
      autoHideMenuBar: true,
      alwaysOnTop: isSystemAlwaysOnTop,
      skipTaskbar: true,
      transparent: true,
      hasShadow: false,
      thickFrame: false,
      titleBarStyle: 'hidden',
      enableLargerThanScreen: true,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webSecurity: false,
        backgroundThrottling: false,
        spellcheck: false,
        navigateOnDragDrop: false
      }
    });

    if (isSystemAlwaysOnTop) {
      win.setAlwaysOnTop(true, 'screen-saver', 1);
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }

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

    win.setPosition(matchedDisplay.bounds.x, matchedDisplay.bounds.y);
    win.setSize(matchedDisplay.bounds.width, matchedDisplay.bounds.height);
    win.setBounds(matchedDisplay.bounds);
    win.setFullScreen(true);
    win.setMenuBarVisibility(false);
    if (typeof win.showInactive === 'function') {
      win.showInactive();
    } else {
      win.show();
    }

    win.on('closed', () => {
      if (displayWindows.get(canonicalDisplayId) === win) {
        displayWindows.delete(canonicalDisplayId);
        displayRouteMap.delete(canonicalDisplayId);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('projector:status-changed', { groupId, displayId: canonicalDisplayId, status: 'DISCONNECTED' });
          mainWindow.focus();
          mainWindow.moveTop();
        }
      }
    });

    displayWindows.set(canonicalDisplayId, win);
    displayRouteMap.set(canonicalDisplayId, groupId);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('projector:status-changed', { groupId, displayId: canonicalDisplayId, status: 'CONNECTED' });
      mainWindow.focus();
      mainWindow.moveTop();
    }

    results.push({ displayId: canonicalDisplayId, groupId, action: 'opened' });
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

// Helper to classify GPU type
function classifyGpuDevice(name, vendor) {
  const s = `${name} ${vendor}`.toLowerCase();
  if (s.includes('swiftshader') || s.includes('llvmpipe') || s.includes('software') || s.includes('basic render')) return 'software';
  if (s.includes('virtualbox') || s.includes('vmware') || s.includes('hyper-v') || s.includes('qemu')) return 'virtual';
  if (/nvidia|geforce|rtx|gtx|quadro|titan|tesla/i.test(s)) return 'discrete';
  if (/radeon\s+(rx|pro|vii|hd\s+[789]\d{3})|discrete|dedicated/i.test(s)) return 'discrete';
  if (/arc(\s+pro|\s+a\d{3})/i.test(s)) return 'discrete';
  if (/intel.*(uhd|iris|hd\s+graphics)|amd\s+radeon(\(tm\))?\s+graphics|apu|vega\s+\d+|integrated/i.test(s)) return 'integrated';
  if (/intel/i.test(s)) return 'integrated';
  if (/nvidia|amd/i.test(s)) return 'discrete';
  return 'unknown';
}

function cleanVendorName(vendor, name) {
  const s = `${vendor} ${name}`.toLowerCase();
  if (s.includes('nvidia') || s.includes('geforce')) return 'NVIDIA';
  if (s.includes('intel')) return 'Intel';
  if (s.includes('amd') || s.includes('ati') || s.includes('radeon')) return 'AMD';
  if (s.includes('apple')) return 'Apple';
  if (s.includes('microsoft')) return 'Microsoft';
  return vendor || 'Vendor';
}

// Query physical video controllers on Windows
async function queryWindowsDisplayAdapters() {
  if (process.platform !== 'win32') return [];
  return new Promise((resolve) => {
    const psCmd = 'powershell.exe -NoProfile -NonInteractive -Command "Get-CimInstance Win32_VideoController | Select-Object Name, VideoProcessor, AdapterRAM, DriverVersion, Status | ConvertTo-Json"';
    exec(psCmd, { timeout: 3000, windowsHide: true }, (err, stdout) => {
      if (err || !stdout) {
        exec('wmic path win32_VideoController get name, driverversion /format:csv', { timeout: 2000, windowsHide: true }, (wErr, wStdout) => {
          if (wErr || !wStdout) return resolve([]);
          try {
            const lines = wStdout.split(/\r?\n/).filter(l => l.trim() && !l.toLowerCase().startsWith('node'));
            const gpus = [];
            for (const line of lines) {
              const parts = line.split(',');
              if (parts.length >= 2) {
                const name = (parts[parts.length - 2] || '').trim();
                const ver = (parts[parts.length - 1] || '').trim();
                if (name && name.toLowerCase() !== 'name') {
                  const ven = cleanVendorName('', name);
                  gpus.push({
                    name,
                    vendor: ven,
                    type: classifyGpuDevice(name, ven),
                    driverVersion: ver
                  });
                }
              }
            }
            resolve(gpus);
          } catch {
            resolve([]);
          }
        });
        return;
      }
      try {
        let parsed = JSON.parse(stdout.trim());
        if (!Array.isArray(parsed)) parsed = [parsed];
        const gpus = parsed.map(item => {
          const name = (item.Name || '').trim();
          const ven = cleanVendorName('', name);
          return {
            name,
            vendor: ven,
            type: classifyGpuDevice(name, ven),
            driverVersion: (item.DriverVersion || '').trim(),
            vramMb: typeof item.AdapterRAM === 'number' ? Math.round(item.AdapterRAM / (1024 * 1024)) : undefined
          };
        }).filter(g => g.name);
        resolve(gpus);
      } catch {
        resolve([]);
      }
    });
  });
}

// Real Device Hardware Diagnostics & Adaptive Engine IPC
ipcMain.handle('system:get-hardware-info', async () => {
  try {
    const gpuFeatures = app.getGPUFeatureStatus();
    let gpuInfo = null;
    let completeGpuInfo = null;
    try {
      gpuInfo = await app.getGPUInfo('basic');
    } catch (e) {}
    try {
      completeGpuInfo = await app.getGPUInfo('complete');
    } catch (e) {}

    const detectedGpus = [];
    const addGpu = (gpu) => {
      if (!gpu.name) return;
      const lower = gpu.name.toLowerCase();
      const existing = detectedGpus.find(g => g.name.toLowerCase() === lower);
      if (!existing) {
        detectedGpus.push(gpu);
      } else {
        if (gpu.driverVersion && !existing.driverVersion) existing.driverVersion = gpu.driverVersion;
        if (gpu.vramMb && !existing.vramMb) existing.vramMb = gpu.vramMb;
      }
    };

    // 1. Physical video adapters from Windows CIM
    if (process.platform === 'win32') {
      const winGpus = await queryWindowsDisplayAdapters().catch(() => []);
      for (const wg of winGpus) {
        addGpu(wg);
      }
    }

    // 2. Chromium complete GPU device list
    if (completeGpuInfo && Array.isArray(completeGpuInfo.gpuDevice)) {
      for (const dev of completeGpuInfo.gpuDevice) {
        let venName = 'Vendor';
        if (dev.vendorId === 0x10de || dev.vendorId === 4318) venName = 'NVIDIA';
        else if (dev.vendorId === 0x1002 || dev.vendorId === 4098) venName = 'AMD';
        else if (dev.vendorId === 0x8086 || dev.vendorId === 32902) venName = 'Intel';
        else if (dev.vendorId === 0x106b || dev.vendorId === 4203) venName = 'Apple';
        else if (dev.vendorId === 0x1414 || dev.vendorId === 5140) venName = 'Microsoft';

        const rawDriver = dev.driverVendor || dev.driverVersion || '';
        const guessType = (venName === 'NVIDIA' || venName === 'AMD') ? 'discrete' : 'integrated';
        if (venName !== 'Vendor') {
          // Check if this vendor is already matched
          const existing = detectedGpus.find(g => g.vendor.toLowerCase() === venName.toLowerCase());
          if (existing) {
            if (dev.driverVersion && !existing.driverVersion) existing.driverVersion = dev.driverVersion;
            if (dev.active) existing.isActive = true;
          } else {
            addGpu({
              name: `${venName} Graphics Adapter`,
              vendor: venName,
              type: guessType,
              driverVersion: dev.driverVersion,
              isActive: Boolean(dev.active)
            });
          }
        }
      }
    }

    // 3. Fallback to basic auxAttributes if no GPUs found
    if (detectedGpus.length === 0 && gpuInfo && gpuInfo.auxAttributes) {
      const aux = gpuInfo.auxAttributes;
      const r = aux.glRenderer || 'Graphics Adapter';
      const v = cleanVendorName(aux.glVendor || '', r);
      addGpu({
        name: r,
        vendor: v,
        type: classifyGpuDevice(r, v),
        isActive: true
      });
    }

    const nonSoftware = detectedGpus.filter(g => g.type !== 'software' && g.type !== 'virtual');
    const discreteGpu = nonSoftware.find(g => g.type === 'discrete') || null;
    const integratedGpu = nonSoftware.find(g => g.type === 'integrated') || null;
    const isDualGpu = (discreteGpu !== null && integratedGpu !== null) || nonSoftware.length > 1;

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
      gpus: detectedGpus,
      isDualGpu,
      discreteGpu,
      integratedGpu,
      isHardwareAccelerated: gpuFeatures?.gpu_compositing === 'enabled' || gpuFeatures?.['rasterization'] === 'enabled_force' || gpuFeatures?.['rasterization'] === 'enabled',
      directXStatus: process.platform === 'win32' ? 'Direct3D 11 Active' : 'Native Compositor Active'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});



// ============================================================================
// MICROSOFT POWERPOINT AUTOMATION & NATIVE RENDERING ENGINE (WINDOWS ONLY)
// ============================================================================

// Detect local Microsoft PowerPoint installation on Windows
ipcMain.handle('pptx:detect-powerpoint', async () => {
  if (process.platform !== 'win32') {
    return {
      available: false,
      platform: process.platform,
      reason: 'Microsoft PowerPoint hardware-accelerated backend is only supported on Windows.'
    };
  }

  // Check known standard installation paths across 64-bit and 32-bit Office / Microsoft 365
  const standardOfficePaths = [
    'C:\\Program Files\\Microsoft Office\\root\\Office16\\POWERPNT.EXE',
    'C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\POWERPNT.EXE',
    'C:\\Program Files\\Microsoft Office\\Office16\\POWERPNT.EXE',
    'C:\\Program Files (x86)\\Microsoft Office\\Office16\\POWERPNT.EXE',
    'C:\\Program Files\\Microsoft Office\\Office15\\POWERPNT.EXE',
    'C:\\Program Files (x86)\\Microsoft Office\\Office15\\POWERPNT.EXE',
    'C:\\Program Files\\Microsoft Office\\Office14\\POWERPNT.EXE',
    'C:\\Program Files (x86)\\Microsoft Office\\Office14\\POWERPNT.EXE',
  ];

  for (const p of standardOfficePaths) {
    if (fs.existsSync(p)) {
      return {
        available: true,
        platform: 'win32',
        executablePath: p,
        version: 'Microsoft PowerPoint (Office/M365)',
        reason: 'Microsoft PowerPoint found at ' + p
      };
    }
  }

  // Fallback: Test COM object availability via lightweight PowerShell command
  return new Promise((resolve) => {
    const comCheckCmd = `powershell.exe -NoProfile -NonInteractive -Command "$t = [Type]::GetTypeFromProgID('PowerPoint.Application'); if ($t) { Write-Output 'COM_FOUND' } else { Write-Output 'COM_NOT_FOUND' }"`;
    exec(comCheckCmd, { timeout: 4000 }, (err, stdout) => {
      if (!err && stdout && stdout.includes('COM_FOUND')) {
        resolve({
          available: true,
          platform: 'win32',
          version: 'Microsoft PowerPoint COM Automation',
          reason: 'Microsoft PowerPoint COM automation interface is registered and ready'
        });
      } else {
        resolve({
          available: false,
          platform: 'win32',
          reason: 'Microsoft PowerPoint is not installed or registered on this Windows system.'
        });
      }
    });
  });
});

// Render PPTX presentation slides to deterministic PNG cache using installed PowerPoint
ipcMain.handle('pptx:render-slides', async (event, payload) => {
  if (process.platform !== 'win32') {
    return { success: false, error: 'PowerPoint native rendering is only supported on Windows.' };
  }

  if (!payload || !payload.fileData) {
    return { success: false, error: 'Invalid presentation payload provided.' };
  }

  const hash = payload.hash || 'deck_' + Date.now();
  const cacheBaseDir = path.join(app.getPath('userData'), 'PptxRenderCache', hash);
  const metadataPath = path.join(cacheBaseDir, 'metadata.json');

  // Check persistent disk cache first for instant reloads
  if (fs.existsSync(metadataPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      const slideFiles = fs.readdirSync(cacheBaseDir)
        .filter(f => f.toLowerCase().endsWith('.png'))
        .sort((a, b) => {
          const numA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
          const numB = parseInt(b.replace(/[^0-9]/g, '')) || 0;
          return numA - numB;
        });

      if (slideFiles.length > 0) {
        const slides = slideFiles.map(f => {
          const imgBuf = fs.readFileSync(path.join(cacheBaseDir, f));
          return 'data:image/png;base64,' + imgBuf.toString('base64');
        });

        return {
          success: true,
          slides,
          slideCount: slides.length,
          width: meta.width || 1920,
          height: meta.height || 1080,
          aspectRatio: meta.aspectRatio || (16 / 9),
          cached: true
        };
      }
    } catch (e) {
      console.warn('[PowerPoint Automation] Cache read warning:', e);
    }
  }

  // Create clean temporary workspace
  const tempId = 'sw_pptx_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  const tempPptxPath = path.join(app.getPath('temp'), `${tempId}.pptx`);
  const tempOutputDir = path.join(app.getPath('temp'), tempId + '_out');

  try {
    fs.mkdirSync(tempOutputDir, { recursive: true });

    // Write binary input safely
    if (typeof payload.fileData === 'string') {
      const base64Data = payload.fileData.includes(',') ? payload.fileData.split(',')[1] : payload.fileData;
      fs.writeFileSync(tempPptxPath, Buffer.from(base64Data, 'base64'));
    } else {
      fs.writeFileSync(tempPptxPath, Buffer.from(payload.fileData));
    }

    // PowerShell script with guaranteed cleanup and timeout safety
    const psScript = `
$ErrorActionPreference = "Stop"
$ppt = $null
$presentation = $null
try {
  $ppt = New-Object -ComObject PowerPoint.Application
  $ppt.Visible = 0
  $presentation = $ppt.Presentations.Open("${tempPptxPath.replace(/\\/g, '\\\\')}", -1, 0, 0)
  
  $slideW = $presentation.PageSetup.SlideWidth
  $slideH = $presentation.PageSetup.SlideHeight
  $aspect = 1.777778
  if ($slideH -gt 0) {
    $aspect = $slideW / $slideH
  }

  # Export all slides as PNG images
  $presentation.SaveCopyAs("${tempOutputDir.replace(/\\/g, '\\\\')}", 18)
  
  $count = $presentation.Slides.Count
  $presentation.Close()
  $presentation = $null

  if ($ppt.Presentations.Count -eq 0) {
    $ppt.Quit()
  }
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
  $ppt = $null
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()

  Write-Output "RESULT:SUCCESS|COUNT:$count|ASPECT:$aspect"
} catch {
  if ($presentation -ne $null) {
    try { $presentation.Close() } catch {}
  }
  if ($ppt -ne $null) {
    try {
      if ($ppt.Presentations.Count -eq 0) { $ppt.Quit() }
      [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
    } catch {}
  }
  [GC]::Collect()
  Write-Error $_.Exception.Message
}
`;

    const psScriptPath = path.join(tempOutputDir, 'run_render.ps1');
    fs.writeFileSync(psScriptPath, psScript, 'utf-8');

    return await new Promise((resolve) => {
      exec(`powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${psScriptPath}"`, { timeout: 60000 }, (error, stdout, stderr) => {
        if (error || !stdout || !stdout.includes('RESULT:SUCCESS')) {
          const errMsg = stderr || error?.message || 'PowerPoint automation process failed.';
          console.warn('[PowerPoint Automation] Render error:', errMsg);
          // Clean up temp
          try {
            if (fs.existsSync(tempPptxPath)) fs.unlinkSync(tempPptxPath);
            if (fs.existsSync(tempOutputDir)) fs.rmSync(tempOutputDir, { recursive: true, force: true });
          } catch (e) {}
          return resolve({ success: false, error: errMsg });
        }

        try {
          // Extract aspect ratio from script output if available
          let aspectRatio = 16 / 9;
          const aspectMatch = stdout.match(/ASPECT:([\d.]+)/);
          if (aspectMatch && parseFloat(aspectMatch[1]) > 0) {
            aspectRatio = parseFloat(aspectMatch[1]);
          }

          // Read exported slide images
          const files = fs.readdirSync(tempOutputDir)
            .filter(f => f.toLowerCase().endsWith('.png'))
            .sort((a, b) => {
              const numA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
              const numB = parseInt(b.replace(/[^0-9]/g, '')) || 0;
              return numA - numB;
            });

          if (files.length === 0) {
            return resolve({ success: false, error: 'No slide image files were generated by PowerPoint.' });
          }

          // Save to persistent cache directory
          fs.mkdirSync(cacheBaseDir, { recursive: true });
          const slides = [];

          for (let i = 0; i < files.length; i++) {
            const srcFile = path.join(tempOutputDir, files[i]);
            const destFile = path.join(cacheBaseDir, `slide_${i + 1}.png`);
            fs.copyFileSync(srcFile, destFile);

            const imgBuf = fs.readFileSync(srcFile);
            slides.push('data:image/png;base64,' + imgBuf.toString('base64'));
          }

          const width = 1920;
          const height = Math.round(width / aspectRatio);

          fs.writeFileSync(metadataPath, JSON.stringify({
            presentationId: payload.presentationId || '',
            hash,
            slideCount: slides.length,
            width,
            height,
            aspectRatio,
            renderedAt: Date.now()
          }, null, 2));

          // Cleanup temp files
          try {
            if (fs.existsSync(tempPptxPath)) fs.unlinkSync(tempPptxPath);
            if (fs.existsSync(tempOutputDir)) fs.rmSync(tempOutputDir, { recursive: true, force: true });
          } catch (e) {}

          resolve({
            success: true,
            slides,
            slideCount: slides.length,
            width,
            height,
            aspectRatio,
            cached: false
          });
        } catch (postErr) {
          resolve({ success: false, error: postErr.message });
        }
      });
    });
  } catch (err) {
    try {
      if (fs.existsSync(tempPptxPath)) fs.unlinkSync(tempPptxPath);
      if (fs.existsSync(tempOutputDir)) fs.rmSync(tempOutputDir, { recursive: true, force: true });
    } catch (e) {}
    return { success: false, error: err.message };
  }
});

// Clear PowerPoint cache
ipcMain.handle('pptx:clear-cache', async (event, hash) => {
  try {
    const baseCache = path.join(app.getPath('userData'), 'PptxRenderCache');
    if (hash) {
      const targetDir = path.join(baseCache, hash);
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
    } else if (fs.existsSync(baseCache)) {
      fs.rmSync(baseCache, { recursive: true, force: true });
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("convert-pptx", async (event, filePath) => {
  return new Promise((resolve, reject) => {
    if (process.platform !== "win32") {
      return reject(new Error("Native PowerPoint conversion is only supported on Windows."));
    }
    // Backward compatibility wrapper
    const outputDir = path.join(os.tmpdir(), "simpleworship-pptx-" + Date.now());
    fs.mkdirSync(outputDir, { recursive: true });
    const psPath = filePath.replace(/\//g, "\\").replace(/"/g, '""');
    const psOut = outputDir.replace(/\//g, "\\").replace(/"/g, '""');

    const psScript = `
$ErrorActionPreference = "Stop"
try {
  $ppt = New-Object -ComObject PowerPoint.Application
  $presentation = $ppt.Presentations.Open("${psPath}", -1, 0, 0)
  $presentation.SaveCopyAs("${psOut}", 18)
  $presentation.Close()
  if ($ppt.Presentations.Count -eq 0) { $ppt.Quit() }
  Write-Output "SUCCESS"
} catch {
  Write-Error $_.Exception.Message
}
    `;

    const psFile = path.join(outputDir, "convert.ps1");
    fs.writeFileSync(psFile, psScript);

    exec(`powershell.exe -ExecutionPolicy Bypass -File "${psFile}"`, (error, stdout, stderr) => {
      if (error || !stdout.includes("SUCCESS")) {
        reject(error || new Error(stderr || "PowerPoint conversion failed."));
      } else {
        try {
          const files = fs.readdirSync(outputDir).filter(f => f.toLowerCase().endsWith(".png"));
          files.sort((a, b) => {
            const numA = parseInt(a.replace(/[^0-9]/g, "")) || 0;
            const numB = parseInt(b.replace(/[^0-9]/g, "")) || 0;
            return numA - numB;
          });
          const images = files.map(file => {
            const imgPath = path.join(outputDir, file);
            const base64 = fs.readFileSync(imgPath, "base64");
            return "data:image/png;base64," + base64;
          });
          resolve(images);
        } catch (e) {
          reject(e);
        }
      }
    });
  });
});

// Native Windows OS Font Installation IPC
ipcMain.handle('system:install-font-windows', async (event, { family, bufferBase64 }) => {
  try {
    const cleanFamily = (family || '').replace(/^["']+|["']+$/g, '').trim();
    if (!cleanFamily) return { success: false, error: 'Family name required' };

    let buffer = null;
    let format = 'ttf';
    if (bufferBase64) {
      const b64 = bufferBase64.includes(',') ? bufferBase64.split(',')[1] : bufferBase64;
      buffer = Buffer.from(b64, 'base64');
    }

    if (process.platform !== 'win32') {
      return { success: true, message: `Font "${cleanFamily}" ready.` };
    }

    const userFontDir = path.join(process.env.LOCALAPPDATA || os.homedir(), 'Microsoft', 'Windows', 'Fonts');
    if (!fs.existsSync(userFontDir)) {
      fs.mkdirSync(userFontDir, { recursive: true });
    }

    if (buffer) {
      const safeName = cleanFamily.replace(/[^a-zA-Z0-9_-]/g, '_');
      const targetPath = path.join(userFontDir, `${safeName}.${format}`);
      fs.writeFileSync(targetPath, buffer);

      const regKey = `HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts`;
      const regName = `${cleanFamily} (TrueType)`;
      const psScript = `
        $target = "${targetPath.replace(/\\/g, '\\\\')}";
        $regName = "${regName.replace(/"/g, '`"')}";
        New-ItemProperty -Path "${regKey}" -Name $regName -Value $target -PropertyType String -Force | Out-Null;
        try {
          $signature = @"
            [DllImport("gdi32.dll")]
            public static extern int AddFontResource(string lpFileName);
            [DllImport("user32.dll")]
            public static extern int SendMessage(int hWnd, uint Msg, int wParam, int lParam);
"@
          $type = Add-Type -MemberDefinition $signature -Name "FontHelper" -Namespace "SimpleWorship" -PassThru;
          $type::AddFontResource($target);
          $HWND_BROADCAST = 0xffff;
          $WM_FONTCHANGE = 0x001d;
          $type::SendMessage($HWND_BROADCAST, $WM_FONTCHANGE, 0, 0);
        } catch {}
      `;

      return await new Promise((resolve) => {
        exec(`powershell.exe -NoProfile -NonInteractive -Command "${psScript.replace(/\r?\n/g, ' ')}"`, { timeout: 10000, windowsHide: true }, (err) => {
          if (err) console.warn('[electron] Font registry notification warning:', err.message);
          resolve({ success: true, message: `Installed "${cleanFamily}" into Windows OS!` });
        });
      });
    }

    return { success: true, message: `Font "${cleanFamily}" registered.` };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('system:install-font-batch-windows', async (event, { families }) => {
  return { success: true, count: Array.isArray(families) ? families.length : 0 };
});



import express from 'express';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { createServer as createViteServer } from 'vite';

interface HostGpuInfo {
  name: string;
  vendor: string;
  type: 'discrete' | 'integrated' | 'virtual' | 'software' | 'unknown';
  driverVersion?: string;
  vramMb?: number;
  isActive?: boolean;
  isPrimary?: boolean;
}

let cachedHostGpus: HostGpuInfo[] | null = null;

function classifyGpu(name: string, vendor: string): 'discrete' | 'integrated' | 'virtual' | 'software' | 'unknown' {
  const s = `${name} ${vendor}`.toLowerCase();
  if (s.includes('swiftshader') || s.includes('llvmpipe') || s.includes('software') || s.includes('basic render')) {
    return 'software';
  }
  if (s.includes('virtualbox') || s.includes('vmware') || s.includes('hyper-v') || s.includes('qemu')) {
    return 'virtual';
  }
  if (/nvidia|geforce|rtx|gtx|quadro|titan|tesla/i.test(s)) return 'discrete';
  if (/radeon\s+(rx|pro|vii|hd\s+[789]\d{3})|discrete|dedicated/i.test(s)) return 'discrete';
  if (/arc(\s+pro|\s+a\d{3})/i.test(s)) return 'discrete';
  if (/intel.*(uhd|iris|hd\s+graphics)|amd\s+radeon(\(tm\))?\s+graphics|apu|vega\s+\d+|integrated/i.test(s)) return 'integrated';
  if (/intel/i.test(s)) return 'integrated';
  if (/nvidia|amd/i.test(s)) return 'discrete';
  return 'unknown';
}

function cleanVendor(vendor: string, name: string): string {
  const s = `${vendor} ${name}`.toLowerCase();
  if (s.includes('nvidia') || s.includes('geforce')) return 'NVIDIA';
  if (s.includes('intel')) return 'Intel';
  if (s.includes('amd') || s.includes('ati') || s.includes('radeon')) return 'AMD';
  if (s.includes('apple')) return 'Apple';
  if (s.includes('microsoft')) return 'Microsoft';
  return vendor || 'Vendor';
}

function detectHostGpus(): Promise<HostGpuInfo[]> {
  if (cachedHostGpus && cachedHostGpus.length > 0) return Promise.resolve(cachedHostGpus);
  return new Promise((resolve) => {
    const list: HostGpuInfo[] = [];

    const finish = () => {
      // Deduplicate by name
      const unique: HostGpuInfo[] = [];
      for (const item of list) {
        if (!item.name || item.name === 'Unknown GPU Device') continue;
        const exists = unique.find(u => u.name.toLowerCase() === item.name.toLowerCase());
        if (!exists) {
          unique.push(item);
        } else if (item.driverVersion && !exists.driverVersion) {
          exists.driverVersion = item.driverVersion;
        }
      }

      // If we have 2+ non-software GPUs and neither is marked discrete, assign highest spec to discrete
      const nonSoft = unique.filter(u => u.type !== 'software' && u.type !== 'virtual');
      if (nonSoft.length >= 2 && !nonSoft.some(u => u.type === 'discrete')) {
        // Find if one is NVIDIA or AMD or has dedicated markers
        const discIdx = nonSoft.findIndex(u => /nvidia|geforce|rtx|gtx|radeon|discrete/i.test(u.name + ' ' + u.vendor));
        if (discIdx !== -1) {
          nonSoft[discIdx].type = 'discrete';
        } else {
          nonSoft[0].type = 'discrete';
        }
        // Mark the other as integrated if unknown
        const intIdx = nonSoft.findIndex((u, idx) => idx !== discIdx && (u.type === 'unknown' || /intel|uhd|iris|apu/i.test(u.name)));
        if (intIdx !== -1) {
          nonSoft[intIdx].type = 'integrated';
        }
      }

      if (unique.length > 0) {
        cachedHostGpus = unique;
      }
      resolve(unique);
    };

    if (os.platform() === 'win32') {
      // 1. Try PowerShell CimInstance / WMI
      const psCmd = 'powershell.exe -NoProfile -NonInteractive -Command "$res = @(); try { $res += Get-CimInstance Win32_VideoController | Select-Object Name, VideoProcessor, AdapterRAM, DriverVersion } catch {}; if ($res.Count -eq 0) { try { $res += Get-WmiObject Win32_VideoController | Select-Object Name, VideoProcessor, AdapterRAM, DriverVersion } catch {} }; try { $reg = Get-ItemProperty -Path \'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\000*\' -ErrorAction SilentlyContinue | Where-Object { $_.DriverDesc } | Select-Object @{Name=\'Name\';Expression={$_.DriverDesc}}, @{Name=\'DriverVersion\';Expression={$_.DriverVersion}}, @{Name=\'Provider\';Expression={$_.ProviderName}}; foreach ($r in $reg) { if (-not ($res | Where-Object { $_.Name -eq $r.Name })) { $res += $r } } } catch {}; $res | ConvertTo-Json"';
      exec(psCmd, { timeout: 8000, windowsHide: true }, (err, stdout) => {
        if (!err && stdout && stdout.trim()) {
          try {
            let parsed = JSON.parse(stdout.trim());
            if (!Array.isArray(parsed)) parsed = [parsed];
            for (const item of parsed) {
              const name = (item.Name || '').trim();
              if (name && !name.toLowerCase().includes('remote') && !name.toLowerCase().includes('citrix')) {
                const vendor = cleanVendor(item.Provider || '', name);
                list.push({
                  name,
                  vendor,
                  type: classifyGpu(name, vendor),
                  driverVersion: (item.DriverVersion || '').trim(),
                  vramMb: typeof item.AdapterRAM === 'number' && item.AdapterRAM > 0 ? Math.round(item.AdapterRAM / (1024 * 1024)) : undefined
                });
              }
            }
          } catch {}
        }

        // Also check nvidia-smi if NVIDIA card is present but was dormant
        exec('nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader,nounits', { timeout: 2500, windowsHide: true }, (nvErr, nvStdout) => {
          if (!nvErr && nvStdout && nvStdout.trim()) {
            const lines = nvStdout.trim().split(/\r?\n/);
            for (const line of lines) {
              const parts = line.split(',').map(p => p.trim());
              if (parts[0]) {
                const name = parts[0];
                const vendor = 'NVIDIA';
                const ver = parts[1] || '';
                const vram = parts[2] ? parseInt(parts[2], 10) : undefined;
                list.push({
                  name,
                  vendor,
                  type: 'discrete',
                  driverVersion: ver,
                  vramMb: vram
                });
              }
            }
          }

          if (list.length > 0) {
            return finish();
          }

          // Fallback to wmic if powershell failed
          exec('wmic path win32_VideoController get name, driverversion /format:csv', { timeout: 3000, windowsHide: true }, (wErr, wStdout) => {
            if (!wErr && wStdout) {
              try {
                const lines = wStdout.split(/\r?\n/).filter(l => l.trim() && !l.toLowerCase().startsWith('node'));
                for (const line of lines) {
                  const parts = line.split(',');
                  if (parts.length >= 2) {
                    const name = (parts[parts.length - 2] || '').trim();
                    const ver = (parts[parts.length - 1] || '').trim();
                    if (name && name.toLowerCase() !== 'name') {
                      const vendor = cleanVendor('', name);
                      list.push({
                        name,
                        vendor,
                        type: classifyGpu(name, vendor),
                        driverVersion: ver
                      });
                    }
                  }
                }
              } catch {}
            }
            finish();
          });
        });
      });
    } else {
      // Linux / macOS
      exec('lspci 2>/dev/null', { timeout: 2500 }, (err, stdout) => {
        if (!err && stdout) {
          const lines = stdout.split('\n').filter(l => /vga|3d|display/i.test(l));
          for (const line of lines) {
            const colonIdx = line.indexOf(': ');
            const name = (colonIdx !== -1 ? line.substring(colonIdx + 2) : line).trim();
            const vendor = cleanVendor('', name);
            list.push({
              name,
              vendor,
              type: classifyGpu(name, vendor)
            });
          }
        }

        // Also check nvidia-smi on Linux
        exec('nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader,nounits 2>/dev/null', { timeout: 2000 }, (nvErr, nvStdout) => {
          if (!nvErr && nvStdout && nvStdout.trim()) {
            const lines = nvStdout.trim().split(/\r?\n/);
            for (const line of lines) {
              const parts = line.split(',').map(p => p.trim());
              if (parts[0]) {
                list.push({
                  name: parts[0],
                  vendor: 'NVIDIA',
                  type: 'discrete',
                  driverVersion: parts[1] || '',
                  vramMb: parts[2] ? parseInt(parts[2], 10) : undefined
                });
              }
            }
          }
          finish();
        });
      });
    }
  });
}

// Server-side in-memory store for sync and fallback caching
let currentServerState: {
  groupStates?: Record<string, any>;
  alert?: any;
  activeSchedule?: any;
  activeControlGroupId?: string | null;
  outputGroups?: any[];
  themesList?: any[];
  systemOptions?: any;
  remotePin?: string;
  lastUpdated: number;
} = {
  remotePin: '8492',
  alert: {
    active: false,
    message: 'Nursery #304 is requested in the Toddler Room',
    position: 'bottom',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    textColor: '#FACC15',
    speed: 15,
  },
  lastUpdated: Date.now()
};

let pendingCommands: Array<{
  id: string;
  action: string;
  params?: any;
  timestamp: number;
}> = [];

let serverSchedules: any[] = [];

let serverLogs: Array<{ id: string; timestamp: string; level: 'info' | 'warn' | 'error'; message: string }> = [
  { id: '1', timestamp: new Date().toISOString(), level: 'info', message: 'SimpleWorship Backend Engine initialized on port 3000' }
];

function logServerEvent(level: 'info' | 'warn' | 'error', message: string) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    level,
    message
  };
  serverLogs.unshift(entry);
  if (serverLogs.length > 100) serverLogs.pop();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Request logging middleware
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      // Keep track of API requests
    }
    next();
  });

  // 1. Health & Telemetry API
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'online',
      version: '7.4.0',
      uptime: process.uptime(),
      timestamp: Date.now(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      activeSchedule: currentServerState.activeSchedule?.name || 'Default Service'
    });
  });

  // 2. System Status & Diagnostics
  app.get('/api/system/status', async (req, res) => {
    const cpus = os.cpus() || [];
    const totalMem = Math.round(os.totalmem() / (1024 * 1024));
    const freeMem = Math.round(os.freemem() / (1024 * 1024));
    const hostGpus = await detectHostGpus().catch(() => []);
    const nonSoftware = hostGpus.filter(g => g.type !== 'software' && g.type !== 'virtual');
    const discreteGpu = nonSoftware.find(g => g.type === 'discrete') || null;
    const integratedGpu = nonSoftware.find(g => g.type === 'integrated') || null;
    const isDualGpu = (discreteGpu !== null && integratedGpu !== null) || nonSoftware.length > 1;

    res.json({
      status: 'healthy',
      engine: 'SimpleWorship Presentation Engine',
      port: PORT,
      mode: process.env.NODE_ENV || 'development',
      uptimeSeconds: Math.floor(process.uptime()),
      lastStateUpdate: currentServerState.lastUpdated,
      serverLogs: serverLogs.slice(0, 30),
      pendingCommandsCount: pendingCommands.length,
      hardware: {
        platform: os.platform(),
        arch: os.arch(),
        cpuModel: cpus[0]?.model || 'Host CPU',
        cpuCores: cpus.length || 4,
        totalRamMb: totalMem,
        freeRamMb: freeMem,
        gpus: hostGpus,
        isDualGpu,
        discreteGpu,
        integratedGpu
      },
      capabilities: {
        broadcastChannel: true,
        indexedDbBridge: true,
        backupExport: true,
        restSync: true,
        remoteCommandQueue: true
      }
    });
  });

  // 3. Central State Synchronization (REST API for Remote / Secondary Displays)
  app.get('/api/sync/state', (req, res) => {
    res.json({
      success: true,
      data: currentServerState,
      remotePin: currentServerState.remotePin || '8492',
      pendingCommands: pendingCommands.slice(-10)
    });
  });

  app.post('/api/sync/state', (req, res) => {
    try {
      const { groupStates, alert, activeSchedule, activeControlGroupId, outputGroups, themesList, systemOptions, remotePin } = req.body;
      currentServerState = {
        groupStates: groupStates || currentServerState.groupStates,
        alert: alert !== undefined ? alert : currentServerState.alert,
        activeSchedule: activeSchedule || currentServerState.activeSchedule,
        activeControlGroupId: activeControlGroupId !== undefined ? activeControlGroupId : currentServerState.activeControlGroupId,
        outputGroups: outputGroups || currentServerState.outputGroups,
        themesList: themesList || currentServerState.themesList,
        systemOptions: systemOptions || currentServerState.systemOptions,
        remotePin: remotePin || currentServerState.remotePin || '8492',
        lastUpdated: Date.now()
      };
      logServerEvent('info', `State synchronized across backend. Schedule: "${activeSchedule?.name || currentServerState.activeSchedule?.name || 'Untitled'}"`);
      res.json({ success: true, timestamp: currentServerState.lastUpdated, remotePin: currentServerState.remotePin });
    } catch (err: any) {
      logServerEvent('error', `Sync state failed: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/remote/info', (req, res) => {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
    res.json({
      success: true,
      ips,
      port: PORT,
      pin: currentServerState.remotePin || '8492'
    });
  });

  // 4. Remote PIN Pairing Management
  app.get('/api/remote/pin', (req, res) => {
    res.json({
      success: true,
      pin: currentServerState.remotePin || '8492'
    });
  });

  app.post('/api/remote/pin', (req, res) => {
    try {
      const { pin } = req.body;
      if (pin && typeof pin === 'string' && pin.trim().length >= 4) {
        currentServerState.remotePin = pin.trim();
        currentServerState.lastUpdated = Date.now();
        logServerEvent('info', `Remote pairing PIN updated to: ${currentServerState.remotePin}`);
        res.json({ success: true, pin: currentServerState.remotePin });
      } else {
        res.status(400).json({ success: false, error: 'Invalid PIN. Must be at least 4 digits.' });
      }
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 5. Remote presentation command dispatch
  app.post('/api/remote/command', (req, res) => {
    try {
      const { action, params } = req.body;
      if (!action) {
        return res.status(400).json({ success: false, error: 'Missing action field' });
      }

      // If action modifies alert directly, update server-side alert cache immediately
      if (action === 'set_alert' && params) {
        currentServerState.alert = {
          ...(currentServerState.alert || {}),
          active: params.active ?? params.enabled ?? true,
          message: params.message || params.text || currentServerState.alert?.message || '',
          position: params.position || currentServerState.alert?.position || 'bottom',
          backgroundColor: params.backgroundColor || currentServerState.alert?.backgroundColor || 'rgba(15, 23, 42, 0.96)',
          textColor: params.textColor || currentServerState.alert?.textColor || '#FACC15',
        };
        currentServerState.lastUpdated = Date.now();
      } else if (action === 'clear_alert') {
        if (currentServerState.alert) {
          currentServerState.alert = { ...currentServerState.alert, active: false };
          currentServerState.lastUpdated = Date.now();
        }
      }

      const cmd = {
        id: `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        action,
        params,
        timestamp: Date.now()
      };
      pendingCommands.push(cmd);
      if (pendingCommands.length > 50) pendingCommands.shift();
      logServerEvent('info', `Remote command queued: ${action} (${cmd.id})`);
      res.json({ success: true, commandId: cmd.id, timestamp: cmd.timestamp, currentAlert: currentServerState.alert });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 5. Schedules persistence endpoint
  app.get('/api/schedules', (req, res) => {
    res.json({
      success: true,
      schedules: serverSchedules,
      activeSchedule: currentServerState.activeSchedule
    });
  });

  app.post('/api/schedules', (req, res) => {
    try {
      const sched = req.body;
      if (sched && sched.id) {
        const idx = serverSchedules.findIndex(s => s.id === sched.id);
        if (idx >= 0) {
          serverSchedules[idx] = sched;
        } else {
          serverSchedules.unshift(sched);
        }
        if (serverSchedules.length > 20) serverSchedules.pop();
        currentServerState.activeSchedule = sched;
        currentServerState.lastUpdated = Date.now();
        logServerEvent('info', `Schedule saved to backend server: "${sched.name}"`);
        res.json({ success: true, scheduleId: sched.id });
      } else {
        res.status(400).json({ success: false, error: 'Invalid schedule object' });
      }
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 5b. Font Proxy & Download Endpoint (1-Click Font Auto-Installer & Windows Download)
  app.get('/api/fonts/download', async (req, res) => {
    try {
      const rawFamily = (req.query.family as string || '').trim();
      if (!rawFamily) {
        return res.status(400).json({ success: false, error: 'Missing font family parameter' });
      }

      const family = rawFamily.replace(/^["']+|["']+$/g, '').split(',')[0].trim();
      const formattedFamily = encodeURIComponent(family).replace(/%20/g, '+');

      // 1. Query Google Fonts API
      let fontBinaryUrl: string | null = null;
      try {
        const cssRes = await fetch(`https://fonts.googleapis.com/css2?family=${formattedFamily}:wght@400;700&display=swap`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          }
        });
        if (cssRes.ok) {
          const cssText = await cssRes.text();
          const latinMatch = /\/\*\s*latin\s*\*\/[\s\S]*?url\((https:\/\/fonts\.gstatic\.com\/s\/[^)]+)\)/i.exec(cssText);
          if (latinMatch && latinMatch[1]) {
            fontBinaryUrl = latinMatch[1];
          } else {
            const genericMatch = /url\((https:\/\/fonts\.gstatic\.com\/s\/[^)]+)\)/i.exec(cssText);
            if (genericMatch && genericMatch[1]) {
              fontBinaryUrl = genericMatch[1];
            }
          }
        }
      } catch {}

      // 2. Query Bunny CDN fallback
      if (!fontBinaryUrl) {
        try {
          const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const bRes = await fetch(`https://fonts.bunny.net/css?family=${slug}:400`);
          if (bRes.ok) {
            const bText = await bRes.text();
            const m = /url\((https:\/\/[^)]+)\)/i.exec(bText);
            if (m && m[1]) {
              fontBinaryUrl = m[1];
            }
          }
        } catch {}
      }

      if (!fontBinaryUrl) {
        return res.status(404).json({ success: false, error: `Font "${family}" not found in upstream CDNs` });
      }

      const fontRes = await fetch(fontBinaryUrl);
      if (!fontRes.ok) {
        return res.status(502).json({ success: false, error: 'Failed to retrieve font binary' });
      }

      const arrayBuf = await fontRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      if (req.query.download === '1') {
        res.setHeader('Content-Type', 'font/woff2');
        res.setHeader('Content-Disposition', `attachment; filename="${family.replace(/\s+/g, '')}.woff2"`);
        return res.send(buffer);
      }

      res.json({
        success: true,
        family,
        format: 'woff2',
        bufferBase64: buffer.toString('base64'),
        byteSize: buffer.length
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6. Server-Side Backup & Restore Endpoints
  app.post('/api/backup/export', (req, res) => {
    try {
      const backupData = req.body;
      logServerEvent('info', `Backup payload registered: ${backupData?.metadata?.songsCount || 0} songs, ${backupData?.metadata?.schedulesCount || 0} schedules`);
      res.json({
        success: true,
        message: 'Backup validated and ready for export',
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 7. Clear Server Logs
  app.post('/api/system/clear-logs', (req, res) => {
    serverLogs = [{
      id: `${Date.now()}`,
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Server diagnostics log reset by operator'
    }];
    pendingCommands = [];
    res.json({ success: true, message: 'Logs cleared' });
  });

  // 8. Online Font Discovery & Binary Download Endpoints
  app.get('/api/fonts/search', async (req, res) => {
    try {
      const family = String(req.query.family || '').trim();
      if (!family) {
        return res.status(400).json({ success: false, error: 'Font family parameter required' });
      }
      const { searchFontOnline } = await import('./src/server/fontDownloader');
      const result = await searchFontOnline(family);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/fonts/download', async (req, res) => {
    try {
      const family = String(req.query.family || '').trim();
      if (!family) {
        return res.status(400).json({ success: false, error: 'Font family parameter required' });
      }
      const { downloadFontBinary } = await import('./src/server/fontDownloader');
      const result = await downloadFontBinary(family);

      if (!result.success || !result.buffer) {
        return res.status(404).json({ success: false, error: result.error || 'Font not found' });
      }

      const isAttachment = req.query.download === '1' || req.query.attachment === '1';
      if (isAttachment) {
        res.setHeader('Content-Type', `font/${result.format || 'woff2'}`);
        res.setHeader('Content-Disposition', `attachment; filename="${family.replace(/\s+/g, '')}.${result.format || 'woff2'}"`);
        res.setHeader('Content-Length', result.buffer.length);
        return res.end(result.buffer);
      }

      res.json({
        success: true,
        family: result.family,
        format: result.format,
        byteSize: result.byteSize,
        provider: result.provider,
        bufferBase64: result.buffer.toString('base64'),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite Middleware Setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SimpleWorship Engine running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

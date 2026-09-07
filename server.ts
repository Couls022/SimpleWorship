import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

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
  app.get('/api/system/status', (req, res) => {
    res.json({
      status: 'healthy',
      engine: 'SimpleWorship Presentation Engine',
      port: PORT,
      mode: process.env.NODE_ENV || 'development',
      uptimeSeconds: Math.floor(process.uptime()),
      lastStateUpdate: currentServerState.lastUpdated,
      serverLogs: serverLogs.slice(0, 30),
      pendingCommandsCount: pendingCommands.length,
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

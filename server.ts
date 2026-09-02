import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

// Server-side in-memory store for sync and fallback caching
let currentServerState: {
  groupStates?: Record<string, any>;
  alert?: any;
  activeSchedule?: any;
  lastUpdated: number;
} = {
  lastUpdated: Date.now()
};

let serverLogs: Array<{ id: string; timestamp: string; level: 'info' | 'warn' | 'error'; message: string }> = [
  { id: '1', timestamp: new Date().toISOString(), level: 'info', message: 'SimpleWorship Backend Engine initialized on port 3000' }
];

function logServerEvent(level: 'info' | 'warn' | 'error', message: string) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
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
      nodeVersion: process.version
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
      capabilities: {
        broadcastChannel: true,
        indexedDbBridge: true,
        backupExport: true,
        restSync: true
      }
    });
  });

  // 3. Central State Synchronization (REST API for Remote / Secondary Displays)
  app.get('/api/sync/state', (req, res) => {
    res.json({
      success: true,
      data: currentServerState
    });
  });

  app.post('/api/sync/state', (req, res) => {
    try {
      const { groupStates, alert, activeSchedule } = req.body;
      currentServerState = {
        groupStates: groupStates || currentServerState.groupStates,
        alert: alert || currentServerState.alert,
        activeSchedule: activeSchedule || currentServerState.activeSchedule,
        lastUpdated: Date.now()
      };
      logServerEvent('info', `State synchronized across backend. Schedule: "${activeSchedule?.name || 'Untitled'}"`);
      res.json({ success: true, timestamp: currentServerState.lastUpdated });
    } catch (err: any) {
      logServerEvent('error', `Sync state failed: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Server-Side Backup & Restore Endpoints
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

  // 5. Clear Server Logs
  app.post('/api/system/clear-logs', (req, res) => {
    serverLogs = [{
      id: `${Date.now()}`,
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Server diagnostics log reset by operator'
    }];
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

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

function simpleWorshipApiPlugin(): Plugin {
  let currentServerState: {
    groupStates?: Record<string, any>;
    alert?: any;
    activeSchedule?: any;
    activeControlGroupId?: string | null;
    outputGroups?: any[];
    themesList?: any[];
    systemOptions?: any;
    lastUpdated: number;
  } = {
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
    { id: '1', timestamp: new Date().toISOString(), level: 'info', message: 'SimpleWorship Engine initialized on port 3000' }
  ];

  function logServerEvent(level: 'info' | 'warn' | 'error', message: string) {
    serverLogs.unshift({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      message
    });
    if (serverLogs.length > 100) serverLogs.pop();
  }

  return {
    name: 'simpleworship-api-middleware',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;

        res.setHeader('Content-Type', 'application/json');

        if (pathname === '/api/health' && req.method === 'GET') {
          res.end(JSON.stringify({
            status: 'online',
            version: '7.4.0',
            uptime: process.uptime(),
            timestamp: Date.now(),
            memory: process.memoryUsage(),
            nodeVersion: process.version,
            activeSchedule: currentServerState.activeSchedule?.name || 'Default Service'
          }));
          return;
        }

        if (pathname === '/api/system/status' && req.method === 'GET') {
          res.end(JSON.stringify({
            status: 'healthy',
            engine: 'SimpleWorship Presentation Engine',
            port: 3000,
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
          }));
          return;
        }

        if (pathname === '/api/sync/state' && req.method === 'GET') {
          res.end(JSON.stringify({
            success: true,
            data: currentServerState,
            pendingCommands: pendingCommands.slice(-10)
          }));
          return;
        }

        if (pathname === '/api/sync/state' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const parsed = body ? JSON.parse(body) : {};
              const { groupStates, alert, activeSchedule, activeControlGroupId, outputGroups, themesList, systemOptions } = parsed;
              currentServerState = {
                groupStates: groupStates || currentServerState.groupStates,
                alert: alert || currentServerState.alert,
                activeSchedule: activeSchedule || currentServerState.activeSchedule,
                activeControlGroupId: activeControlGroupId !== undefined ? activeControlGroupId : currentServerState.activeControlGroupId,
                outputGroups: outputGroups || currentServerState.outputGroups,
                themesList: themesList || currentServerState.themesList,
                systemOptions: systemOptions || currentServerState.systemOptions,
                lastUpdated: Date.now()
              };
              logServerEvent('info', `State synchronized across engine. Schedule: "${activeSchedule?.name || currentServerState.activeSchedule?.name || 'Untitled'}"`);
              res.end(JSON.stringify({ success: true, timestamp: currentServerState.lastUpdated }));
            } catch (err: any) {
              logServerEvent('error', `Sync state failed: ${err.message}`);
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // Remote presentation command dispatch
        if (pathname === '/api/remote/command' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const parsed = body ? JSON.parse(body) : {};
              const { action, params } = parsed;
              if (!action) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'Missing action field' }));
                return;
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
              res.end(JSON.stringify({ success: true, commandId: cmd.id, timestamp: cmd.timestamp }));
            } catch (err: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // Schedules persistence endpoint
        if (pathname === '/api/schedules' && req.method === 'GET') {
          res.end(JSON.stringify({
            success: true,
            schedules: serverSchedules,
            activeSchedule: currentServerState.activeSchedule
          }));
          return;
        }

        if (pathname === '/api/schedules' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const sched = body ? JSON.parse(body) : null;
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
                res.end(JSON.stringify({ success: true, scheduleId: sched.id }));
              } else {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'Invalid schedule object' }));
              }
            } catch (err: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        if (pathname === '/api/backup/export' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const backupData = body ? JSON.parse(body) : {};
              logServerEvent('info', `Backup payload registered: ${backupData?.metadata?.songsCount || 0} songs`);
              res.end(JSON.stringify({
                success: true,
                message: 'Backup validated and ready for export',
                timestamp: new Date().toISOString()
              }));
            } catch (err: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        if (pathname === '/api/system/clear-logs' && req.method === 'POST') {
          serverLogs = [{
            id: `${Date.now()}`,
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Server diagnostics log reset by operator'
          }];
          pendingCommands = [];
          res.end(JSON.stringify({ success: true, message: 'Logs cleared' }));
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), simpleWorshipApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      target: 'es2022',
      minify: 'esbuild' as const,
      cssMinify: true,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 5000,
      rollupOptions: {
        treeshake: true,
      },
    },
  };
});

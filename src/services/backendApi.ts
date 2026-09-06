/**
 * SimpleWorship Backend API & Telemetry Service
 * Fully connects Frontend UI/UX with the Server Backend Engine
 */

export interface BackendHealth {
  status: 'online' | 'offline';
  version: string;
  uptime: number;
  timestamp: number;
  memory?: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  nodeVersion?: string;
  latency?: number;
}

export interface BackendSystemStatus {
  status: string;
  engine: string;
  port: number;
  mode: string;
  uptimeSeconds: number;
  lastStateUpdate: number;
  serverLogs: Array<{ id: string; timestamp: string; level: 'info' | 'warn' | 'error'; message: string }>;
  capabilities: {
    broadcastChannel: boolean;
    indexedDbBridge: boolean;
    backupExport: boolean;
    restSync: boolean;
    remoteCommandQueue: boolean;
  };
  connectedClients?: number;
}

export interface RemoteCommand {
  id: string;
  action: 'next_slide' | 'prev_slide' | 'next_item' | 'prev_item' | 'toggle_black' | 'toggle_clear' | 'toggle_logo' | 'go_live' | 'set_alert' | 'clear_alert';
  params?: any;
  timestamp: number;
}

class BackendApiService {
  private lastPingTime = 0;
  private currentLatency = 0;
  private isOnline = true;
  private isSyncing = false;
  private listeners = new Set<(status: { isOnline: boolean; latency: number; isSyncing: boolean }) => void>();
  private pingInterval: any = null;

  constructor() {
    this.startHeartbeat();
  }

  public subscribe(fn: (status: { isOnline: boolean; latency: number; isSyncing: boolean }) => void) {
    this.listeners.add(fn);
    fn({ isOnline: this.isOnline, latency: this.currentLatency, isSyncing: this.isSyncing });
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener({ isOnline: this.isOnline, latency: this.currentLatency, isSyncing: this.isSyncing });
      } catch (e) {
        console.error('[BackendApi] Listener error:', e);
      }
    }
  }

  public startHeartbeat(intervalMs: number = 4000) {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.checkHealth();
    this.pingInterval = setInterval(() => {
      this.checkHealth();
    }, intervalMs);
  }

  public async checkHealth(): Promise<BackendHealth | null> {
    const start = performance.now();
    try {
      const res = await fetch('/api/health', {
        headers: { Accept: 'application/json' },
        cache: 'no-cache'
      });
      const end = performance.now();
      if (res.ok) {
        const data = await res.json();
        this.currentLatency = Math.round(end - start);
        this.isOnline = true;
        this.lastPingTime = Date.now();
        this.notify();
        return {
          ...data,
          latency: this.currentLatency
        };
      } else {
        this.isOnline = false;
        this.notify();
        return null;
      }
    } catch (err) {
      this.isOnline = false;
      this.currentLatency = 0;
      this.notify();
      return null;
    }
  }

  public async getSystemStatus(): Promise<BackendSystemStatus | null> {
    try {
      const res = await fetch('/api/system/status', {
        headers: { Accept: 'application/json' },
        cache: 'no-cache'
      });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  public async fetchState(): Promise<{ success: boolean; data?: any; pendingCommands?: RemoteCommand[] } | null> {
    try {
      const res = await fetch('/api/sync/state', {
        headers: { Accept: 'application/json' },
        cache: 'no-cache'
      });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  public async pushState(payload: any): Promise<boolean> {
    this.isSyncing = true;
    this.notify();
    try {
      const res = await fetch('/api/sync/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ok = res.ok;
      this.isOnline = ok;
      return ok;
    } catch (err) {
      this.isOnline = false;
      return false;
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  public async dispatchRemoteCommand(
    action: RemoteCommand['action'], 
    params?: any
  ): Promise<{ success: boolean; commandId?: string; error?: string }> {
    try {
      const res = await fetch('/api/remote/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params })
      });
      if (res.ok) {
        return await res.json();
      }
      return { success: false, error: `HTTP ${res.status}` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async clearServerLogs(): Promise<boolean> {
    try {
      const res = await fetch('/api/system/clear-logs', { method: 'POST' });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async saveSchedule(schedule: any): Promise<boolean> {
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async getSchedules(): Promise<any[]> {
    try {
      const res = await fetch('/api/schedules', {
        headers: { Accept: 'application/json' }
      });
      if (res.ok) {
        const json = await res.json();
        return json.schedules || [];
      }
      return [];
    } catch {
      return [];
    }
  }

  public getStatus() {
    return {
      isOnline: this.isOnline,
      latency: this.currentLatency,
      isSyncing: this.isSyncing,
      lastPingTime: this.lastPingTime
    };
  }
}

export const backendApi = new BackendApiService();

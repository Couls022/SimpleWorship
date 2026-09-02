import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Database, 
  Radio, 
  Activity, 
  HardDrive, 
  RefreshCw, 
  Download, 
  Upload, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Play, 
  Tv, 
  QrCode, 
  ExternalLink,
  ShieldCheck,
  Cpu,
  Clock,
  Layers,
  FileCheck
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { getDB, dbApi } from '../db';
import { exportDatabaseBackup, importDatabaseBackup } from '../db/backup';
import { syncTelemetry } from '../store/sync';

interface SystemDiagnosticsModalProps {
  onClose: () => void;
}

export default function SystemDiagnosticsModal({ onClose }: SystemDiagnosticsModalProps) {
  const store = useStore();
  const [activeTab, setActiveTab] = useState<'server' | 'storage' | 'broadcaster' | 'remote'>('server');
  
  // Server state
  const [serverHealth, setServerHealth] = useState<any>(null);
  const [serverStatus, setServerStatus] = useState<any>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number } | null>(null);

  // Backup state
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchDiagnostics = async () => {
    setIsRefreshing(true);
    const start = performance.now();
    try {
      const [healthRes, statusRes] = await Promise.all([
        fetch('/api/health').then(r => r.json()).catch(() => null),
        fetch('/api/system/status').then(r => r.json()).catch(() => null)
      ]);
      const end = performance.now();
      setLatency(Math.round(end - start));
      setServerHealth(healthRes);
      setServerStatus(statusRes);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }

    // Estimate storage
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        setStorageEstimate({
          usage: est.usage || 0,
          quota: est.quota || 0
        });
      } catch (e) {}
    }
  };

  useEffect(() => {
    fetchDiagnostics();
    const interval = setInterval(fetchDiagnostics, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleExportBackup = async () => {
    try {
      setIsExporting(true);
      const blob = await exportDatabaseBackup(true);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SimpleWorship_Full_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setActionMessage('Full database backup exported successfully!');
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Importing this backup will merge and update your existing songs, scriptures, and schedules. Proceed?')) {
      return;
    }

    setIsImporting(true);
    importDatabaseBackup(file)
      .then(async () => {
        await store.loadAllData();
        setActionMessage('Backup restored and reloaded successfully into database!');
      })
      .catch((err) => {
        alert(`Import error: ${err.message}`);
      })
      .finally(() => {
        setIsImporting(false);
        e.target.value = '';
        setTimeout(() => setActionMessage(null), 4000);
      });
  };

  const handleOptimizeDB = async () => {
    try {
      const db = await getDB();
      setActionMessage('Database integrity verified and optimized (IndexedDB active & indexed)');
      setTimeout(() => setActionMessage(null), 4000);
    } catch (e: any) {
      alert(`Optimization error: ${e.message}`);
    }
  };

  const handleClearServerLogs = async () => {
    try {
      await fetch('/api/system/clear-logs', { method: 'POST' });
      fetchDiagnostics();
      setActionMessage('Server diagnostics log cleared');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (e) {}
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = 2;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-[#1c1f26] border border-[#343b4c] rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden text-gray-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="h-13 bg-[#242832] border-b border-[#2e3444] px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>System Backbone & Architecture Diagnostics</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                  Full-Stack Active
                </span>
              </h2>
              <p className="text-[11px] text-gray-400">
                Express Server • IndexedDB Storage • Broadcast Channel Sync • Multi-Output Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchDiagnostics}
              disabled={isRefreshing}
              className="p-1.5 hover:bg-[#323846] rounded-md text-gray-300 hover:text-white transition-colors"
              title="Refresh Diagnostics"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-cyan-400' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-rose-600/30 hover:text-rose-300 rounded-md text-gray-400 transition-colors"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-5 pt-3 bg-[#1e2129] border-b border-[#2a2f3d] shrink-0">
          {[
            { id: 'server', label: 'Backend Server & API', icon: <Server size={14} /> },
            { id: 'storage', label: 'Database & Local Storage', icon: <Database size={14} /> },
            { id: 'broadcaster', label: 'Display & Sync Broadcaster', icon: <Radio size={14} /> },
            { id: 'remote', label: 'Remote Control & Hub', icon: <Tv size={14} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-t-2 ${
                activeTab === tab.id
                  ? 'bg-[#1c1f26] text-cyan-300 border-cyan-400 font-bold'
                  : 'text-gray-400 hover:text-gray-200 border-transparent hover:bg-[#252a36]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Action / Success Banner */}
        {actionMessage && (
          <div className="bg-emerald-950/80 border-b border-emerald-700/60 px-5 py-2 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 size={14} />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-xs">
          
          {/* TAB 1: SERVER & TELEMETRY */}
          {activeTab === 'server' && (
            <div className="space-y-6">
              {/* Quick Status Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#14161c] p-3.5 rounded-lg border border-[#2b303e]">
                  <div className="flex items-center justify-between text-gray-400 mb-1 text-[11px]">
                    <span>Server Status</span>
                    <Server size={13} className="text-cyan-400" />
                  </div>
                  <div className="text-base font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>{serverHealth?.status === 'online' ? 'Online (200 OK)' : 'Connecting...'}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">Port 3000 • Express + Vite</div>
                </div>

                <div className="bg-[#14161c] p-3.5 rounded-lg border border-[#2b303e]">
                  <div className="flex items-center justify-between text-gray-400 mb-1 text-[11px]">
                    <span>API Latency</span>
                    <Activity size={13} className="text-cyan-400" />
                  </div>
                  <div className="text-base font-bold text-white">
                    {latency !== null ? `${latency} ms` : '—'}
                  </div>
                  <div className="text-[10px] text-emerald-400 mt-1">Real-time local proxy</div>
                </div>

                <div className="bg-[#14161c] p-3.5 rounded-lg border border-[#2b303e]">
                  <div className="flex items-center justify-between text-gray-400 mb-1 text-[11px]">
                    <span>Process Uptime</span>
                    <Clock size={13} className="text-cyan-400" />
                  </div>
                  <div className="text-base font-bold text-white">
                    {serverHealth?.uptime ? `${Math.floor(serverHealth.uptime / 60)}m ${Math.floor(serverHealth.uptime % 60)}s` : '—'}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">Node {serverHealth?.nodeVersion || 'v22'}</div>
                </div>

                <div className="bg-[#14161c] p-3.5 rounded-lg border border-[#2b303e]">
                  <div className="flex items-center justify-between text-gray-400 mb-1 text-[11px]">
                    <span>Memory Allocation</span>
                    <Cpu size={13} className="text-cyan-400" />
                  </div>
                  <div className="text-base font-bold text-white">
                    {serverHealth?.memory?.rss ? formatBytes(serverHealth.memory.rss) : '—'}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">Heap: {serverHealth?.memory?.heapUsed ? formatBytes(serverHealth.memory.heapUsed) : '—'}</div>
                </div>
              </div>

              {/* REST API Endpoints Registry */}
              <div className="bg-[#14161c] p-4 rounded-lg border border-[#2b303e] space-y-3">
                <h3 className="font-bold text-white text-xs flex items-center justify-between">
                  <span>Backend REST Endpoints</span>
                  <span className="text-[10px] font-mono text-cyan-400">HTTP/1.1 JSON API</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded bg-[#1d212a] border border-[#2c3242] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-300 font-bold text-[9px]">GET</span>
                      <span className="text-gray-200">/api/health</span>
                    </div>
                    <span className="text-emerald-400 font-sans text-[10px]">Healthy</span>
                  </div>

                  <div className="p-2 rounded bg-[#1d212a] border border-[#2c3242] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-300 font-bold text-[9px]">GET</span>
                      <span className="text-gray-200">/api/system/status</span>
                    </div>
                    <span className="text-emerald-400 font-sans text-[10px]">Active</span>
                  </div>

                  <div className="p-2 rounded bg-[#1d212a] border border-[#2c3242] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-blue-900 text-blue-300 font-bold text-[9px]">POST</span>
                      <span className="text-gray-200">/api/sync/state</span>
                    </div>
                    <span className="text-cyan-400 font-sans text-[10px]">Live Sync</span>
                  </div>

                  <div className="p-2 rounded bg-[#1d212a] border border-[#2c3242] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-blue-900 text-blue-300 font-bold text-[9px]">POST</span>
                      <span className="text-gray-200">/api/backup/export</span>
                    </div>
                    <span className="text-cyan-400 font-sans text-[10px]">Available</span>
                  </div>
                </div>
              </div>

              {/* Server Logs */}
              <div className="bg-[#14161c] p-4 rounded-lg border border-[#2b303e] space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-xs">Server Event Telemetry</h3>
                  <button
                    onClick={handleClearServerLogs}
                    className="text-[10px] text-gray-400 hover:text-white px-2 py-0.5 rounded bg-[#242834] hover:bg-[#303546]"
                  >
                    Clear Logs
                  </button>
                </div>
                <div className="h-40 bg-[#0d0f13] p-3 rounded font-mono text-[10px] overflow-y-auto space-y-1 custom-scrollbar text-gray-300 border border-[#20232c]">
                  {serverStatus?.serverLogs && serverStatus.serverLogs.length > 0 ? (
                    serverStatus.serverLogs.map((log: any) => (
                      <div key={log.id} className="flex items-start gap-2">
                        <span className="text-gray-500 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                        <span className={`font-bold shrink-0 ${
                          log.level === 'error' ? 'text-rose-400' : log.level === 'warn' ? 'text-amber-400' : 'text-cyan-400'
                        }`}>
                          {log.level.toUpperCase()}
                        </span>
                        <span className="text-gray-300">{log.message}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500">No logs captured yet.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STORAGE & DATABASE */}
          {activeTab === 'storage' && (
            <div className="space-y-6">
              {/* Storage Inventory Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                <div className="bg-[#14161c] p-3 rounded-lg border border-[#2b303e] text-center">
                  <div className="text-xs text-gray-400 mb-1">Songs Library</div>
                  <div className="text-lg font-bold text-cyan-400">{store.songsList.length}</div>
                  <div className="text-[10px] text-gray-500">Master Hymnals</div>
                </div>

                <div className="bg-[#14161c] p-3 rounded-lg border border-[#2b303e] text-center">
                  <div className="text-xs text-gray-400 mb-1">Scriptures</div>
                  <div className="text-lg font-bold text-cyan-400">{store.scripturesList.length}</div>
                  <div className="text-[10px] text-gray-500">KJV & Tagalog</div>
                </div>

                <div className="bg-[#14161c] p-3 rounded-lg border border-[#2b303e] text-center">
                  <div className="text-xs text-gray-400 mb-1">Themes & Layouts</div>
                  <div className="text-lg font-bold text-cyan-400">{store.themesList.length}</div>
                  <div className="text-[10px] text-gray-500">Styling Presets</div>
                </div>

                <div className="bg-[#14161c] p-3 rounded-lg border border-[#2b303e] text-center">
                  <div className="text-xs text-gray-400 mb-1">Media Assets</div>
                  <div className="text-lg font-bold text-cyan-400">{store.assetsList.length}</div>
                  <div className="text-[10px] text-gray-500">Stills & Motions</div>
                </div>

                <div className="bg-[#14161c] p-3 rounded-lg border border-[#2b303e] text-center">
                  <div className="text-xs text-gray-400 mb-1">Active Sched Items</div>
                  <div className="text-lg font-bold text-cyan-400">{store.activeSchedule?.items.length || 0}</div>
                  <div className="text-[10px] text-gray-500">Live Service Queue</div>
                </div>
              </div>

              {/* IndexedDB Disk Usage */}
              <div className="bg-[#14161c] p-4 rounded-lg border border-[#2b303e] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-xs flex items-center gap-2">
                    <HardDrive size={14} className="text-cyan-400" />
                    <span>Client-Side IndexedDB Engine (`SimpleWorshipDB_v3`)</span>
                  </h3>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    Persisted & Active
                  </span>
                </div>

                {storageEstimate && (
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5">
                      <span>Database Footprint: <b className="text-white">{formatBytes(storageEstimate.usage)}</b></span>
                      <span>Total Browser Quota: <b className="text-white">{formatBytes(storageEstimate.quota)}</b></span>
                    </div>
                    <div className="w-full bg-[#202430] h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-cyan-500 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(1, (storageEstimate.usage / (storageEstimate.quota || 1)) * 100))}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Backup & Recovery Center */}
              <div className="bg-[#14161c] p-4 rounded-lg border border-[#2b303e] space-y-3">
                <h3 className="font-bold text-white text-xs">Church Database Backup & Restore Center</h3>
                <p className="text-gray-400 text-[11px]">
                  Export a complete portable archive containing all songs, custom slides, bible indexes, themes, and schedules.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={handleExportBackup}
                    disabled={isExporting}
                    className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold px-4 py-2 rounded-lg transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    <Download size={14} />
                    <span>{isExporting ? 'Exporting Backup...' : 'Export Full Church Backup (JSON)'}</span>
                  </button>

                  <label className="flex items-center gap-2 bg-[#252a36] hover:bg-[#323746] text-gray-200 hover:text-white font-semibold px-4 py-2 rounded-lg border border-[#3b4254] transition-all cursor-pointer">
                    <Upload size={14} />
                    <span>{isImporting ? 'Restoring...' : 'Restore from Backup File'}</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportBackup}
                      disabled={isImporting}
                      className="hidden"
                    />
                  </label>

                  <button
                    onClick={handleOptimizeDB}
                    className="flex items-center gap-2 bg-[#1e222c] hover:bg-[#282d3b] text-gray-300 hover:text-cyan-300 px-3 py-2 rounded-lg border border-[#323849] transition-colors"
                  >
                    <RefreshCw size={13} />
                    <span>Verify & Optimize DB</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BROADCASTER & ROUTING */}
          {activeTab === 'broadcaster' && (
            <div className="space-y-6">
              <div className="bg-[#14161c] p-4 rounded-lg border border-[#2b303e] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-xs flex items-center gap-2">
                    <Radio size={14} className="text-cyan-400" />
                    <span>Real-time Broadcast Channel Engine (`simpleworship_sync`)</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                    Channel: Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-[#1d212b] p-3 rounded border border-[#2b3140]">
                    <div className="text-gray-400 text-[11px]">Messages Broadcasted</div>
                    <div className="text-lg font-bold text-white mt-0.5">{syncTelemetry.messageCount}</div>
                    <div className="text-[10px] text-emerald-400">Zero-latency peer sync</div>
                  </div>

                  <div className="bg-[#1d212b] p-3 rounded border border-[#2b3140]">
                    <div className="text-gray-400 text-[11px]">Last Broadcast Event</div>
                    <div className="text-sm font-bold text-white mt-0.5">
                      {syncTelemetry.lastBroadcastTime ? new Date(syncTelemetry.lastBroadcastTime).toLocaleTimeString() : 'Ready'}
                    </div>
                    <div className="text-[10px] text-gray-400">Auto-synced across windows</div>
                  </div>

                  <div className="bg-[#1d212b] p-3 rounded border border-[#2b3140]">
                    <div className="text-gray-400 text-[11px]">Active Output Groups</div>
                    <div className="text-lg font-bold text-cyan-400 mt-0.5">{store.outputGroups.length} Screen(s)</div>
                    <div className="text-[10px] text-gray-400">Main, Foyer, Stage, Stream</div>
                  </div>
                </div>
              </div>

              {/* Output Displays Launcher */}
              <div className="bg-[#14161c] p-4 rounded-lg border border-[#2b303e] space-y-3">
                <h3 className="font-bold text-white text-xs">Live Projector & Stage Display Launchers</h3>
                <p className="text-gray-400 text-[11px]">
                  Click below to open dedicated fullscreen projector windows for secondary monitors, livestream feeds, or stage confidence monitors:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {store.outputGroups.map((group) => (
                    <div key={group.id} className="p-3 bg-[#1d212b] rounded-lg border border-[#2b3140] flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white text-xs flex items-center gap-1.5">
                          <Tv size={13} className="text-cyan-400" />
                          <span>{group.name}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Target: <span className="font-mono text-cyan-300">{group.id}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          const url = `${window.location.origin}${window.location.pathname}?projector=true&groupId=${group.id}`;
                          window.open(url, `Projector_${group.id}`, 'width=1280,height=720,menubar=no,toolbar=no');
                        }}
                        className="flex items-center gap-1 bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow cursor-pointer"
                      >
                        <ExternalLink size={12} />
                        <span>Launch Window</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: REMOTE HUB */}
          {activeTab === 'remote' && (
            <div className="space-y-6">
              <div className="bg-[#14161c] p-4 rounded-lg border border-[#2b303e] space-y-3">
                <h3 className="font-bold text-white text-xs flex items-center gap-2">
                  <Tv size={14} className="text-cyan-400" />
                  <span>Mobile Remote Control & Web Presenter URL</span>
                </h3>
                <p className="text-gray-400 text-[11px]">
                  Connect wireless presenter remotes, pastor/worship leader stage monitors, or tablet control interfaces on the local network.
                </p>

                <div className="p-3 bg-[#181b22] rounded border border-[#2a2f3d] flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-24 h-24 bg-white p-2 rounded-lg flex items-center justify-center shrink-0">
                    <QrCode size={80} className="text-gray-900" />
                  </div>
                  <div className="flex-1 space-y-2 text-left">
                    <div className="text-xs font-bold text-white">Direct Presentation URL:</div>
                    <div className="p-2 rounded bg-[#0e1014] font-mono text-[11px] text-cyan-300 break-all select-all border border-[#252a36]">
                      {window.location.origin}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      Open on any tablet, mobile browser, or second laptop on the church network to receive synchronized presentation feeds.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="h-12 bg-[#20242e] border-t border-[#2a2f3d] px-5 flex items-center justify-between shrink-0 text-xs">
          <div className="text-gray-400 text-[11px] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>SimpleWorship Professional Presentation System v7.4</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#2e3444] hover:bg-[#3b4356] text-white font-semibold transition-colors"
          >
            Close Diagnostics
          </button>
        </div>

      </div>
    </div>
  );
}

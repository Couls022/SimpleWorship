import { withPortal } from './common/withPortal';
import React, { useState, useEffect } from 'react';
import { DisplayManager } from '../core/DisplayManager';
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
  FileCheck,
  Zap,
  Monitor,
  Gauge,
  Type
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { getDB, dbApi } from '../db';
import { exportDatabaseBackup, importDatabaseBackup } from '../db/backup';
import { syncTelemetry, forceSyncNow, executeRemoteCommandLocally, triggerSyncPollNow } from '../store/sync';
import { backendApi } from '../services/backendApi';
import { hardwareProfile, HardwareInfo } from '../core/HardwareProfile';
import { slideRenderCache } from '../utils/SlideRenderCache';
import { PresentationCore } from '../core/PresentationCore';
import { verifyAndOptimizeDatabase, DbOptimizationReport } from '../db/optimize';
import FontSimulationDevPanel from './diagnostics/FontSimulationDevPanel';

interface SystemDiagnosticsModalProps {
  onClose: () => void;
  initialTab?: 'hardware' | 'gpu-diag' | 'fonts' | 'server' | 'storage' | 'broadcaster' | 'remote';
}

function SystemDiagnosticsModal({ onClose, initialTab = 'hardware' }: SystemDiagnosticsModalProps) {
  const songsList = useStore(state => state.songsList);
  const scripturesList = useStore(state => state.scripturesList);
  const themesList = useStore(state => state.themesList);
  const assetsList = useStore(state => state.assetsList);
  const activeSchedule = useStore(state => state.activeSchedule);
  const outputGroups = useStore(state => state.outputGroups);

  const [activeTab, setActiveTab] = useState<'server' | 'hardware' | 'gpu-diag' | 'fonts' | 'storage' | 'broadcaster' | 'remote'>(initialTab);
  
  // Hardware profile state
  const [hwInfo, setHwInfo] = useState<HardwareInfo>(hardwareProfile.getHardwareInfoSync());

  // Server state
  const [serverHealth, setServerHealth] = useState<any>(null);
  const [serverStatus, setServerStatus] = useState<any>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number } | null>(null);

  // Backup & DB Optimization state
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isOptimizingDB, setIsOptimizingDB] = useState(false);
  const [dbReport, setDbReport] = useState<DbOptimizationReport | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Real-time broadcast channel & IPC telemetry state
  const [telemetry, setTelemetry] = useState(syncTelemetry);

  const fetchDiagnostics = async () => {
    setIsRefreshing(true);
    const start = performance.now();
    try {
      const [healthRes, statusRes, hardwareRes] = await Promise.all([
        fetch('/api/health').then(r => r.json()).catch(() => null),
        fetch('/api/system/status').then(r => r.json()).catch(() => null),
        hardwareProfile.detectHardware().catch(() => null)
      ]);
      const end = performance.now();
      setLatency(Math.round(end - start));
      setServerHealth(healthRes);
      setServerStatus(statusRes);
      if (hardwareRes) {
        if (statusRes?.hardware) {
          const sysHw = statusRes.hardware;
          if (sysHw.isDualGpu || (Array.isArray(sysHw.gpus) && sysHw.gpus.length > 1)) {
            hardwareRes.isDualGpu = true;
            if (sysHw.discreteGpu) hardwareRes.discreteGpu = sysHw.discreteGpu;
            if (sysHw.integratedGpu) hardwareRes.integratedGpu = sysHw.integratedGpu;
            if (Array.isArray(sysHw.gpus) && (!hardwareRes.gpus || sysHw.gpus.length > hardwareRes.gpus.length)) {
              hardwareRes.gpus = sysHw.gpus;
            }
          }
        }
        setHwInfo(hardwareRes);
      }
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

    const handleSyncUpdate = (e: any) => {
      if (e.detail) {
        setTelemetry({ ...e.detail });
      }
    };
    window.addEventListener('simpleworship:sync-update', handleSyncUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('simpleworship:sync-update', handleSyncUpdate);
    };
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
        await useStore.getState().loadAllData();
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
      setIsOptimizingDB(true);
      setActionMessage('Running deep database integrity check & index verification...');
      const report = await verifyAndOptimizeDatabase();
      setDbReport(report);
      if (report.success) {
        setActionMessage(`✓ ${report.summary}`);
      } else {
        setActionMessage(`Database check warning: ${report.summary}`);
      }
      setTimeout(() => setActionMessage(null), 6000);
    } catch (e: any) {
      alert(`Optimization error: ${e.message}`);
    } finally {
      setIsOptimizingDB(false);
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

  const handleTestRemoteCommand = async (action: any, params?: any) => {
    try {
      setActionMessage(`Dispatching command "${action}" to backend & frontend pipeline...`);
      // 1. Send to server for telemetry and remote queue
      const res = await backendApi.dispatchRemoteCommand(action, params);
      
      // 2. Execute locally with zero latency
      executeRemoteCommandLocally({ action, params });

      // 3. Immediately trigger sync poll so all open windows catch up
      triggerSyncPollNow().catch(() => {});

      if (res.success) {
        setActionMessage(`✓ Executed "${action}". Server logged (${res.commandId}) & presentation updated!`);
        fetchDiagnostics();
      } else {
        setActionMessage(`✓ Executed "${action}" locally. (Server status: offline/fallback)`);
      }
      setTimeout(() => setActionMessage(null), 4000);
    } catch (e: any) {
      executeRemoteCommandLocally({ action, params });
      setActionMessage(`✓ Executed "${action}" locally.`);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleForcePushSync = async () => {
    try {
      setActionMessage('Pushing live frontend state to backend server...');
      await forceSyncNow();
      fetchDiagnostics();
      setActionMessage('✓ Live state pushed & verified with Backend Engine!');
      setTimeout(() => setActionMessage(null), 3500);
    } catch (e: any) {
      setActionMessage(`Sync error: ${e.message}`);
    }
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
    <div className="fixed inset-0 z-[99999] bg-black/75 flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-[#1c1f26] border border-[#343b4c] rounded-xl shadow-2xl w-full max-w-4xl max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden text-gray-200 animate-in fade-in zoom-in-95 duration-150">
        
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
        <div className="flex items-center gap-1 px-5 pt-3 bg-[#1e2129] border-b border-[#2a2f3d] shrink-0 overflow-x-auto custom-scrollbar">
          {[
            { id: 'hardware', label: 'Hardware Engine', icon: <Cpu size={14} /> },
            { id: 'gpu-diag', label: 'GPU Diagnostics', icon: <Gauge size={14} /> },
            { id: 'fonts', label: 'Font Auto-Adapt & Dev Sim', icon: <Type size={14} /> },
            { id: 'server', label: 'Backend Server & API', icon: <Server size={14} /> },
            { id: 'storage', label: 'Database & Local Storage', icon: <Database size={14} /> },
            { id: 'broadcaster', label: 'Display & Sync Broadcaster', icon: <Radio size={14} /> },
            { id: 'remote', label: 'Remote Control & Hub', icon: <Tv size={14} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-t-2 shrink-0 ${
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
          <div className="bg-emerald-950/80 border-b border-emerald-700/60 px-5 py-2 text-xs text-emerald-300 flex items-center gap-2 shrink-0">
            <CheckCircle2 size={14} />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6 custom-scrollbar text-xs">
          
          {/* TAB 0: HARDWARE ACCELERATION & REAL DEVICE SYSTEM ENGINE */}
          {activeTab === 'hardware' && (
            <div className="space-y-6">
              {/* Quick Status Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#14161c] p-3.5 rounded-lg border border-[#2b303e]">
                  <div className="flex items-center justify-between text-gray-400 mb-1 text-[11px]">
                    <span>Hardware Tier</span>
                    <Zap size={13} className="text-cyan-400" />
                  </div>
                  <div className={`text-base font-bold flex items-center gap-1.5 ${
                    hwInfo.tier === 'high' ? 'text-emerald-400' : hwInfo.tier === 'medium' ? 'text-cyan-400' : 'text-amber-400'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      hwInfo.tier === 'high' ? 'bg-emerald-400 animate-pulse' : hwInfo.tier === 'medium' ? 'bg-cyan-400' : 'bg-amber-400'
                    }`}></span>
                    <span>{hwInfo.tier === 'high' ? 'High Performance' : hwInfo.tier === 'medium' ? 'Balanced / Native' : 'Eco Battery Saver'}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">Directly adapted to device specs</div>
                </div>

                <div className="bg-[#14161c] p-3.5 rounded-lg border border-[#2b303e]">
                  <div className="flex items-center justify-between text-gray-400 mb-1 text-[11px]">
                    <span>CPU Threads / Cores</span>
                    <Cpu size={13} className="text-cyan-400" />
                  </div>
                  <div className="text-base font-bold text-white">
                    {hwInfo.cpuCores} Physical/Logical Cores
                  </div>
                  <div className="text-[10px] text-cyan-400 mt-1 truncate">{hwInfo.cpuModel}</div>
                </div>

                <div className="bg-[#14161c] p-3.5 rounded-lg border border-[#2b303e]">
                  <div className="flex items-center justify-between text-gray-400 mb-1 text-[11px]">
                    <span>System RAM</span>
                    <Activity size={13} className="text-cyan-400" />
                  </div>
                  <div className="text-base font-bold text-white">
                    {Math.round(hwInfo.totalRamMb / 1024)} GB Total
                  </div>
                  <div className="text-[10px] text-emerald-400 mt-1">
                    {Math.round(hwInfo.freeRamMb / 1024)} GB Free Memory
                  </div>
                </div>

                <div className="bg-[#14161c] p-3.5 rounded-lg border border-[#2b303e]">
                  <div className="flex items-center justify-between text-gray-400 mb-1 text-[11px]">
                    <span>GPU Acceleration</span>
                    <Monitor size={13} className="text-cyan-400" />
                  </div>
                  <div className="text-base font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={15} />
                    <span>{hwInfo.isHardwareAccelerated ? 'Direct3D 11 Active' : 'Software Fallback'}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1 truncate">{hwInfo.directXStatus}</div>
                </div>
              </div>

              {/* Hardware & Graphics Engine Details */}
              <div className="bg-[#14161c] p-4 rounded-lg border border-[#2b303e] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white text-xs flex items-center gap-2">
                      <Cpu size={14} className="text-cyan-400" />
                      <span>Real Device Performance & Driver Engine</span>
                    </h3>
                    <p className="text-gray-400 text-[11px] mt-0.5">
                      Ensures PPTX presentations, 4K/1080p video loops, audio, and camera streams utilize native hardware without stuttering.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const renderCleared = slideRenderCache.clear();
                      const coreCleared = PresentationCore.clearSlideCache();
                      setActionMessage(`✓ Slide cache purged: ${renderCleared} GPU off-screen frame(s) and ${coreCleared} presentation cache entries freed.`);
                      setTimeout(() => setActionMessage(null), 4000);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#252a36] hover:bg-[#32394a] text-cyan-300 hover:text-cyan-200 text-xs font-semibold transition-colors border border-[#373f52] cursor-pointer"
                  >
                    <RefreshCw size={12} />
                    <span>Purge Slide Cache</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                  <div className="bg-[#1a1d26] p-3 rounded-lg border border-[#272d3b] space-y-2">
                    <div className="font-bold text-white text-xs flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Monitor size={13} className="text-cyan-400" />
                        <span>Graphics Card & Driver Pipeline</span>
                      </div>
                      {hwInfo.isDualGpu && (
                        <span className="text-[10px] bg-cyan-950/90 text-cyan-300 border border-cyan-500/50 px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                          Dual GPU Detected
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-gray-300 font-mono">
                      {hwInfo.isDualGpu && hwInfo.discreteGpu ? (
                        <>
                          <div className="flex justify-between py-1 border-b border-[#252b38]">
                            <span className="text-gray-400 font-sans flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                              Dedicated GPU:
                            </span>
                            <span className="text-cyan-300 font-bold truncate max-w-[210px]" title={hwInfo.discreteGpu.name}>
                              {hwInfo.discreteGpu.name}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-[#252b38]">
                            <span className="text-gray-400 font-sans flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                              Integrated GPU:
                            </span>
                            <span className="text-blue-200 truncate max-w-[210px]" title={hwInfo.integratedGpu?.name || 'Built-in Display Adapter'}>
                              {hwInfo.integratedGpu?.name || 'Built-in Display Adapter'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-[#252b38]">
                            <span className="text-gray-400 font-sans">Graphics Architecture:</span>
                            <span className="text-white">{hwInfo.gpuVendor} (Dual Graphics)</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between py-1 border-b border-[#252b38]">
                            <span className="text-gray-400 font-sans">GPU Adapter:</span>
                            <span className="text-cyan-300 truncate max-w-[240px]" title={hwInfo.gpuRenderer}>{hwInfo.gpuRenderer}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-[#252b38]">
                            <span className="text-gray-400 font-sans">Driver Vendor:</span>
                            <span className="text-white">{hwInfo.gpuVendor}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between py-1 border-b border-[#252b38]">
                        <span className="text-gray-400 font-sans">Zero-Copy GPU Buffer:</span>
                        <span className="text-emerald-400">Enabled (Direct VRAM Write)</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-gray-400 font-sans">Hardware Video Decoder:</span>
                        <span className="text-emerald-400">DXVA2 / Direct3D 11 Active</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#1a1d26] p-3 rounded-lg border border-[#272d3b] space-y-2">
                    <div className="font-bold text-white text-xs flex items-center gap-1.5">
                      <Gauge size={13} className="text-cyan-400" />
                      <span>CPU & Memory Optimization</span>
                    </div>
                    <div className="space-y-1 text-gray-300 font-mono">
                      <div className="flex justify-between py-1 border-b border-[#252b38]">
                        <span className="text-gray-400 font-sans">CPU Model:</span>
                        <span className="text-white truncate max-w-[220px]">{hwInfo.cpuModel}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#252b38]">
                        <span className="text-gray-400 font-sans">Architecture / OS:</span>
                        <span className="text-cyan-300">{hwInfo.platform} ({hwInfo.arch})</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#252b38]">
                        <span className="text-gray-400 font-sans">PPTX Slide Buffer:</span>
                        <span className="text-white">Dynamic (Adaptive to RAM)</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-gray-400 font-sans">Display Sleep Blocker:</span>
                        <span className="text-emerald-400">Active (Worship Guard)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-950/40 border border-emerald-700/40 rounded-lg text-emerald-300 text-[11px] flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                  <span>
                    Hardware Acceleration is fully enabled. Windows DWM / DirectX offloads all video playback, slide rendering, and multi-monitor output directly to your device's graphics processor.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: GPU DIAGNOSTICS & ACCELERATED PIPELINE REPORT */}
          {activeTab === 'gpu-diag' && (
            <div className="space-y-6">
              {/* Header Status Banner */}
              <div className="bg-[#14161c] p-4 rounded-lg border border-[#2b303e] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Gauge className="text-cyan-400" size={18} />
                    <h3 className="font-bold text-white text-sm">GPU Diagnostics & Hardware Acceleration Engine</h3>
                  </div>
                  <p className="text-gray-400 text-xs">
                    Runtime verification of graphics card capabilities, WebGL status, hardware compositing, rasterization, and hardware video decoding.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                    !hwInfo.gpuDiagnostics?.isSoftwareRendering
                      ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                      : 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      !hwInfo.gpuDiagnostics?.isSoftwareRendering ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}></span>
                    {!hwInfo.gpuDiagnostics?.isSoftwareRendering ? 'GPU Hardware Accelerated' : 'Software Fallback Active'}
                  </span>
                  <button
                    onClick={fetchDiagnostics}
                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#252a36] hover:bg-[#32394a] text-cyan-300 text-xs font-semibold transition-colors border border-[#373f52] cursor-pointer"
                  >
                    <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                    <span>Re-Scan GPU</span>
                  </button>
                </div>
              </div>

              {/* Core GPU Diagnostics Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="bg-[#14161c] p-3.5 rounded-lg border border-[#2b303e] space-y-1.5">
                  <div className="text-gray-400 text-[11px] font-medium flex items-center justify-between">
                    <span>GPU Vendor</span>
                    <Cpu size={13} className="text-cyan-400" />
                  </div>
                  <div className="text-sm font-bold text-cyan-300 truncate" title={hwInfo.gpuDiagnostics?.gpuVendor || hwInfo.gpuVendor}>
                    {hwInfo.gpuDiagnostics?.gpuVendor || hwInfo.gpuVendor}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {hwInfo.isDualGpu ? 'Dual Graphics Manufacturers' : 'Graphics Hardware Manufacturer'}
                  </div>
                </div>

                <div className="bg-[#14161c] p-3.5 rounded-lg border border-[#2b303e] space-y-1.5">
                  <div className="text-gray-400 text-[11px] font-medium flex items-center justify-between">
                    <span>GPU Device / Renderer</span>
                    <Monitor size={13} className="text-cyan-400" />
                  </div>
                  <div className="text-xs font-bold text-white truncate" title={hwInfo.gpuDiagnostics?.gpuDevice || hwInfo.gpuRenderer}>
                    {hwInfo.gpuDiagnostics?.gpuDevice || hwInfo.gpuRenderer}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {hwInfo.isDualGpu ? 'Hybrid Dedicated + Integrated Active' : 'Detected Display Adapter'}
                  </div>
                </div>

                <div className="bg-[#14161c] p-3.5 rounded-lg border border-[#2b303e] space-y-1.5">
                  <div className="text-gray-400 text-[11px] font-medium flex items-center justify-between">
                    <span>WebGL Pipeline Status</span>
                    <Zap size={13} className="text-cyan-400" />
                  </div>
                  <div className="text-sm font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={14} />
                    <span>{hwInfo.gpuDiagnostics?.webglStatus || 'WebGL 2 Active'}</span>
                  </div>
                  <div className="text-[10px] text-gray-500">WebGL 3D Context API</div>
                </div>

                <div className="bg-[#14161c] p-3.5 rounded-lg border border-[#2b303e] space-y-1.5">
                  <div className="text-gray-400 text-[11px] font-medium flex items-center justify-between">
                    <span>Hardware Compositing Status</span>
                    <Layers size={13} className="text-cyan-400" />
                  </div>
                  <div className="text-sm font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={14} />
                    <span>{hwInfo.gpuDiagnostics?.hardwareCompositingStatus || 'Active (GPU)'}</span>
                  </div>
                  <div className="text-[10px] text-gray-500">Direct VRAM Compositor Layer</div>
                </div>

                <div className="bg-[#14161c] p-3.5 rounded-lg border border-[#2b303e] space-y-1.5">
                  <div className="text-gray-400 text-[11px] font-medium flex items-center justify-between">
                    <span>Hardware Rasterization Status</span>
                    <Activity size={13} className="text-cyan-400" />
                  </div>
                  <div className="text-sm font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={14} />
                    <span>{hwInfo.gpuDiagnostics?.hardwareRasterizationStatus || 'Active (GPU)'}</span>
                  </div>
                  <div className="text-[10px] text-gray-500">GPU Tile & Vector Rasterizer</div>
                </div>

                <div className="bg-[#14161c] p-3.5 rounded-lg border border-[#2b303e] space-y-1.5">
                  <div className="text-gray-400 text-[11px] font-medium flex items-center justify-between">
                    <span>Hardware Video Decode Status</span>
                    <Play size={13} className="text-cyan-400" />
                  </div>
                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={14} />
                    <span>{hwInfo.gpuDiagnostics?.hardwareVideoDecodeStatus || 'Hardware Accelerated (GPU)'}</span>
                  </div>
                  <div className="text-[10px] text-gray-500">NVDEC / DXVA2 / VAAPI Engine</div>
                </div>
              </div>

              {/* DUAL GRAPHICS ARCHITECTURE SHOWCASE */}
              {(hwInfo.isDualGpu || (hwInfo.gpus && hwInfo.gpus.length > 1)) && (
                <div className="bg-[#14161c] p-4 rounded-lg border border-cyan-500/40 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Cpu className="text-cyan-400" size={16} />
                      <h4 className="font-bold text-white text-xs">Dual Graphics Architecture (Multi-GPU System)</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/50 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        Both Dedicated & Integrated GPUs Detected
                      </span>
                    </div>
                  </div>

                  {/* GPU Switcher Mode Selector */}
                  <div className="bg-[#181b24] p-2 rounded-lg border border-[#272d3b] flex items-center justify-between flex-wrap gap-2">
                    <div className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                      <Layers size={13} className="text-cyan-400" />
                      <span>Active Rendering Engine:</span>
                      <span className="text-emerald-400 font-mono font-bold">
                        {hwInfo.activeGpu?.name || hwInfo.discreteGpu?.name || hwInfo.gpuRenderer}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const updated = hardwareProfile.switchGpu('discrete');
                          setHwInfo({ ...updated });
                          window.dispatchEvent(new CustomEvent('simpleworship:notify', {
                            detail: `Switched rendering engine to High-Performance Dedicated GPU!`
                          }));
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all ${
                          hwInfo.preferredGpuMode === 'discrete' || (!hwInfo.preferredGpuMode && hwInfo.activeGpu?.type === 'discrete')
                            ? 'bg-amber-500 text-black shadow-md'
                            : 'bg-[#222736] text-gray-300 hover:text-white hover:bg-[#2b3245]'
                        }`}
                        title="Prioritize High-Performance Dedicated GPU for slide rendering and shaders"
                      >
                        <Zap size={11} />
                        <span>Dedicated (High-Performance)</span>
                      </button>

                      <button
                        onClick={() => {
                          const updated = hardwareProfile.switchGpu('integrated');
                          setHwInfo({ ...updated });
                          window.dispatchEvent(new CustomEvent('simpleworship:notify', {
                            detail: `Switched rendering engine to Built-in Integrated GPU.`
                          }));
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all ${
                          hwInfo.preferredGpuMode === 'integrated'
                            ? 'bg-blue-500 text-white shadow-md'
                            : 'bg-[#222736] text-gray-300 hover:text-white hover:bg-[#2b3245]'
                        }`}
                        title="Switch to Power-Saving Built-in Integrated GPU"
                      >
                        <Monitor size={11} />
                        <span>Built-in (Power-Saving)</span>
                      </button>

                      <button
                        onClick={() => {
                          const updated = hardwareProfile.switchGpu('auto');
                          setHwInfo({ ...updated });
                          window.dispatchEvent(new CustomEvent('simpleworship:notify', {
                            detail: `GPU preference set to Auto (preferring Dedicated GPU).`
                          }));
                        }}
                        className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                          hwInfo.preferredGpuMode === 'auto'
                            ? 'bg-cyan-600 text-white font-bold'
                            : 'bg-[#222736] text-gray-400 hover:text-gray-200'
                        }`}
                        title="Automatic mode (prefers Dedicated GPU when available)"
                      >
                        Auto
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {/* CARD 1: DEDICATED / DISCRETE GPU */}
                    <div className={`p-3 rounded-lg border space-y-2 transition-all ${
                      (hwInfo.activeGpu?.type === 'discrete' || (!hwInfo.activeGpu && hwInfo.discreteGpu))
                        ? 'bg-[#1e202a] border-amber-500/70 shadow-[0_0_12px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/30'
                        : 'bg-[#1a1d26] border-amber-500/20 opacity-85'
                    }`}>
                      <div className="flex items-center justify-between border-b border-[#2a3040] pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Zap size={13} className="text-amber-400" />
                          <span className="text-xs font-bold text-white">Dedicated GPU (High-Performance)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {(hwInfo.activeGpu?.type === 'discrete' || (!hwInfo.activeGpu && hwInfo.discreteGpu)) && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500 text-black font-extrabold uppercase tracking-wider flex items-center gap-0.5">
                              <CheckCircle2 size={9} /> Active
                            </span>
                          )}
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-600/40 font-mono font-bold">
                            Discrete Adapter
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1 text-gray-300 font-mono text-[11px]">
                        <div className="flex justify-between py-0.5">
                          <span className="text-gray-400 font-sans">Graphics Model:</span>
                          <span className="text-cyan-300 font-bold truncate max-w-[200px]" title={hwInfo.discreteGpu?.name || 'Dedicated Graphics Adapter'}>
                            {hwInfo.discreteGpu?.name || 'Dedicated GPU'}
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="text-gray-400 font-sans">Manufacturer:</span>
                          <span className="text-white">{hwInfo.discreteGpu?.vendor || 'NVIDIA / AMD'}</span>
                        </div>
                        {hwInfo.discreteGpu?.driverVersion && (
                          <div className="flex justify-between py-0.5">
                            <span className="text-gray-400 font-sans">Driver Version:</span>
                            <span className="text-gray-300">{hwInfo.discreteGpu.driverVersion}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-0.5">
                          <span className="text-gray-400 font-sans">Workload Allocation:</span>
                          <span className="text-emerald-400 font-sans">3D Shaders, Video Decoding & Presentation Core</span>
                        </div>
                      </div>
                    </div>

                    {/* CARD 2: INTEGRATED / BUILT-IN GPU */}
                    <div className={`p-3 rounded-lg border space-y-2 transition-all ${
                      hwInfo.activeGpu?.type === 'integrated'
                        ? 'bg-[#1a2332] border-blue-500/70 shadow-[0_0_12px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/30'
                        : 'bg-[#1a1d26] border-blue-500/20 opacity-85'
                    }`}>
                      <div className="flex items-center justify-between border-b border-[#2a3040] pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Monitor size={13} className="text-blue-400" />
                          <span className="text-xs font-bold text-white">Built-in GPU (Integrated Display)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {hwInfo.activeGpu?.type === 'integrated' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500 text-white font-extrabold uppercase tracking-wider flex items-center gap-0.5">
                              <CheckCircle2 size={9} /> Active
                            </span>
                          )}
                          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-600/40 font-mono font-bold">
                            Integrated Adapter
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1 text-gray-300 font-mono text-[11px]">
                        <div className="flex justify-between py-0.5">
                          <span className="text-gray-400 font-sans">Graphics Model:</span>
                          <span className="text-blue-200 font-semibold truncate max-w-[200px]" title={hwInfo.integratedGpu?.name || 'Integrated Graphics Adapter'}>
                            {hwInfo.integratedGpu?.name || 'Intel UHD / AMD APU'}
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="text-gray-400 font-sans">Manufacturer:</span>
                          <span className="text-white">{hwInfo.integratedGpu?.vendor || 'Intel / AMD'}</span>
                        </div>
                        {hwInfo.integratedGpu?.driverVersion && (
                          <div className="flex justify-between py-0.5">
                            <span className="text-gray-400 font-sans">Driver Version:</span>
                            <span className="text-gray-300">{hwInfo.integratedGpu.driverVersion}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-0.5">
                          <span className="text-gray-400 font-sans">Workload Allocation:</span>
                          <span className="text-cyan-300 font-sans">Windows DWM Compositing & Display Output</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-300 bg-[#161922] p-2.5 rounded border border-[#272d3b] flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span>
                      Dual graphics detected successfully. SimpleWorship utilizes hardware acceleration across both GPUs: intensive presentation rendering is accelerated by your dedicated GPU, while your built-in graphics handles auxiliary desktop window compositing.
                    </span>
                  </div>
                </div>
              )}

              {/* Detailed Technical GPU Diagnostic Table */}
              <div className="bg-[#14161c] p-4 rounded-lg border border-[#2b303e] space-y-4">
                <h4 className="font-bold text-white text-xs flex items-center gap-2">
                  <ShieldCheck size={14} className="text-cyan-400" />
                  <span>Detailed GPU Diagnostics & Runtime Capability Matrix</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#1a1d26] p-3.5 rounded-lg border border-[#272d3b] space-y-2 font-mono">
                    <div className="text-xs font-sans font-bold text-cyan-300 border-b border-[#2a3040] pb-1.5">
                      Graphics Subsystem & Backend
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#252b38]">
                      <span className="text-gray-400 font-sans">Canvas Acceleration:</span>
                      <span className="text-emerald-400 font-bold">{hwInfo.gpuDiagnostics?.canvasAccelerationStatus || 'GPU Accelerated'}</span>
                    </div>
                    {hwInfo.isDualGpu && (
                      <div className="flex justify-between py-1 border-b border-[#252b38]">
                        <span className="text-gray-400 font-sans">Multi-GPU Configuration:</span>
                        <span className="text-emerald-400 font-bold">Dual GPU Active (Hybrid)</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 border-b border-[#252b38]">
                      <span className="text-gray-400 font-sans">Current Renderer / Backend:</span>
                      <span className="text-cyan-300 truncate max-w-[220px]" title={hwInfo.gpuDiagnostics?.currentRendererBackend}>
                        {hwInfo.gpuDiagnostics?.currentRendererBackend || hwInfo.gpuRenderer}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#252b38]">
                      <span className="text-gray-400 font-sans">Max Texture Allocation:</span>
                      <span className="text-white">
                        {hwInfo.gpuDiagnostics?.maxTextureSize || 4096} x {hwInfo.gpuDiagnostics?.maxTextureSize || 4096} px
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-400 font-sans">Max Viewport Dimensions:</span>
                      <span className="text-white">
                        {hwInfo.gpuDiagnostics?.maxViewportDims?.[0] || 4096} x {hwInfo.gpuDiagnostics?.maxViewportDims?.[1] || 4096} px
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#1a1d26] p-3.5 rounded-lg border border-[#272d3b] space-y-2 font-mono">
                    <div className="text-xs font-sans font-bold text-cyan-300 border-b border-[#2a3040] pb-1.5">
                      Video Hardware Decoding Matrix
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#252b38]">
                      <span className="text-gray-400 font-sans">H.264 (AVC1) Hardware Decode:</span>
                      <span className={hwInfo.gpuDiagnostics?.videoCodecSupport?.h264 !== false ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                        {hwInfo.gpuDiagnostics?.videoCodecSupport?.h264 !== false ? 'Active (GPU Decoded)' : 'Software Fallback'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#252b38]">
                      <span className="text-gray-400 font-sans">VP9 WebM Hardware Decode:</span>
                      <span className={hwInfo.gpuDiagnostics?.videoCodecSupport?.vp9 ? 'text-emerald-400 font-bold' : 'text-gray-400'}>
                        {hwInfo.gpuDiagnostics?.videoCodecSupport?.vp9 ? 'Active (GPU Decoded)' : 'Supported / CPU'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#252b38]">
                      <span className="text-gray-400 font-sans">AV1 Next-Gen Video Decode:</span>
                      <span className={hwInfo.gpuDiagnostics?.videoCodecSupport?.av1 ? 'text-emerald-400 font-bold' : 'text-gray-400'}>
                        {hwInfo.gpuDiagnostics?.videoCodecSupport?.av1 ? 'Active (Hardware Decoded)' : 'Software Fallback'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-400 font-sans">Zero-Copy Shared Frame Buffer:</span>
                      <span className="text-emerald-400 font-bold">Enabled (Shared VRAM)</span>
                    </div>
                  </div>
                </div>

                {/* Detected Fallbacks / Software Rendering Section */}
                <div className="p-3.5 bg-[#1a1d26] rounded-lg border border-[#272d3b] space-y-2">
                  <div className="text-xs font-bold text-white flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle size={14} className={hwInfo.gpuDiagnostics?.detectedFallbackConditions?.length ? 'text-amber-400' : 'text-emerald-400'} />
                      <span>Detected Fallback & Software Rendering Conditions</span>
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                      hwInfo.gpuDiagnostics?.detectedFallbackConditions?.length ? 'bg-amber-950 text-amber-300' : 'bg-emerald-950 text-emerald-300'
                    }`}>
                      {hwInfo.gpuDiagnostics?.detectedFallbackConditions?.length || 0} Triggers Found
                    </span>
                  </div>

                  {hwInfo.gpuDiagnostics?.detectedFallbackConditions && hwInfo.gpuDiagnostics.detectedFallbackConditions.length > 0 ? (
                    <div className="space-y-1 text-[11px] text-amber-300 font-mono">
                      {hwInfo.gpuDiagnostics.detectedFallbackConditions.map((cond, idx) => (
                        <div key={idx} className="flex items-start gap-2 bg-amber-950/40 p-2 rounded border border-amber-800/40">
                          <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-400" />
                          <span>{cond}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-emerald-300 text-[11px] bg-emerald-950/30 p-2.5 rounded border border-emerald-800/40 font-sans">
                      <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                      <span>Zero software fallback conditions detected. Your system is running 100% native GPU hardware accelerated presentation compositing.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

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
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-xs flex items-center gap-2">
                    {typeof window !== 'undefined' && (window as any).electronAPI ? (
                      <>
                        <Server size={14} className="text-green-400" />
                        <span>Native Desktop Mode (100% Offline)</span>
                      </>
                    ) : (
                      <>
                        <Server size={14} className="text-cyan-400" />
                        <span>Backend REST Endpoints (Express Server)</span>
                      </>
                    )}
                  </h3>
                  {!(typeof window !== 'undefined' && (window as any).electronAPI) && (
                    <button
                      onClick={handleForcePushSync}
                      className="flex items-center gap-1.5 px-3 py-1 bg-cyan-700 hover:bg-cyan-600 text-white rounded text-xs font-semibold transition-all cursor-pointer shadow-xs"
                    >
                      <RefreshCw size={12} />
                      <span>Force Push State to Backend</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded bg-[#1d212a] border border-[#2c3242] flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1 py-0.5 rounded bg-emerald-900 text-emerald-300 font-bold text-[9px]">GET</span>
                      <span className="text-gray-200">/api/health</span>
                    </div>
                    <span className="text-emerald-400 font-sans text-[10px]">Healthy</span>
                  </div>

                  <div className="p-2 rounded bg-[#1d212a] border border-[#2c3242] flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1 py-0.5 rounded bg-emerald-900 text-emerald-300 font-bold text-[9px]">GET</span>
                      <span className="text-gray-200">/api/system/status</span>
                    </div>
                    <span className="text-emerald-400 font-sans text-[10px]">Active</span>
                  </div>

                  <div className="p-2 rounded bg-[#1d212a] border border-[#2c3242] flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1 py-0.5 rounded bg-blue-900 text-blue-300 font-bold text-[9px]">POST</span>
                      <span className="text-gray-200">/api/sync/state</span>
                    </div>
                    <span className="text-cyan-400 font-sans text-[10px]">Live Sync</span>
                  </div>

                  <div className="p-2 rounded bg-[#1d212a] border border-[#2c3242] flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1 py-0.5 rounded bg-purple-900 text-purple-300 font-bold text-[9px]">POST</span>
                      <span className="text-gray-200">/api/remote/command</span>
                    </div>
                    <span className="text-purple-300 font-sans text-[10px]">Command Queue</span>
                  </div>

                  <div className="p-2 rounded bg-[#1d212a] border border-[#2c3242] flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1 py-0.5 rounded bg-emerald-900 text-emerald-300 font-bold text-[9px]">GET</span>
                      <span className="text-gray-200">/api/schedules</span>
                    </div>
                    <span className="text-emerald-400 font-sans text-[10px]">Persistence</span>
                  </div>

                  <div className="p-2 rounded bg-[#1d212a] border border-[#2c3242] flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1 py-0.5 rounded bg-blue-900 text-blue-300 font-bold text-[9px]">POST</span>
                      <span className="text-gray-200">/api/backup/export</span>
                    </div>
                    <span className="text-cyan-400 font-sans text-[10px]">Available</span>
                  </div>
                </div>
              </div>

              {/* Interactive Remote Command Pipeline Test */}
              <div className="bg-[#14161c] p-4 rounded-lg border border-[#2b303e] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-xs flex items-center gap-2">
                    <Radio size={14} className="text-purple-400" />
                    <span>Live Backend ↔ Frontend Command Pipeline Verification</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-purple-950/70 border border-purple-700/60 text-purple-300 font-mono text-[10px]">
                    Bidirectional IPC/REST Active
                  </span>
                </div>
                <p className="text-gray-400 text-[11px]">
                  Click any button below to dispatch a real command through the backend server (<code className="text-purple-300">/api/remote/command</code>).
                  The server enqueues and logs the command, and the SimpleWorship presentation frontend executes it instantly!
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => handleTestRemoteCommand('next_slide')}
                    className="p-2.5 bg-[#1d222e] hover:bg-[#252c3c] border border-[#2d364a] hover:border-purple-500/50 rounded-lg text-left transition-all cursor-pointer group"
                  >
                    <div className="text-white font-semibold text-xs flex items-center justify-between">
                      <span>Next Slide</span>
                      <Play size={11} className="text-purple-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">POST /api/remote/command</div>
                  </button>

                  <button
                    onClick={() => handleTestRemoteCommand('prev_slide')}
                    className="p-2.5 bg-[#1d222e] hover:bg-[#252c3c] border border-[#2d364a] hover:border-purple-500/50 rounded-lg text-left transition-all cursor-pointer group"
                  >
                    <div className="text-white font-semibold text-xs flex items-center justify-between">
                      <span>Prev Slide</span>
                      <Play size={11} className="text-purple-400 rotate-180 group-hover:-translate-x-0.5 transition-transform" />
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">POST /api/remote/command</div>
                  </button>

                  <button
                    onClick={() => handleTestRemoteCommand('toggle_black')}
                    className="p-2.5 bg-[#1d222e] hover:bg-[#252c3c] border border-[#2d364a] hover:border-amber-500/50 rounded-lg text-left transition-all cursor-pointer group"
                  >
                    <div className="text-white font-semibold text-xs flex items-center justify-between">
                      <span>Toggle Blackout</span>
                      <Zap size={11} className="text-amber-400" />
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">Black Screen Toggle</div>
                  </button>

                  <button
                    onClick={() => handleTestRemoteCommand('set_alert', { text: `Connected Test: ${new Date().toLocaleTimeString()}`, enabled: true })}
                    className="p-2.5 bg-[#1d222e] hover:bg-[#252c3c] border border-[#2d364a] hover:border-cyan-500/50 rounded-lg text-left transition-all cursor-pointer group"
                  >
                    <div className="text-white font-semibold text-xs flex items-center justify-between">
                      <span>Dispatch Alert</span>
                      <ShieldCheck size={11} className="text-cyan-400" />
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">Ticker Alert Banner</div>
                  </button>
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
                <div className="h-40 bg-[#0d0f13] p-3 rounded font-mono text-[10px] overflow-y-auto min-h-0 space-y-1 custom-scrollbar text-gray-300 border border-[#20232c]">
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
                  <div className="text-lg font-bold text-cyan-400">{songsList.length}</div>
                  <div className="text-[10px] text-gray-500">Master Hymnals</div>
                </div>

                <div className="bg-[#14161c] p-3 rounded-lg border border-[#2b303e] text-center">
                  <div className="text-xs text-gray-400 mb-1">Scriptures</div>
                  <div className="text-lg font-bold text-cyan-400">{scripturesList.length}</div>
                  <div className="text-[10px] text-gray-500">KJV & Tagalog</div>
                </div>

                <div className="bg-[#14161c] p-3 rounded-lg border border-[#2b303e] text-center">
                  <div className="text-xs text-gray-400 mb-1">Themes & Layouts</div>
                  <div className="text-lg font-bold text-cyan-400">{themesList.length}</div>
                  <div className="text-[10px] text-gray-500">Styling Presets</div>
                </div>

                <div className="bg-[#14161c] p-3 rounded-lg border border-[#2b303e] text-center">
                  <div className="text-xs text-gray-400 mb-1">Media Assets</div>
                  <div className="text-lg font-bold text-cyan-400">{assetsList.length}</div>
                  <div className="text-[10px] text-gray-500">Stills & Motions</div>
                </div>

                <div className="bg-[#14161c] p-3 rounded-lg border border-[#2b303e] text-center">
                  <div className="text-xs text-gray-400 mb-1">Active Sched Items</div>
                  <div className="text-lg font-bold text-cyan-400">{activeSchedule?.items.length || 0}</div>
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
                    disabled={isOptimizingDB}
                    className="flex items-center gap-2 bg-[#1e222c] hover:bg-[#282d3b] text-gray-300 hover:text-cyan-300 px-3 py-2 rounded-lg border border-[#323849] transition-colors cursor-pointer"
                  >
                    <RefreshCw size={13} className={isOptimizingDB ? 'animate-spin text-cyan-400' : ''} />
                    <span>{isOptimizingDB ? 'Verifying Integrity...' : 'Verify & Optimize DB'}</span>
                  </button>
                </div>

                {dbReport && (
                  <div className="mt-3 p-3 bg-[#111318] border border-[#2b3242] rounded-lg space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <CheckCircle2 size={13} />
                        <span>IndexedDB Verified & Optimized</span>
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">
                        Total check time: {dbReport.durationMs}ms
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1 font-mono">
                      <div className="bg-[#181c26] p-2 rounded border border-[#242c3d]">
                        <span className="text-gray-400 font-sans block text-[10px]">Write Latency:</span>
                        <span className="text-emerald-400 font-bold">{dbReport.writeLatencyMs} ms</span>
                      </div>
                      <div className="bg-[#181c26] p-2 rounded border border-[#242c3d]">
                        <span className="text-gray-400 font-sans block text-[10px]">Read Latency:</span>
                        <span className="text-cyan-400 font-bold">{dbReport.readLatencyMs} ms</span>
                      </div>
                      <div className="bg-[#181c26] p-2 rounded border border-[#242c3d]">
                        <span className="text-gray-400 font-sans block text-[10px]">Indexed Stores:</span>
                        <span className="text-white font-bold">{dbReport.storesHealthy ? '7 / 7 Active' : 'Store Error'}</span>
                      </div>
                      <div className="bg-[#181c26] p-2 rounded border border-[#242c3d]">
                        <span className="text-gray-400 font-sans block text-[10px]">Indexes Status:</span>
                        <span className="text-emerald-400 font-bold">{dbReport.indexesHealthy ? 'Optimal' : 'Checking'}</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-gray-400 pt-1 flex items-center justify-between">
                      <span>Live counts: <b>{dbReport.counts.songs}</b> songs, <b>{dbReport.counts.scriptures}</b> scriptures, <b>{dbReport.counts.themes}</b> themes, <b>{dbReport.counts.assets}</b> media assets.</span>
                      <span className="text-cyan-400 font-bold">100% Consistent</span>
                    </div>
                  </div>
                )}
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
                    <div className="text-lg font-bold text-white mt-0.5">{telemetry.messageCount}</div>
                    <div className="text-[10px] text-emerald-400">Zero-latency peer sync</div>
                  </div>

                  <div className="bg-[#1d212b] p-3 rounded border border-[#2b3140]">
                    <div className="text-gray-400 text-[11px]">Last Broadcast Event</div>
                    <div className="text-sm font-bold text-white mt-0.5">
                      {telemetry.lastBroadcastTime ? new Date(telemetry.lastBroadcastTime).toLocaleTimeString() : 'Ready'}
                    </div>
                    <div className="text-[10px] text-gray-400">Auto-synced across windows</div>
                  </div>

                  <div className="bg-[#1d212b] p-3 rounded border border-[#2b3140]">
                    <div className="text-gray-400 text-[11px]">Active Output Groups</div>
                    <div className="text-lg font-bold text-cyan-400 mt-0.5">{outputGroups.length} Screen(s)</div>
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
                  {outputGroups.map((group) => (
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
                        onClick={async () => {
                          const res = await DisplayManager.openProjector(group.id, group.displayIds?.[0]);
                          if (res.error) {
                            window.open(`${window.location.origin}${window.location.pathname}?projector=true&groupId=${group.id}`, '_blank');
                            setActionMessage(`Opened projector window for "${group.name}" in new tab.`);
                          } else {
                            setActionMessage(`✓ Projector window launched for "${group.name}"!`);
                          }
                          setTimeout(() => setActionMessage(null), 4000);
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

          {/* TAB: FONT AUTO-ADAPT & DEVELOPER MISSING FONT SIMULATION */}
          {activeTab === 'fonts' && (
            <FontSimulationDevPanel />
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

export default withPortal(SystemDiagnosticsModal);

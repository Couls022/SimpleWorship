import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Database, 
  Radio, 
  Tv, 
  Keyboard, 
  ShieldCheck, 
  Maximize2, 
  Minimize2, 
  Clock, 
  Wifi, 
  CheckCircle2,
  HardDrive
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { syncTelemetry } from '../store/sync';

interface SystemStatusBarProps {
  onOpenDiagnostics: () => void;
  onOpenShortcuts: () => void;
}

export default function SystemStatusBar({ onOpenDiagnostics, onOpenShortcuts }: SystemStatusBarProps) {
  const store = useStore();
  const { songsList, scripturesList, outputGroups, activeControlGroupId, shortcutSettings } = store;

  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [backendOnline, setBackendOnline] = useState(true);
  const [pingMs, setPingMs] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    const checkServer = async () => {
      const t0 = performance.now();
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const t1 = performance.now();
          setPingMs(Math.round(t1 - t0));
          setBackendOnline(true);
        } else {
          setBackendOnline(false);
        }
      } catch {
        setBackendOnline(false);
      }
    };

    checkServer();
    const pingInterval = setInterval(checkServer, 10000);

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      clearInterval(timer);
      clearInterval(pingInterval);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const activeGroup = outputGroups.find(g => g.id === activeControlGroupId) || outputGroups[0];

  return (
    <footer className="h-6 bg-[#16181e] border-t border-[#232630] text-gray-400 text-[10px] px-3 flex items-center justify-between select-none shrink-0 font-medium">
      {/* Left items: Backend, DB, Sync telemetry */}
      <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar py-0.5">
        {/* 1. Backend Server Indicator */}
        <button
          onClick={onOpenDiagnostics}
          className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
          title="Backend Express Engine Status (Click for System Diagnostics)"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${backendOnline ? 'bg-emerald-400' : 'bg-rose-500 animate-ping'}`}></span>
          <span className="text-gray-300 font-semibold">Backend API:</span>
          <span className={backendOnline ? 'text-emerald-400' : 'text-rose-400'}>
            {backendOnline ? `Online (${pingMs !== null ? `${pingMs}ms` : '3000'})` : 'Offline'}
          </span>
        </button>

        <span className="text-gray-600">|</span>

        {/* 2. IndexedDB & Storage Engine */}
        <button
          onClick={onOpenDiagnostics}
          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
          title="IndexedDB Storage & Auto-Save (Click to inspect)"
        >
          <HardDrive size={11} className="text-cyan-400" />
          <span>DB:</span>
          <span className="text-cyan-300 font-bold">{songsList.length} songs</span>
          <span className="text-gray-500">•</span>
          <span className="text-cyan-300 font-bold">{scripturesList.length} verses</span>
          <span className="text-emerald-400 text-[9px] bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-800 ml-1">
            Auto-Saved
          </span>
        </button>

        <span className="text-gray-600 hidden sm:inline">|</span>

        {/* 3. Broadcast Engine & Projector Sync */}
        <button
          onClick={onOpenDiagnostics}
          className="hidden sm:flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
          title="BroadcastChannel Real-Time Multi-Window Sync"
        >
          <Radio size={11} className="text-indigo-400" />
          <span>Sync:</span>
          <span className="text-indigo-300 font-mono">BroadcastChannel Active</span>
        </button>

        <span className="text-gray-600 hidden md:inline">|</span>

        {/* 4. Active Target Output Group */}
        <div className="hidden md:flex items-center gap-1 text-gray-300">
          <Tv size={11} className="text-amber-400" />
          <span>Live Target:</span>
          <span className="text-amber-300 font-bold truncate max-w-[120px]">
            {activeGroup ? activeGroup.name : 'Main'}
          </span>
          <span className="text-gray-500">({outputGroups.length} total)</span>
        </div>
      </div>

      {/* Right items: Shortcuts, Diagnostics button, Clock, Fullscreen */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Shortcut Profile Helper */}
        <button
          onClick={onOpenShortcuts}
          className="flex items-center gap-1 hover:text-cyan-300 transition-colors text-gray-300 px-1.5 py-0.5 rounded hover:bg-[#222632] cursor-pointer"
          title="Open Center Keyboard Shortcut Settings (F1)"
        >
          <Keyboard size={11} className="text-cyan-400" />
          <span className="hidden lg:inline">{shortcutSettings.presetName} Mode</span>
          <span className="text-[9px] font-mono bg-[#282d3b] text-cyan-300 px-1 rounded border border-[#353c4e]">F1</span>
        </button>

        {/* System Diagnostics Launcher */}
        <button
          onClick={onOpenDiagnostics}
          className="flex items-center gap-1 bg-gradient-to-r from-cyan-900/60 to-blue-900/60 hover:from-cyan-800 hover:to-blue-800 text-cyan-200 px-2 py-0.5 rounded border border-cyan-700/50 transition-all font-bold cursor-pointer"
          title="Open System Architecture & Diagnostics Hub"
        >
          <ShieldCheck size={11} className="text-cyan-400" />
          <span>System Hub</span>
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="p-1 hover:bg-[#252834] rounded text-gray-400 hover:text-white transition-colors cursor-pointer"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
        </button>

        {/* Real-time Clock */}
        <div className="flex items-center gap-1 text-gray-400 font-mono text-[10px] pl-1">
          <Clock size={10} />
          <span>{currentTime}</span>
        </div>
      </div>
    </footer>
  );
}

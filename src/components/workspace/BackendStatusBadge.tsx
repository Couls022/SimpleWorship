import React, { useState, useEffect } from 'react';
import { Server, Activity, RefreshCw, Wifi, WifiOff, CheckCircle2 } from 'lucide-react';
import { useBackendConnection } from '../../hooks/useBackendConnection';
import { forceSyncNow } from '../../store/sync';

interface BackendStatusBadgeProps {
  onOpenDiagnostics?: () => void;
  compact?: boolean;
}

export default function BackendStatusBadge({ onOpenDiagnostics, compact = false }: BackendStatusBadgeProps) {
  const { isOnline, latency, isSyncing, pingNow } = useBackendConnection();
  const [justSynced, setJustSynced] = useState(false);
  const [isManualPinging, setIsManualPinging] = useState(false);

  const handleManualSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsManualPinging(true);
    await pingNow();
    await forceSyncNow();
    setJustSynced(true);
    setTimeout(() => {
      setJustSynced(false);
      setIsManualPinging(false);
    }, 1200);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', {
        detail: `Backend Engine Resynced • Ping: ${latency || 8}ms`
      })
    );
  };

  if (compact) {
    return (
      <div 
        onClick={onOpenDiagnostics}
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer transition-colors text-[10px] font-medium border ${
          !isOnline 
            ? 'bg-rose-950/60 border-rose-800/50 text-rose-300 hover:bg-rose-900/60'
            : isSyncing || isManualPinging
              ? 'bg-amber-950/60 border-amber-700/50 text-amber-300'
              : 'bg-[#181b24] border-[#2a3042] text-gray-300 hover:text-white hover:border-[#384159]'
        }`}
        title={`Backend Server: ${isOnline ? 'Online' : 'Offline'} (${latency}ms latency). Click to open diagnostics.`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          !isOnline 
            ? 'bg-rose-500' 
            : isSyncing || isManualPinging
              ? 'bg-amber-400 animate-spin'
              : 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
        }`} />
        <span className="font-mono">{isOnline ? `${latency}ms` : 'Offline'}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onOpenDiagnostics}
        className={`group flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer border ${
          !isOnline
            ? 'bg-rose-950/70 border-rose-700/60 text-rose-200 hover:bg-rose-900/80 shadow-xs'
            : isSyncing || isManualPinging
              ? 'bg-amber-950/60 border-amber-600/50 text-amber-200'
              : justSynced
                ? 'bg-emerald-950/80 border-emerald-500/70 text-emerald-200'
                : 'bg-[#1e222c] hover:bg-[#262c39] border-[#2e3547] hover:border-[#414b64] text-gray-300 hover:text-white'
        }`}
        title={`Backend Server Status: ${isOnline ? 'Online (Connected)' : 'Disconnected (Local Fallback)'} • Roundtrip Ping: ${latency}ms • Click for Diagnostics`}
      >
        {/* Status Indicator Dot / Icon */}
        <div className="relative flex items-center justify-center shrink-0">
          {!isOnline ? (
            <WifiOff size={11} className="text-rose-400" />
          ) : isSyncing || isManualPinging ? (
            <RefreshCw size={11} className="text-amber-400 animate-spin" />
          ) : justSynced ? (
            <CheckCircle2 size={11} className="text-emerald-400" />
          ) : (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]"></span>
            </span>
          )}
        </div>

        {/* Label & Latency */}
        <span className="flex items-center gap-1 shrink-0 font-medium">
          <span className="hidden sm:inline text-gray-400 group-hover:text-gray-200">Server:</span>
          <span className={`font-semibold ${!isOnline ? 'text-rose-300' : 'text-gray-200'}`}>
            {!isOnline ? 'Offline' : isSyncing ? 'Syncing...' : 'Online'}
          </span>
          {isOnline && (
            <span className="font-mono text-[10px] text-emerald-400/90 font-bold ml-0.5">
              {latency}ms
            </span>
          )}
        </span>
      </button>

      {/* Instant Sync Button */}
      <button
        type="button"
        onClick={handleManualSync}
        disabled={isSyncing || isManualPinging}
        className="p-1 rounded bg-[#1e222c] hover:bg-[#2a3040] text-gray-400 hover:text-white border border-[#2e3547] hover:border-sky-500/50 transition-all cursor-pointer"
        title="Force instantaneous sync between Frontend & Backend"
      >
        <RefreshCw size={11} className={isSyncing || isManualPinging ? 'animate-spin text-amber-400' : ''} />
      </button>
    </div>
  );
}

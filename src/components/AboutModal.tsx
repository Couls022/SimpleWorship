import React from 'react';
import { X, CheckCircle, ShieldCheck, Cpu, HardDrive, Sparkles, ExternalLink, RefreshCw } from 'lucide-react';
import SimpleWorshipLogo from './SimpleWorshipLogo';
import { useStore } from '../store/useStore';

interface AboutModalProps {
  onClose: () => void;
}

export default function AboutModal({ onClose }: AboutModalProps) {
  const store = useStore();

  return (
    <div className="fixed inset-0 z-[120] bg-black/75 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-[#1a1c23] border border-[#353a4a] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 text-gray-200 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient banner */}
        <div className="relative bg-gradient-to-r from-[#172033] via-[#1b2742] to-[#121927] p-6 border-b border-[#2d3345] flex items-center justify-between">
          <SimpleWorshipLogo size={42} showText={true} subtitle="Pro Presentation Suite v7.4 (RC-2)" />
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 space-y-5 text-xs">
          <div>
            <h3 className="font-bold text-sm text-white mb-1">SimpleWorship Presentation Engine</h3>
            <p className="text-gray-400 leading-relaxed">
              Professional live worship projection, multi-display stage monitoring, and hymnody management built for houses of worship and live broadcast productions.
            </p>
          </div>

          {/* System Specs & Specs Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#12141a] border border-[#2b3040] rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                <ShieldCheck size={14} />
                <span>Architecture</span>
              </div>
              <div className="text-[11px] text-gray-300">
                100% Offline Capable Native Storage
              </div>
              <div className="text-[10px] text-gray-500 font-mono">
                IndexedDB Backbone + BroadcastChannel Sync
              </div>
            </div>

            <div className="bg-[#12141a] border border-[#2b3040] rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Cpu size={14} />
                <span>Format Standard</span>
              </div>
              <div className="text-[11px] text-gray-300">
                SimpleWorship Schedule (.sws)
              </div>
              <div className="text-[10px] text-gray-500 font-mono">
                SWS v1.0 Package Spec
              </div>
            </div>
          </div>

          {/* Core Feature Matrix */}
          <div className="bg-[#14161d] border border-[#2d3345] rounded-lg p-3 space-y-2">
            <span className="font-bold text-gray-300 text-[11px] uppercase tracking-wider block">
              Active Session Details
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400">
              <div>Active Schedule: <span className="text-white font-medium">{store.activeSchedule?.name || 'Untitled'}</span></div>
              <div>Schedule Items: <span className="text-cyan-300 font-mono">{store.activeSchedule?.items.length || 0}</span></div>
              <div>Songs in Library: <span className="text-emerald-300 font-mono">{store.songsList.length}</span></div>
              <div>Output Monitors: <span className="text-purple-300 font-mono">{store.outputGroups.length} configured</span></div>
            </div>
          </div>

          <div className="text-center text-[11px] text-gray-500 pt-2 border-t border-[#262b3a]">
            SimpleWorship • Designed with intentionality for churches worldwide.
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#13151b] px-6 py-3 border-t border-[#2d3345] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg transition-colors shadow-md text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

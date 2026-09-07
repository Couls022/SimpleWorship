import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { X, MonitorPlay, Radio, Send } from 'lucide-react';

export default function TargetSelectionModal() {
  const { 
    routingRequest, 
    setRoutingRequest, 
    outputGroups, 
    groupStates, 
    addScheduleItem, 
    goLiveItem, 
    activeControlGroupId, 
    setActiveControlGroupId 
  } = useStore();

  useEffect(() => {
    if (!routingRequest) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRoutingRequest(null);
        return;
      }
      if (e.key === 'a' || e.key === 'A') {
        handleSelectGroup('ALL');
        return;
      }
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= outputGroups.length) {
        handleSelectGroup(outputGroups[num - 1].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [routingRequest, outputGroups]);

  if (!routingRequest || !routingRequest.item) return null;

  const itemName = routingRequest.item.name || 'Selected Item';

  const handleSelectGroup = (targetId: string | 'ALL') => {
    if (routingRequest.isNew && routingRequest.item) {
      addScheduleItem(routingRequest.item as any);
    }
    const itemId = routingRequest.item.id as string;
    const slideIdx = routingRequest.slideIndex || 0;

    if (targetId === 'ALL') {
      outputGroups.forEach(g => {
        goLiveItem(itemId, slideIdx, g.id, routingRequest.item as any);
      });
      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', { 
          detail: `Broadcasting "${itemName}" to ALL Live Output Panels!` 
        })
      );
    } else {
      setActiveControlGroupId(targetId);
      goLiveItem(itemId, slideIdx, targetId, routingRequest.item as any);
      const targetGroup = outputGroups.find(g => g.id === targetId);
      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', { 
          detail: `Broadcasting "${itemName}" to ${targetGroup?.name || 'Live Output Panel'}!` 
        })
      );
    }
    setRoutingRequest(null);
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-[1000000] flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[#181a21] border border-[#2e3342] rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#1f222c] border-b border-[#2d3242]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Send size={18} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Select Live Output Panel</h2>
              <p className="text-[11px] text-gray-400">Choose destination screen to project content</p>
            </div>
          </div>
          <button 
            onClick={() => setRoutingRequest(null)} 
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#2c3140] transition-colors"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Selected Content Banner */}
        <div className="px-5 py-3 bg-[#13151c] border-b border-[#252834] flex items-center gap-3">
          <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider shrink-0">Item:</div>
          <div className="text-xs font-bold text-cyan-300 truncate">{itemName}</div>
        </div>

        {/* Options Stack */}
        <div className="p-5 flex flex-col gap-2.5 max-h-[60vh] overflow-y-auto">
          
          {/* Option 1: ALL LIVE PANELS */}
          <button
            onClick={() => handleSelectGroup('ALL')}
            className="group relative flex items-center gap-3.5 p-3.5 rounded-xl border-2 border-emerald-500/60 bg-gradient-to-r from-emerald-950/40 via-[#182a26] to-[#14221f] hover:border-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all text-left"
          >
            <div className="p-2.5 bg-emerald-500/20 rounded-lg text-emerald-300 border border-emerald-500/40 shrink-0 group-hover:scale-105 transition-transform">
              <Radio size={20} className="animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-wide">
                  All Live Output Panels
                </span>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-600/50">
                  PRESS [A]
                </span>
              </div>
              <p className="text-[11px] text-gray-300 mt-0.5">Broadcast simultaneously to all connected screens</p>
            </div>
          </button>

          <div className="flex items-center gap-2 my-1">
            <div className="h-px bg-[#2a2e3d] flex-1" />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Or Select Specific Screen</span>
            <div className="h-px bg-[#2a2e3d] flex-1" />
          </div>

          {/* Individual Output Panel Buttons */}
          {outputGroups.map((group, idx) => {
            const isTargeted = activeControlGroupId === group.id;
            const groupState = groupStates[group.id];
            
            return (
              <button
                key={group.id}
                onClick={() => handleSelectGroup(group.id)}
                className={`group relative flex items-center gap-3.5 p-3 rounded-xl border transition-all text-left ${
                  isTargeted
                    ? 'border-cyan-500/80 bg-gradient-to-r from-cyan-950/30 via-[#162738] to-[#121f2d] hover:border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                    : 'border-[#2d3242] bg-[#1a1c24] hover:bg-[#222633] hover:border-indigo-500/80'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 border transition-all ${
                  isTargeted 
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' 
                    : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 group-hover:bg-indigo-500/20'
                }`}>
                  <MonitorPlay size={18} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-200 truncate group-hover:text-white">
                      {group.name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isTargeted && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/60 uppercase tracking-wider">
                          ACTIVE TARGET
                        </span>
                      )}
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#111218] text-gray-400 border border-[#2b2e3c]">
                        [{idx + 1}]
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate">
                      {group.role || 'Live Display Screen'}
                      <span className="mx-1 text-gray-600">•</span>
                      {(group.displayIds && group.displayIds.length > 0) ? (
                        <span className="text-cyan-400 font-mono font-medium">Target: {group.displayIds.join(', ')}</span>
                      ) : (
                        <span className="text-gray-500 italic">Target: None</span>
                      )}
                    </span>
                    {groupState?.isBlack ? (
                      <span className="text-red-400 font-semibold shrink-0">BLACK</span>
                    ) : groupState?.isClear ? (
                      <span className="text-amber-400 font-semibold shrink-0">CLEAR</span>
                    ) : groupState?.activeItemId ? (
                      <span className="text-emerald-400 font-medium truncate max-w-[120px] shrink-0">Live Active</span>
                    ) : (
                      <span className="text-gray-500 shrink-0">Idle / No Content</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-[#13151c] border-t border-[#252834] flex items-center justify-between text-[10px] text-gray-400">
          <span>Press <kbd className="px-1 py-0.5 rounded bg-[#20232f] border border-[#333748] text-gray-300 font-mono">Esc</kbd> to cancel</span>
          <span>Click panel or press number key</span>
        </div>

      </div>
    </div>
  );
}

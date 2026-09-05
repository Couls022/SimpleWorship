import React, { useState } from 'react';
import { 
  Tv, 
  Monitor, 
  Radio, 
  Plus, 
  Layers, 
  Settings, 
  Play, 
  Check, 
  ShieldAlert, 
  Eye, 
  Sparkles,
  ChevronRight,
  ExternalLink,
  X
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { OutputGroup } from '../../types';
import RouteConfigModal from '../RouteConfigModal';

interface BottomModuleBarProps {
  onConfigureRoute?: (groupId: string) => void;
}

export default function BottomModuleBar({ onConfigureRoute }: BottomModuleBarProps) {
  const store = useStore();
  const { 
    outputGroups, 
    groupStates, 
    routerPanels,
    activeRouterId,
    setActiveRouterId,
    addRouterPanel,
    removeRouterPanel,
    updateRouterPanel,
    toggleBlack,
    toggleClear,
    toggleLogo
  } = store;

  const [configuringGroupId, setConfiguringGroupId] = useState<string | null>(null);

  const handleSelectRouter = (routerId: string, routerName: string) => {
    setActiveRouterId(routerId);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Activated Router Panel: ${routerName}` 
      })
    );
  };

  const handleAddNewRouter = () => {
    const nextIndex = routerPanels.length + 1;
    const newRouterId = `router-${Date.now()}`;
    addRouterPanel({
      routerId: newRouterId,
      targetOutputGroupId: null,
      active: true,
      visible: true,
      focused: true
    });
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Opened new Router Panel R-${nextIndex} & dedicated Live Output Panel` 
      })
    );
  };

  return (
    <div className="h-11 w-full bg-[#13151b] border-t border-[#262a38] flex items-center justify-between px-2.5 select-none shrink-0 z-20 shadow-lg">
      {/* Left: Section Header & Module Route Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-1 min-w-0">
        {/* Module Bar Brand Label */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1b1e28] border border-[#2b3042] text-[11px] font-bold text-gray-300 uppercase tracking-wider shrink-0">
          <Layers size={13} className="text-cyan-400" />
          <span className="hidden sm:inline text-gray-400">ROUTER PANELS:</span>
        </div>

        {/* List of Router Panel Module Tabs */}
        <div className="flex items-center gap-1.5 min-w-0">
          {routerPanels.map((router, index) => {
            const isTargeted = activeRouterId === router.routerId;
            const targetGroupId = router.targetOutputGroupId;
            const targetGroup = outputGroups.find(g => g.id === targetGroupId);
            const state = targetGroupId ? groupStates[targetGroupId] : null;
            
            const hasLiveItem = Boolean(state?.activeItemId);
            const isBlack = Boolean(state?.isBlack);
            const isClear = Boolean(state?.isClear);
            const isLogo = Boolean(state?.showLogo);
            
            const RoleIcon = Tv;

            return (
              <div
                key={router.routerId}
                onClick={() => handleSelectRouter(router.routerId, `Router ${index + 1}`)}
                className={`group relative flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold transition-all shrink-0 cursor-pointer border ${
                  isTargeted
                    ? 'bg-gradient-to-r from-cyan-950/90 via-[#182a3d] to-blue-950/90 border-cyan-400/90 text-white shadow-[0_0_12px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400/40'
                    : 'bg-[#1a1d26] hover:bg-[#232734] border-[#2c3244] hover:border-[#3c445c] text-gray-300 hover:text-white'
                }`}
                title={`Click to activate Router Panel ${index + 1}`}
              >
                {/* Position Index Badge */}
                <span className={`text-[10px] font-mono font-bold px-1 py-0.2 rounded border ${
                  isTargeted 
                    ? 'bg-cyan-900/80 text-cyan-200 border-cyan-400/60 font-extrabold' 
                    : 'bg-[#12141a] text-gray-400 border-[#2f3445]'
                }`}>
                  R-{index + 1}
                </span>

                {/* Clean Target Text Label (No Dropdown Arrow) */}
                <span className={`truncate max-w-[90px] sm:max-w-[180px] tracking-wide text-[11px] font-bold ${
                  isTargeted ? 'text-cyan-100 font-bold' : 'text-gray-300'
                }`}>
                  Target: {targetGroup?.name || 'Output Group'}
                </span>

                {/* Live Status Dot / Badge */}
                <div className="flex items-center gap-1 shrink-0">
                  {isBlack ? (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_6px_rgba(244,63,94,0.8)]" title="Screen is Blacked out" />
                  ) : isClear ? (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.8)]" title="Screen text is cleared" />
                  ) : isLogo ? (
                    <span className="w-2 h-2 rounded-full bg-indigo-400" title="Logo mode active" />
                  ) : hasLiveItem ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.9)]" title="Content is Live" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-600" title="Standby / No active item" />
                  )}
                  {isTargeted && (
                    <span className="hidden md:inline text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 uppercase tracking-wider ml-0.5">
                      ACTIVE
                    </span>
                  )}
                </div>

                {/* Remove Panel Button */}
                {routerPanels.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRouterPanel(router.routerId);
                    }}
                    className="p-0.5 rounded hover:bg-rose-950/80 hover:text-rose-400 text-gray-500 transition-colors ml-0.5"
                    title="Close this Router Panel"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Router Button */}
          <button
            onClick={handleAddNewRouter}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#191b24] hover:bg-[#232735] border border-dashed border-[#343b4f] hover:border-cyan-500/60 text-gray-400 hover:text-cyan-300 text-xs font-semibold transition-all shrink-0 cursor-pointer"
            title="Create a new Router Panel"
          >
            <Plus size={12} />
            <span className="hidden md:inline">Add Panel</span>
          </button>
        </div>
      </div>

      {/* Right: Master Screen Quick Toggles & Active Status Indicator */}
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {/* Settings Button (Output Groups) */}
        <button
          onClick={() => setConfiguringGroupId(outputGroups[0]?.id || 'group-1')}
          className="p-1 rounded bg-[#1c1f2a] hover:bg-[#272b3b] border border-[#2e3447] text-gray-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1 px-2"
          title="Configure Output Routes & Displays"
        >
          <Settings size={13} />
          <span className="text-xs">Routes</span>
        </button>
      </div>

      {/* Route Config Modal */}
      {configuringGroupId && (
        <RouteConfigModal 
          groupId={configuringGroupId} 
          onClose={() => setConfiguringGroupId(null)} 
        />
      )}
    </div>
  );
}

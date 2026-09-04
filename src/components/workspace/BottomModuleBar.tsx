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
  ExternalLink
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
    activeControlGroupId, 
    setActiveControlGroupId, 
    addOutputGroup,
    toggleBlack,
    toggleClear,
    toggleLogo
  } = store;

  const [configuringGroupId, setConfiguringGroupId] = useState<string | null>(null);

  // Active target fallback to first group if none selected
  const currentTargetId = activeControlGroupId || outputGroups[0]?.id;

  const handleSelectTarget = (groupId: string, groupName: string) => {
    setActiveControlGroupId(groupId);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Target panel switched to: ${groupName}` 
      })
    );
  };

  const handleAddNewRoute = () => {
    const nextIndex = outputGroups.length + 1;
    const newGroupId = `group-${Date.now()}`;
    const newGroup: OutputGroup = {
      id: newGroupId,
      name: `Display ${nextIndex}`,
      role: nextIndex === 2 ? 'confidence' : 'broadcast',
      displayIds: []
    };
    addOutputGroup(newGroup);
    setActiveControlGroupId(newGroupId);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Added new output route: ${newGroup.name}` 
      })
    );
  };

  // Get active state of the currently targeted group
  const activeState = currentTargetId ? groupStates[currentTargetId] : null;

  return (
    <div className="h-11 w-full bg-[#13151b] border-t border-[#262a38] flex items-center justify-between px-2.5 select-none shrink-0 z-20 shadow-lg">
      {/* Left: Section Header & Module Route Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-1 min-w-0">
        {/* Module Bar Brand Label */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1b1e28] border border-[#2b3042] text-[11px] font-bold text-gray-300 uppercase tracking-wider shrink-0">
          <Layers size={13} className="text-cyan-400" />
          <span className="hidden sm:inline text-gray-400">OUTPUT TARGETS:</span>
        </div>

        {/* List of Target Panel Module Tabs */}
        <div className="flex items-center gap-1.5 min-w-0">
          {outputGroups.map((group, index) => {
            const isTargeted = currentTargetId === group.id;
            const state = groupStates[group.id];
            const hasLiveItem = Boolean(state?.activeItemId);
            const isBlack = Boolean(state?.isBlack);
            const isClear = Boolean(state?.isClear);
            const isLogo = Boolean(state?.showLogo);

            // Icon by role
            const RoleIcon = group.role === 'confidence' ? Monitor : group.role === 'broadcast' ? Radio : Tv;

            return (
              <button
                key={group.id}
                onClick={() => handleSelectTarget(group.id, group.name)}
                className={`group relative flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold transition-all shrink-0 cursor-pointer border ${
                  isTargeted
                    ? 'bg-gradient-to-r from-cyan-950/90 via-[#182a3d] to-blue-950/90 border-cyan-400/90 text-white shadow-[0_0_12px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400/40'
                    : 'bg-[#1a1d26] hover:bg-[#232734] border-[#2c3244] hover:border-[#3c445c] text-gray-300 hover:text-white'
                }`}
                title={`Click to load "${group.name}" into the Fixed Live Output Panel`}
              >
                {/* Position Index Badge */}
                <span className={`text-[10px] font-mono font-bold px-1 py-0.2 rounded border ${
                  isTargeted 
                    ? 'bg-cyan-900/80 text-cyan-200 border-cyan-400/60 font-extrabold' 
                    : 'bg-[#12141a] text-gray-400 border-[#2f3445]'
                }`}>
                  #{index + 1}
                </span>

                {/* Role Icon */}
                <RoleIcon 
                  size={13} 
                  className={isTargeted ? 'text-cyan-300' : 'text-gray-400 group-hover:text-gray-200'} 
                />

                {/* Group Route Name */}
                <span className={`truncate max-w-[140px] uppercase tracking-wide ${
                  isTargeted ? 'text-cyan-100 font-bold' : 'text-gray-300'
                }`}>
                  {group.name}
                </span>

                {/* Live Status Dot / Badge */}
                <div className="flex items-center gap-1 shrink-0">
                  {isBlack ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" title="Screen is Blacked out" />
                  ) : isClear ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Screen text is cleared" />
                  ) : isLogo ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" title="Logo mode active" />
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
              </button>
            );
          })}

          {/* Add Route Button */}
          <button
            onClick={handleAddNewRoute}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#191b24] hover:bg-[#232735] border border-dashed border-[#343b4f] hover:border-cyan-500/60 text-gray-400 hover:text-cyan-300 text-xs font-semibold transition-all shrink-0 cursor-pointer"
            title="Create a new Output Route (Stage Monitor, Overflow, or Projector)"
          >
            <Plus size={12} />
            <span className="hidden sm:inline">Add Route</span>
          </button>
        </div>
      </div>

      {/* Right: Master Screen Quick Toggles & Active Status Indicator */}
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {/* Active Target Indicator for clarity */}
        {currentTargetId && (
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-gray-400 px-2 py-0.5 rounded bg-[#171922] border border-[#262b3a]">
            <span className="text-gray-500">Live Control:</span>
            <span className="font-bold text-cyan-300 truncate max-w-[130px]">
              {outputGroups.find(g => g.id === currentTargetId)?.name || 'Default'}
            </span>
          </div>
        )}



        {/* Settings Button */}
        {currentTargetId && (
          <button
            onClick={() => setConfiguringGroupId(currentTargetId)}
            className="p-1 rounded bg-[#1c1f2a] hover:bg-[#272b3b] border border-[#2e3447] text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Configure Output Routes & Displays"
          >
            <Settings size={13} />
          </button>
        )}
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

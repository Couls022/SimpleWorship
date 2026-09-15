import React, { useState, useRef, useEffect } from 'react';
import { 
  Lock, 
  Unlock, 
  Monitor, 
  ChevronDown, 
  Check, 
  Settings, 
  Layers, 
  Sparkles,
  Eye,
  Tv
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useScreens } from '../hooks/useScreens';
import { DisplayManager } from '../core/DisplayManager';

interface TargetMonitorLockProps {
  groupId: string;
  onOpenConfig?: () => void;
  compact?: boolean;
}

export default function TargetMonitorLock({ groupId, onOpenConfig, compact = false }: TargetMonitorLockProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const outputGroups = useStore(state => state.outputGroups);
  const updateOutputGroup = useStore(state => state.updateOutputGroup);
  const groupStates = useStore(state => state.groupStates);
  const routeActivationStack = useStore(state => state.routeActivationStack) || [];
  const bringRouteToTop = useStore(state => state.bringRouteToTop);

  const { screens } = useScreens();

  // Find this group
  const group = outputGroups.find(g => g.id === groupId);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!group) return null;

  // Selected displays for this route
  const selectedDisplayIds: string[] = (group.displayIds && group.displayIds.length > 0)
    ? group.displayIds
    : (group.targetDisplayId ? [group.targetDisplayId] : []);

  const isLocked = selectedDisplayIds.length > 0;

  // Available displays: real screens or fallback virtual monitors
  const availableDisplays = screens.length > 0 ? screens : [
    { id: 'display-1', label: 'Display 1 (Primary / Console)', isPrimary: true, width: 1920, height: 1080 },
    { id: 'display-2', label: 'Display 2 (Projector / Main Display)', isPrimary: false, width: 1920, height: 1080 },
    { id: 'display-3', label: 'Display 3 (Foldback / Stage Monitor)', isPrimary: false, width: 1920, height: 1080 }
  ];

  // Find human-readable label for currently locked monitor(s)
  const lockedLabel = (() => {
    if (!isLocked) return 'Unassigned (Standby)';
    if (selectedDisplayIds.length === 1) {
      const dispId = selectedDisplayIds[0];
      const match = availableDisplays.find(s => s.id === dispId || s.label === dispId);
      if (match) {
        // Clean short name
        return match.label?.replace(/\(Primary\)/i, '').replace(/\(Projector\)/i, '').trim() || match.label;
      }
      return dispId.replace('display-', 'Monitor ');
    }
    return `${selectedDisplayIds.length} Monitors Locked`;
  })();

  // Multi-route sharing & overlay status on this route's target monitor
  const sharingGroups = outputGroups.filter(g => 
    g.id !== groupId && 
    selectedDisplayIds.some(dId => (g.displayIds?.includes(dId) || g.targetDisplayId === dId))
  );

  const hasSharingRoutes = sharingGroups.length > 0;

  // Check if this route is currently the Top Overlay
  const stackRank = routeActivationStack.indexOf(groupId);
  const isTopOverlay = stackRank === 0 || sharingGroups.every(other => {
    const otherRank = routeActivationStack.indexOf(other.id);
    return otherRank === -1 || (stackRank !== -1 && stackRank < otherRank);
  });

  const topActiveGroup = hasSharingRoutes && !isTopOverlay 
    ? outputGroups.find(g => g.id === routeActivationStack.find(id => sharingGroups.some(sg => sg.id === id))) 
    : null;

  // Handlers
  const handleLockExclusive = (dispId: string) => {
    updateOutputGroup(groupId, {
      targetDisplayId: dispId,
      displayIds: [dispId]
    });
    bringRouteToTop(groupId);
    setIsOpen(false);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', {
        detail: `Locked ${group.name} exclusively to ${dispId}`
      })
    );
  };

  const handleToggleDisplay = (dispId: string) => {
    let next: string[];
    if (selectedDisplayIds.includes(dispId)) {
      next = selectedDisplayIds.filter(id => id !== dispId);
    } else {
      next = [...selectedDisplayIds, dispId];
    }
    updateOutputGroup(groupId, {
      targetDisplayId: next[0] || '',
      displayIds: next
    });
    bringRouteToTop(groupId);
  };

  const handleUnlockAll = () => {
    updateOutputGroup(groupId, {
      targetDisplayId: '',
      displayIds: []
    });
    setIsOpen(false);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', {
        detail: `Unlocked ${group.name} (Standby Mode)`
      })
    );
  };

  return (
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      {/* Main Lock Button */}
      <button
        type="button"
        id={`target-monitor-lock-btn-${groupId}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all cursor-pointer border text-[10px] font-semibold select-none ${
          isLocked
            ? (hasSharingRoutes 
                ? (isTopOverlay 
                    ? 'bg-amber-950/70 hover:bg-amber-900/80 border-amber-500/80 text-amber-200 shadow-xs ring-1 ring-amber-500/40'
                    : 'bg-indigo-950/70 hover:bg-indigo-900/80 border-indigo-500/70 text-indigo-200')
                : 'bg-emerald-950/70 hover:bg-emerald-900/80 border-emerald-500/70 text-emerald-200 shadow-xs ring-1 ring-emerald-500/30')
            : 'bg-[#181a24] hover:bg-[#202330] border-[#2c3144] text-gray-400 hover:text-gray-300'
        }`}
        title={`Target Monitor Lock for ${group.name}. Click to view or change assigned monitors.`}
      >
        {isLocked ? (
          <Lock size={11} className={hasSharingRoutes ? (isTopOverlay ? 'text-amber-400' : 'text-indigo-400') : 'text-emerald-400'} />
        ) : (
          <Unlock size={11} className="text-gray-500" />
        )}

        <span className="font-mono truncate max-w-[85px] sm:max-w-[130px]">
          {lockedLabel}
        </span>

        {/* Overlay status badge */}
        {hasSharingRoutes && (
          <span 
            className={`px-1 py-0 rounded text-[9px] font-black uppercase tracking-wider shrink-0 ${
              isTopOverlay 
                ? 'bg-amber-500 text-black shadow-xs' 
                : 'bg-indigo-900/80 text-indigo-300 border border-indigo-700/50'
            }`}
            title={isTopOverlay ? 'This route is the active TOP OVERLAY on this monitor' : `Underlay (Active: ${topActiveGroup?.name || 'Another Route'})`}
          >
            {isTopOverlay ? 'TOP' : 'UNDER'}
          </span>
        )}

        <ChevronDown size={10} className={`opacity-70 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Target Monitor Lock Dropdown Menu */}
      {isOpen && (
        <div 
          id={`target-monitor-lock-dropdown-${groupId}`}
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-full mt-1.5 z-[9999] w-72 sm:w-80 bg-[#161822] border border-[#2d3346] rounded-lg shadow-2xl overflow-hidden py-1 text-xs text-gray-200 animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header */}
          <div className="px-3 py-2 bg-[#1b1e2b] border-b border-[#292e40] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock size={12} className="text-amber-400" />
              <span className="font-bold text-gray-200 text-[11px] uppercase tracking-wider">Target Monitor Lock</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-600/40">
              {group.name}
            </span>
          </div>

          {/* Explanation note */}
          <div className="px-3 py-1.5 bg-[#12141c] text-[10px] text-gray-400 border-b border-[#222634] leading-relaxed">
            Lock this Route Panel to a dedicated monitor. It will <strong className="text-gray-300 font-bold">never</strong> touch other displays. If multiple routes target the same monitor, the active highlighted route overlays on top.
          </div>

          {/* List of Monitors */}
          <div className="p-1 space-y-1 max-h-56 overflow-y-auto custom-scrollbar">
            {availableDisplays.map((disp, i) => {
              const dispId = disp.id;
              const isSelected = selectedDisplayIds.includes(dispId) || selectedDisplayIds.includes(disp.label);
              
              // Other routes sharing this monitor
              const otherSharing = outputGroups.filter(
                (g) => g.id !== groupId && (g.displayIds?.includes(dispId) || g.displayIds?.includes(disp.label) || g.targetDisplayId === dispId)
              );

              return (
                <div
                  key={dispId || i}
                  className={`p-2 rounded-md border transition-all ${
                    isSelected 
                      ? 'bg-sky-950/50 border-sky-500/60 text-sky-100' 
                      : 'bg-[#191c27] hover:bg-[#202534] border-[#292e40] text-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => handleToggleDisplay(dispId)}
                        className={`w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0 cursor-pointer ${
                          isSelected ? 'border-sky-400 bg-sky-600 text-white' : 'border-gray-600 bg-transparent'
                        }`}
                        title={isSelected ? 'Uncheck monitor' : 'Check monitor'}
                      >
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </button>

                      <Monitor size={14} className={isSelected ? 'text-sky-400' : 'text-gray-400'} />
                      
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[11px] truncate flex items-center gap-1.5">
                          <span>{disp.label || `Monitor ${i + 1}`}</span>
                          {disp.isPrimary && (
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-gray-800 text-gray-400 border border-gray-700">
                              Console
                            </span>
                          )}
                        </div>
                        {disp.width && disp.height && (
                          <div className="text-[9px] font-mono text-gray-400">
                            {disp.width}×{disp.height}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Exclusive Lock Button */}
                    <button
                      type="button"
                      onClick={() => handleLockExclusive(dispId)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer shrink-0 ${
                        isSelected && selectedDisplayIds.length === 1
                          ? 'bg-emerald-800 text-emerald-100 border-emerald-500'
                          : 'bg-[#242938] hover:bg-sky-900 text-gray-300 hover:text-white border-[#363c50]'
                      }`}
                      title={`Lock exclusively to this monitor (Disconnects all other monitors)`}
                    >
                      {isSelected && selectedDisplayIds.length === 1 ? 'Locked 1:1' : 'Lock Exclusive'}
                    </button>
                  </div>

                  {/* Multi-route sharing banner */}
                  {otherSharing.length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-[#2d3346] flex items-center justify-between text-[10px] text-amber-300/90 font-medium">
                      <span className="flex items-center gap-1">
                        <Layers size={10} className="text-amber-400" />
                        <span>Shared with: {otherSharing.map(g => g.name).join(', ')}</span>
                      </span>
                      {isSelected && (
                        <span className={`font-mono text-[9px] px-1 rounded ${isTopOverlay ? 'bg-amber-500 text-black font-black' : 'bg-gray-800 text-gray-400'}`}>
                          {isTopOverlay ? 'TOP OVERLAY' : 'UNDERLAY'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Actions */}
          <div className="p-2 bg-[#1b1e2a] border-t border-[#292e40] flex items-center justify-between gap-1.5">
            {isLocked ? (
              <button
                type="button"
                onClick={handleUnlockAll}
                className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 text-rose-300 text-[10px] font-bold transition-all cursor-pointer"
                title="Unlock route from all displays (Set to Standby)"
              >
                Unlock (Standby)
              </button>
            ) : (
              <span className="text-[10px] text-gray-500 italic">No monitor locked</span>
            )}

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={async () => {
                  window.dispatchEvent(new CustomEvent('simpleworship:identify-displays'));
                  if (window.electronAPI && typeof window.electronAPI.identifyDisplays === 'function') {
                    try {
                      await window.electronAPI.identifyDisplays();
                    } catch (e) {}
                  }
                }}
                className="px-2 py-1 rounded bg-[#25293a] hover:bg-[#30364c] border border-[#373e55] text-cyan-300 text-[10px] font-semibold transition-all cursor-pointer"
                title="Show giant numbers on physical monitors"
              >
                Identify (1, 2, 3...)
              </button>

              {onOpenConfig && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenConfig();
                  }}
                  className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                  title="Open full route configuration"
                >
                  <Settings size={10} />
                  <span>Configure</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

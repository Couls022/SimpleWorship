import React, { useState, useEffect } from 'react';
import { 
  Tv, 
  Layers, 
  Plus, 
  Settings, 
  X,
  Clock,
  Check
} from 'lucide-react';
import { useStore } from '../../store/useStore';

interface BottomModuleBarProps {
  onConfigureRoute?: (groupId: string) => void;
}

const ClockDisplay = React.memo(() => {
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-1 text-gray-400 font-mono text-[10px] font-semibold px-1 py-0.5">
      <Clock size={11} className="text-sky-400" />
      <span>{currentTime}</span>
    </div>
  );
});

export default function BottomModuleBar({ onConfigureRoute }: BottomModuleBarProps) {
  const outputGroups = useStore(state => state.outputGroups);
  const groupStates = useStore(state => state.groupStates);
  const routerPanels = useStore(state => state.routerPanels);
  const activeRouterId = useStore(state => state.activeRouterId);
  const setActiveRouterId = useStore(state => state.setActiveRouterId);
  const addRouterPanel = useStore(state => state.addRouterPanel);
  const updateRouterPanel = useStore(state => state.updateRouterPanel);
  const updateOutputGroup = useStore(state => state.updateOutputGroup);
  const removeRouterPanel = useStore(state => state.removeRouterPanel);

  const [editingRouterId, setEditingRouterId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleSelectRouter = (routerId: string, routeLabel: string) => {
    setActiveRouterId(routerId);
    const router = routerPanels.find(p => p.routerId === routerId);
    if (router?.targetOutputGroupId) {
      useStore.getState().setActiveControlGroupId(router.targetOutputGroupId);
      useStore.getState().bringRouteToTop(router.targetOutputGroupId);
    }
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Activated: ${routeLabel}` 
      })
    );
  };

  const handleAddNewRouter = () => {
    const nextIndex = routerPanels.length + 1;
    const newRouterId = `router-${Date.now()}`;
    const cleanRouteName = `Route ${nextIndex}`;
    addRouterPanel({
      routerId: newRouterId,
      name: cleanRouteName,
      targetOutputGroupId: null,
      active: true,
      visible: true,
      focused: true
    });
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Opened ${cleanRouteName}` 
      })
    );
  };

  const startRenaming = (routerId: string, currentName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingRouterId(routerId);
    setEditingName(currentName);
  };

  const saveRenaming = (routerId: string, targetGroupId: string | null, fallbackName: string) => {
    const trimmed = editingName.trim();
    const finalName = trimmed || fallbackName;
    updateRouterPanel(routerId, { name: finalName });
    if (targetGroupId) {
      updateOutputGroup(targetGroupId, { name: finalName });
    }
    setEditingRouterId(null);
    setEditingName('');
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Renamed to ${finalName}` 
      })
    );
  };

  return (
    <div className="h-9 w-full bg-[#14161f] border-t border-[#222634] flex items-center justify-between px-3 select-none shrink-0 z-20 shadow-md">
      {/* Left: Section Header & Module Route Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-0.5 min-w-0">
        {/* Module Bar Brand Label */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#181b25] border border-[#262c3e] text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">
          <Layers size={12} className="text-sky-400" />
          <span className="hidden sm:inline">ROUTER:</span>
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

            const fallbackName = `Route ${index + 1}`;
            const displayLabel = router.name || targetGroup?.name || fallbackName;
            const isRenaming = editingRouterId === router.routerId;
            const isProtected = router.routerId === 'router-1' || router.routerId === 'router-2' || targetGroupId === 'group-congregation' || targetGroupId === 'group-r2';

            return (
              <div
                key={router.routerId}
                onClick={() => !isRenaming && handleSelectRouter(router.routerId, displayLabel)}
                className={`group relative flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold transition-all shrink-0 cursor-pointer border ${
                  isTargeted
                    ? 'bg-sky-950/80 border-sky-500/70 text-sky-200 shadow-xs ring-1 ring-sky-500/30'
                    : 'bg-[#181b25] hover:bg-[#202533] border-[#262c3e] hover:border-[#353d54] text-gray-400 hover:text-gray-200'
                }`}
                title={`Click to activate ${displayLabel}`}
              >
                {/* Position Index Badge */}
                <span className={`text-[10px] font-mono font-bold px-1 rounded border shrink-0 ${
                  isTargeted 
                    ? 'bg-sky-900/90 text-sky-100 border-sky-400/60 font-extrabold' 
                    : 'bg-[#12141c] text-gray-400 border-[#262b3c]'
                }`}>
                  R{index + 1}
                </span>

                {/* Inline Editable Route Label */}
                {isRenaming ? (
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveRenaming(router.routerId, targetGroupId, fallbackName);
                        if (e.key === 'Escape') setEditingRouterId(null);
                      }}
                      onBlur={() => saveRenaming(router.routerId, targetGroupId, fallbackName)}
                      autoFocus
                      className="bg-[#0f1118] border border-sky-500 rounded px-1.5 py-0 text-[11px] text-white font-bold w-[110px] outline-none"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        saveRenaming(router.routerId, targetGroupId, fallbackName);
                      }}
                      className="p-0.5 rounded hover:bg-emerald-800 text-emerald-300"
                      title="Save name"
                    >
                      <Check size={11} />
                    </button>
                  </div>
                ) : (
                  <span 
                    onDoubleClick={(e) => startRenaming(router.routerId, displayLabel, e)}
                    className={`truncate max-w-[90px] sm:max-w-[170px] tracking-wide text-[11px] ${
                      isTargeted ? 'text-sky-100 font-bold' : 'text-gray-300'
                    }`}
                    title="Double-click to rename"
                  >
                    {displayLabel}
                  </span>
                )}

                {/* Live Status Dot Indicator */}
                <div className="flex items-center gap-1 shrink-0">
                  {isBlack ? (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_6px_rgba(244,63,94,0.8)]" title="Screen is Blacked out" />
                  ) : isClear ? (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.8)]" title="Screen text is cleared" />
                  ) : isLogo ? (
                    <span className="w-2 h-2 rounded-full bg-indigo-400" title="Logo mode active" />
                  ) : state?.isLiveEnabled && hasLiveItem ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.9)]" title="Route is Live" />
                  ) : state?.isLiveEnabled ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Route Live Enabled" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-600" title="Standby" />
                  )}
                </div>

                {/* Remove Panel Button - only available for user-created routes (R3+) */}
                {routerPanels.length > 2 && !isProtected && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRouterPanel(router.routerId);
                    }}
                    className="p-0.5 rounded hover:bg-rose-950/80 hover:text-rose-400 text-gray-500 transition-colors ml-0.5"
                    title="Close this Route"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Router Button */}
          <button
            onClick={handleAddNewRouter}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#181b25] hover:bg-[#202533] border border-dashed border-[#2d3448] hover:border-sky-500/60 text-gray-400 hover:text-sky-300 text-[11px] font-semibold transition-all shrink-0 cursor-pointer"
            title="Create a new Route"
          >
            <Plus size={11} />
            <span className="hidden md:inline">Add Route</span>
          </button>
        </div>
      </div>

      {/* Right: Master Screen Quick Toggles & Clock */}
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        {/* Real-time Clock */}
        <ClockDisplay />
      </div>
    </div>
  );
}

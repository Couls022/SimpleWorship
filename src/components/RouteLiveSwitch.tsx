import React from 'react';
import { Radio, Power, Sparkles, Layers } from 'lucide-react';
import { useStore } from '../store/useStore';

interface RouteLiveSwitchProps {
  groupId: string;
  className?: string;
  compact?: boolean;
}

export default function RouteLiveSwitch({ groupId, className = '', compact = false }: RouteLiveSwitchProps) {
  const groupStates = useStore(state => state.groupStates);
  const outputGroups = useStore(state => state.outputGroups);
  const toggleMasterLive = useStore(state => state.toggleMasterLive);
  const bringRouteToTop = useStore(state => state.bringRouteToTop);
  const routeActivationStack = useStore(state => state.routeActivationStack) || [];

  const group = outputGroups.find(g => g.id === groupId);
  const state = groupStates[groupId];

  const isLive = Boolean(state?.isLiveEnabled);
  const isBlack = Boolean(state?.isBlack);
  const isClear = Boolean(state?.isClear);
  const isLogo = Boolean(state?.showLogo);

  // Check overlay position
  const selectedDisplayIds: string[] = (group?.displayIds && group.displayIds.length > 0)
    ? group.displayIds
    : (group?.targetDisplayId ? [group.targetDisplayId] : []);

  const sharingGroups = outputGroups.filter(g => 
    g.id !== groupId && 
    selectedDisplayIds.some(dId => (g.displayIds?.includes(dId) || g.targetDisplayId === dId))
  );
  const hasSharingRoutes = sharingGroups.length > 0;
  const stackRank = routeActivationStack.indexOf(groupId);
  const isTopOverlay = stackRank === 0 || sharingGroups.every(other => {
    const otherRank = routeActivationStack.indexOf(other.id);
    return otherRank === -1 || (stackRank !== -1 && stackRank < otherRank);
  });

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLive) {
      bringRouteToTop(groupId);
    }
    toggleMasterLive(groupId);
  };

  if (!group) return null;

  return (
    <button
      type="button"
      id={`route-live-switch-btn-${groupId}`}
      onClick={handleToggle}
      className={`relative inline-flex items-center gap-1.5 rounded transition-all cursor-pointer font-bold select-none border shadow-xs ${
        isLive
          ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.5)] ring-1 ring-red-400/40'
          : 'bg-[#1e222e] hover:bg-[#282d3d] text-gray-300 hover:text-white border-[#32384a]'
      } ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'} ${className}`}
      title={
        isLive 
          ? `${group.name} is LIVE on locked monitor(s). Click to switch OFF (Standby).` 
          : `${group.name} is in Standby. Click to switch LIVE on locked monitor(s).`
      }
    >
      {/* Live status dot / pulsing beacon */}
      <span className="relative flex h-2 w-2 shrink-0">
        {isLive && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${isLive ? 'bg-white' : 'bg-gray-500'}`} />
      </span>

      {/* Main Switch Label */}
      <span className="tracking-wider uppercase font-black">
        {isLive ? 'LIVE ON' : 'LIVE OFF'}
      </span>

      {/* Mode / Overlay Sub-badge */}
      {isLive && hasSharingRoutes && (
        <span 
          className={`px-1 rounded text-[8px] font-black uppercase tracking-wider shrink-0 ${
            isTopOverlay 
              ? 'bg-amber-400 text-black shadow-xs' 
              : 'bg-black/60 text-amber-200 border border-amber-400/40'
          }`}
          title={isTopOverlay ? 'Top active overlay on locked monitor' : 'Layered under active route'}
        >
          {isTopOverlay ? 'TOP' : 'UNDER'}
        </span>
      )}

      {/* Black / Clear / Logo Indicator on the button */}
      {isLive && isBlack && (
        <span className="text-[8px] bg-black text-rose-300 px-1 rounded font-mono font-bold">
          BLK
        </span>
      )}
      {isLive && isClear && !isBlack && (
        <span className="text-[8px] bg-black/60 text-amber-300 px-1 rounded font-mono font-bold">
          CLR
        </span>
      )}
      {isLive && isLogo && !isBlack && !isClear && (
        <span className="text-[8px] bg-black/60 text-indigo-300 px-1 rounded font-mono font-bold">
          LOGO
        </span>
      )}
    </button>
  );
}

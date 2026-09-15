import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { resolveDisplayAssignments, routeTargetsDisplay } from '../core/DisplayRouter';
import { DisplayManager } from '../core/DisplayManager';
import MonitorPreviewCanvas from './MonitorPreviewCanvas';
import { useScreens } from '../hooks/useScreens';
import { initSync } from '../store/sync';
import { broadcastStateChange } from '../utils/broadcastSync';

interface ProjectorViewProps {
  groupId?: string;
  displayId?: string;
}

export default function ProjectorView({ groupId: initialGroupId, displayId: propDisplayId }: ProjectorViewProps = {}) {
  const outputGroups = useStore(state => state.outputGroups);
  const groupStates = useStore(state => state.groupStates);
  const stagedGroupStates = useStore(state => state.stagedGroupStates);
  const activeControlGroupId = useStore(state => state.activeControlGroupId);
  const activeRouterId = useStore(state => state.activeRouterId);
  const routerPanels = useStore(state => state.routerPanels);
  const routeActivationStack = useStore(state => state.routeActivationStack) || [];

  const { screens } = useScreens();
  const [identifyActive, setIdentifyActive] = useState(false);
  const [identifyNumber, setIdentifyNumber] = useState<number | null>(null);

  // Read displayId and routedGroupId from URL search params if not provided in props
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const displayId = propDisplayId || searchParams.get('displayId') || searchParams.get('targetDisplayId') || searchParams.get('display') || '';
  const routedGroupId = searchParams.get('groupId') || searchParams.get('group') || initialGroupId || '';
  const [currentRouteGroupId, setCurrentRouteGroupId] = useState<string>(routedGroupId);

  // Initialize broadcast synchronization and aggressive state retrieval
  useEffect(() => {
    initSync(true);
    
    // Projector must load its own assets and songs from DB so local background URLs resolve correctly
    useStore.getState().loadAllData().catch(e => console.warn('Projector failed to load DB data:', e));

    // Immediately request state from master window
    broadcastStateChange({ type: 'REQUEST_STATE', data: null });
    const timer1 = setTimeout(() => {
      broadcastStateChange({ type: 'REQUEST_STATE', data: null });
    }, 250);
    const timer2 = setTimeout(() => {
      broadcastStateChange({ type: 'REQUEST_STATE', data: null });
    }, 800);

    // Hydrate from localStorage if groupStates is empty
    try {
      const cached = localStorage.getItem('simpleworship_group_states_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object' && Object.keys(useStore.getState().groupStates || {}).length === 0) {
          useStore.setState({ groupStates: parsed });
        }
      }
    } catch (e) {}

    // Cross-window storage listener for instant updates
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'simpleworship_group_states_v1' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            useStore.setState({ groupStates: parsed });
          }
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // Electron IPC route update listener
    if ((window.electronAPI as any)?.onProjectorRouteChanged) {
      (window.electronAPI as any).onProjectorRouteChanged((data: any) => {
        if (data?.groupId) {
          setCurrentRouteGroupId(data.groupId);
        }
      });
    }

    // In-browser custom event listener for route changed
    const handleRouteChanged = (e: any) => {
      const targetDisplay = e?.detail?.displayId;
      if (!displayId || !targetDisplay || targetDisplay === displayId) {
        if (e?.detail?.groupId) {
          setCurrentRouteGroupId(e.detail.groupId);
        }
      }
    };
    window.addEventListener('simpleworship:projector-route-changed', handleRouteChanged);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('simpleworship:projector-route-changed', handleRouteChanged);
    };
  }, []);

  // Listen for screen identification events and display enumeration
  useEffect(() => {
    let unmounted = false;

    const handleIdentify = (data?: any) => {
      setIdentifyActive(true);
      if (data?.displayIndex !== undefined) {
        setIdentifyNumber(data.displayIndex);
      }
      setTimeout(() => {
        if (!unmounted) setIdentifyActive(false);
      }, 3500);
    };

    if ((window.electronAPI as any)?.onIdentifyDisplays) {
      (window.electronAPI as any).onIdentifyDisplays(handleIdentify);
    }
    const onCustomIdentify = (e: any) => handleIdentify(e.detail);
    window.addEventListener('identify-displays', onCustomIdentify);

    return () => {
      unmounted = true;
      window.removeEventListener('identify-displays', onCustomIdentify);
    };
  }, []);

  // Apply transparency to document & body when ProjectorView is mounted
  useEffect(() => {
    document.documentElement.classList.add('projector-mode');
    document.body.classList.add('projector-mode');
    document.documentElement.style.backgroundColor = 'transparent';
    document.body.style.backgroundColor = 'transparent';
    const rootEl = document.getElementById('root');
    if (rootEl) {
      rootEl.classList.add('projector-mode');
      rootEl.style.backgroundColor = 'transparent';
    }
  }, []);

  // Compute monitor index for identification badge
  const displayIndex = useMemo(() => {
    if (identifyNumber !== null) return identifyNumber;
    if (!displayId || screens.length === 0) return 1;
    const matchIdx = screens.findIndex(
      (scr: any, sIdx: number) => {
        const sLabel = String(scr.label || scr.name || scr.id || '').toLowerCase().trim();
        const targetId = String(displayId).toLowerCase().trim();
        if (!sLabel || !targetId) return false;
        if (sLabel === targetId || sLabel.includes(targetId) || targetId.includes(sLabel)) return true;
        if (targetId.includes('primary') && scr.isPrimary) return true;
        if ((targetId.includes('2') || targetId.includes('secondary') || targetId.includes('alternate')) && sIdx === 1) return true;
        if ((targetId.includes('3') || targetId.includes('foldback') || targetId.includes('stage')) && sIdx === 2) return true;
        return false;
      }
    );
    if (matchIdx !== -1) return matchIdx + 1;
    if (displayId.toLowerCase().includes('foldback')) return 3;
    if (displayId.toLowerCase().includes('alternate')) return 2;
    return 1;
  }, [screens, displayId, identifyNumber]);

  // Resolve winning active route and all overlay routes targeting this physical display
  const { winningGroupId, isLiveActive, candidateGroupIds, liveGroupIds, stackedLiveGroupIds } = useMemo(() => {
    const isStageWindow = routedGroupId === 'group-stage' || 
      (displayId && (displayId.toLowerCase().includes('stage') || displayId.toLowerCase().includes('foldback')));

    // 1. Stage / Confidence Monitor Mode: Dedicated to stage
    if (isStageWindow) {
      const isLive = Boolean(groupStates['group-stage']?.isLiveEnabled);
      return {
        winningGroupId: 'group-stage',
        isLiveActive: isLive,
        candidateGroupIds: ['group-stage'],
        liveGroupIds: isLive ? ['group-stage'] : [],
        stackedLiveGroupIds: isLive ? ['group-stage'] : [],
      };
    }

    // 2. Strict Physical Presentation Display Pipeline Isolation
    // Only output groups configured to target THIS physical display are permitted as candidates.
    const candidateSet = new Set<string>();

    if (displayId) {
      // Find all output groups whose configured target displays match this physical display
      outputGroups.forEach(g => {
        if (g.role === 'confidence' || g.id === 'group-stage') return;
        if (routeTargetsDisplay(g, displayId, screens)) {
          candidateSet.add(g.id);
        }
      });
    } else if (routedGroupId) {
      // Standalone preview with explicit groupId
      candidateSet.add(routedGroupId);
    } else {
      // Standalone web preview fallback when no displayId and no groupId is provided
      const defaultGroup = outputGroups.find(g => g.role !== 'confidence' && g.id !== 'group-stage') || outputGroups[0];
      if (defaultGroup) {
        candidateSet.add(defaultGroup.id);
      }
    }

    const allCandidateIds = Array.from(candidateSet);

    // Filter candidate groups whose Live state is ON (isLiveEnabled: true)
    const liveIds = allCandidateIds.filter(gid => Boolean(groupStates[gid]?.isLiveEnabled));

    // Stacking Priority according to routeActivationStack (MRU order):
    // Index 0 is UNA (most recently active route)
    // Index 1 is PANGALAWA (previously active route)
    // Index 2 is PANGATLO (the route before that)
    const stackRankMap = new Map<string, number>();
    (routeActivationStack || []).forEach((id, idx) => stackRankMap.set(id, idx));

    // Sort live candidates by MRU stack rank
    const stackedLiveGroupIds = [...liveIds].sort((a, b) => {
      const rankA = stackRankMap.has(a) ? stackRankMap.get(a)! : 999;
      const rankB = stackRankMap.has(b) ? stackRankMap.get(b)! : 999;
      return rankA - rankB;
    });

    // The topmost active route (UNA)
    const winning = stackedLiveGroupIds[0] || null;

    return {
      winningGroupId: winning,
      isLiveActive: Boolean(winning && groupStates[winning]?.isLiveEnabled),
      candidateGroupIds: allCandidateIds,
      liveGroupIds: liveIds,
      stackedLiveGroupIds,
    };
  }, [routedGroupId, displayId, outputGroups, groupStates, activeControlGroupId, currentRouteGroupId, routerPanels, activeRouterId, screens, routeActivationStack]);

  // Standby indicator when no live routes are active
  const isStandby = liveGroupIds.length === 0;

  // Determine what state to pass to the canvas
  const winningState = winningGroupId ? (groupStates[winningGroupId] || stagedGroupStates[winningGroupId]) : undefined;
  const winningGroup = winningGroupId ? (outputGroups.find(g => g.id === winningGroupId) || outputGroups[0]) : undefined;

  return (
    <div 
      data-canvas-preview="true"
      className="w-screen h-screen overflow-hidden relative bg-black select-none flex items-center justify-center"
    >
      {/* Hardware-accelerated presentation surfaces: renders candidate canvases with GPU isolation and zero-flicker stability */}
      {candidateGroupIds.map((groupId) => {
        // Stack rank for this group among live groups targeting this monitor:
        // rank 0 = UNA (Topmost layer)
        // rank 1 = PANGALAWA (Second layer)
        // rank 2 = PANGATLO (Third layer)
        const stackRank = stackedLiveGroupIds.indexOf(groupId);
        const isLive = stackRank !== -1;
        
        // If not live, this route is completely hidden and will never clash or overlay
        if (!isLive) {
          return (
            <div 
              key={groupId}
              className="absolute inset-0 hidden pointer-events-none"
              style={{ display: 'none', zIndex: 0 }}
            />
          );
        }

        // Layer calculation:
        // Topmost (UNA) has highest z-index (e.g. 50)
        // PANGALAWA has z-index 40
        // PANGATLO has z-index 30
        const zIndex = Math.max(10, 50 - stackRank * 10);

        // A group is an overlay if there is another live group beneath it on this display
        // Bottom-most live route in the stack serves as the base layer (isOverlayLayer: false)
        const isBaseLayer = stackRank === (stackedLiveGroupIds.length - 1);
        const isOverlayLayer = !isBaseLayer;

        const state = groupStates[groupId] || stagedGroupStates[groupId];
        const group = outputGroups.find(g => g.id === groupId) || outputGroups[0];
        
        return (
          <div 
            key={groupId}
            className="absolute inset-0 pointer-events-auto" 
            style={{ 
              zIndex,
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
            }}
          >
            <MonitorPreviewCanvas
              groupId={groupId}
              customGroup={group}
              customState={state}
              isProjectorMode={true}
              isOverlayLayer={isOverlayLayer}
              className="w-full h-full"
            />
          </div>
        );
      })}

      {/* Standby black backdrop when no routes are live */}
      {isStandby && (
        <div className="absolute inset-0 z-10 bg-black pointer-events-none" />
      )}

      {/* Visual Identification Overlay for connected monitors */}
      <AnimatePresence>
        {identifyActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 z-[120] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md pointer-events-none"
          >
            <div className="w-48 h-48 rounded-3xl bg-indigo-600/90 text-white flex flex-col items-center justify-center shadow-2xl border-4 border-white/20">
              <span className="text-8xl font-black">{displayIndex}</span>
              <span className="text-xs uppercase font-mono tracking-widest text-blue-200 mt-2">
                {displayId || `Display ${displayIndex}`}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

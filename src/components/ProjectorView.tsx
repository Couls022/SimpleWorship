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
  }, [displayId]);

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

  // Stage / Confidence Monitor Mode: Dedicated to stage
  const isStageWindow = Boolean(
    currentRouteGroupId === 'group-stage' || 
    routedGroupId === 'group-stage' || 
    (displayId && (displayId.toLowerCase().includes('stage') || displayId.toLowerCase().includes('foldback')))
  );

  // Candidate Output Groups targeted to THIS physical display (recalculated only when display/groups topology changes)
  const candidateGroupIds = useMemo<string[]>(() => {
    if (isStageWindow) {
      return ['group-stage'];
    }

    const candidateSet = new Set<string>();

    if (displayId) {
      outputGroups.forEach(g => {
        if (g.role === 'confidence' || g.id === 'group-stage') return;
        if (routeTargetsDisplay(g, displayId, screens)) {
          candidateSet.add(g.id);
        }
      });
    } else if (currentRouteGroupId || routedGroupId) {
      const targetGid = currentRouteGroupId || routedGroupId;
      if (outputGroups.some(g => g.id === targetGid)) {
        candidateSet.add(targetGid);
      }
    } else {
      const defaultGroup = outputGroups.find(g => g.role !== 'confidence' && g.id !== 'group-stage') || outputGroups[0];
      if (defaultGroup) {
        candidateSet.add(defaultGroup.id);
      }
    }

    return Array.from(candidateSet);
  }, [isStageWindow, displayId, currentRouteGroupId, routedGroupId, outputGroups, screens]);

  // Granular winning route selector: subscribes ONLY to candidate groups' live flags and routeActivationStack
  // Returns a primitive string or null. Does NOT re-render when unrelated routes (e.g. R2 on G1 projector) change.
  const winningGroupId = useStore(React.useCallback((state) => {
    if (candidateGroupIds.length === 0) return null;
    
    if (isStageWindow) {
      return Boolean(state.groupStates['group-stage']?.isLiveEnabled) ? 'group-stage' : null;
    }

    // Filter candidate groups whose Live state is ON
    const liveIds = candidateGroupIds.filter(gid => Boolean(state.groupStates[gid]?.isLiveEnabled));
    if (liveIds.length === 0) return null;
    if (liveIds.length === 1) return liveIds[0];

    // Arbitration: sort by routeActivationStack MRU
    const stackRankMap = new Map<string, number>();
    (state.routeActivationStack || []).forEach((id, idx) => stackRankMap.set(id, idx));

    const sorted = [...liveIds].sort((a, b) => {
      const rankA = stackRankMap.has(a) ? stackRankMap.get(a)! : 999;
      const rankB = stackRankMap.has(b) ? stackRankMap.get(b)! : 999;
      return rankA - rankB;
    });

    return sorted[0] || null;
  }, [candidateGroupIds, isStageWindow]));

  // Granular winning state selector: subscribes ONLY to the winning route's state
  // If winningGroupId is R1, changes to R2 or Stage state produce ZERO re-renders on R1's projector.
  const winningState = useStore(React.useCallback((state) => {
    if (!winningGroupId) return undefined;
    return state.groupStates[winningGroupId] || state.stagedGroupStates[winningGroupId];
  }, [winningGroupId]));

  const winningGroup = useMemo(() => {
    if (!winningGroupId) return undefined;
    return outputGroups.find(g => g.id === winningGroupId) || outputGroups[0];
  }, [winningGroupId, outputGroups]);

  return (
    <div 
      data-canvas-preview="true"
      className="w-screen h-screen overflow-hidden relative bg-black select-none flex items-center justify-center m-0 p-0"
      style={{
        width: '100vw',
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        margin: 0,
        padding: 0,
        overflow: 'hidden'
      }}
    >
      {/* Physical Monitor Arbitration: Render ONLY the single winning active route's canvas for this physical display */}
      {winningGroupId ? (
        <div 
          className="absolute inset-0 pointer-events-auto z-10 w-full h-full m-0 p-0 overflow-hidden" 
          style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
        >
          <MonitorPreviewCanvas
            groupId={winningGroupId}
            customGroup={winningGroup}
            customState={winningState}
            isProjectorMode={true}
            isOverlayLayer={false}
            className="w-full h-full"
          />
        </div>
      ) : (
        /* Standby black backdrop when no routes are live */
        <div className="absolute inset-0 z-10 bg-black pointer-events-none w-full h-full m-0 p-0" />
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

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { resolveDisplayAssignments } from '../core/DisplayRouter';
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
  const store = useStore();
  const { outputGroups, groupStates, stagedGroupStates, activeControlGroupId } = store;

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

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('storage', handleStorage);
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

  // Resolve winning active route targeting this physical display
  const { winningGroupId, isLiveActive } = useMemo(() => {
    if (displayId && outputGroups.length > 0) {
      const assignments = resolveDisplayAssignments(outputGroups, groupStates, activeControlGroupId, [displayId]);
      const match = assignments.get(displayId);
      if (match) {
        if (match.assignedGroupId) {
          // A designated route targeting this display is LIVE ON!
          return { winningGroupId: match.assignedGroupId, isLiveActive: true };
        }
        if (match.candidateGroupIds && match.candidateGroupIds.length > 0) {
          // Check if any candidate group is currently LIVE in groupStates
          const liveCandidate = match.candidateGroupIds.find(gid => {
            const st = groupStates[gid] || stagedGroupStates[gid];
            return Boolean(st?.isLiveEnabled);
          });
          if (liveCandidate) {
            return { winningGroupId: liveCandidate, isLiveActive: true };
          }
          // Candidate routes explicitly target this display, but ALL are LIVE OFF: Standby mode (Solid Black)
          return { winningGroupId: match.candidateGroupIds[0], isLiveActive: false };
        }
      }
    }

    // Fallback: If no candidate route specifically matched this displayId string
    // (e.g. single projector output, unconfigured mapping, or generic window):
    const effectiveGroupId = (currentRouteGroupId && outputGroups.some(g => g.id === currentRouteGroupId))
      ? currentRouteGroupId
      : (routedGroupId && outputGroups.some(g => g.id === routedGroupId))
      ? routedGroupId
      : (activeControlGroupId && outputGroups.some(g => g.id === activeControlGroupId))
      ? activeControlGroupId
      : outputGroups[0]?.id || 'group-congregation';

    const state = groupStates[effectiveGroupId] || stagedGroupStates[effectiveGroupId];
    const live = Boolean(state?.isLiveEnabled);

    return {
      winningGroupId: effectiveGroupId,
      isLiveActive: live,
    };
  }, [displayId, outputGroups, groupStates, stagedGroupStates, activeControlGroupId, routedGroupId, currentRouteGroupId]);

  // Determine what state to pass to the canvas
  const winningState = winningGroupId ? (groupStates[winningGroupId] || stagedGroupStates[winningGroupId]) : undefined;
  const winningGroup = winningGroupId ? (outputGroups.find(g => g.id === winningGroupId) || outputGroups[0]) : undefined;

  return (
    <div 
      data-canvas-preview="true"
      className="w-screen h-screen overflow-hidden relative bg-black select-none flex items-center justify-center"
    >
      {/* ALWAYS render the canvas to preserve DOM state, video playheads, and asset caches. 
          Use opacity to hide it if Master Live is OFF or no group is assigned. */}
      {winningGroupId && winningGroup && (
        <div className="absolute inset-0 transition-opacity duration-500 ease-in-out" style={{ opacity: isLiveActive ? 1 : 0 }}>
          <MonitorPreviewCanvas
            groupId={winningGroupId}
            customGroup={winningGroup}
            customState={winningState}
            isProjectorMode={true}
            className="w-full h-full"
          />
        </div>
      )}

      {/* Master Gate Standby Overlay: Solid black if LIVE switch is OFF */}
      <div 
        className="absolute inset-0 z-[100] bg-black pointer-events-none transition-opacity duration-500 ease-in-out flex items-center justify-center"
        style={{ opacity: (!isLiveActive || !winningGroupId) ? 1 : 0 }}
      >
        {/* Visual Identification Overlay for connected monitors */}
        <AnimatePresence>
          {identifyActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md pointer-events-none"
            >
              <div className="w-48 h-48 rounded-3xl bg-blue-600/90 text-white flex flex-col items-center justify-center shadow-2xl border-4 border-white/20">
                <span className="text-8xl font-black">{displayIndex}</span>
                <span className="text-xs uppercase font-mono tracking-widest text-blue-200 mt-2">
                  {displayId || `Display ${displayIndex}`}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* If LIVE is active, the identify overlay should still be visible if triggered */}
      <AnimatePresence>
        {(identifyActive && isLiveActive) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 z-[110] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md pointer-events-none"
          >
            <div className="w-48 h-48 rounded-3xl bg-blue-600/90 text-white flex flex-col items-center justify-center shadow-2xl border-4 border-white/20">
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

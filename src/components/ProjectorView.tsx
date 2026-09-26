import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { resolveDisplayAssignments, routeTargetsDisplay } from '../core/DisplayRouter';
import { DisplayManager } from '../core/DisplayManager';
import MonitorPreviewCanvas from './MonitorPreviewCanvas';
import { ProjectorErrorBoundary } from './ProjectorErrorBoundary';
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
  const routedGroupId = initialGroupId || searchParams.get('groupId') || searchParams.get('group') || '';
  const [currentRouteGroupId, setCurrentRouteGroupId] = useState<string>(routedGroupId);

  // Synchronize when initialGroupId prop updates
  useEffect(() => {
    if (initialGroupId && initialGroupId !== currentRouteGroupId) {
      setCurrentRouteGroupId(initialGroupId);
    }
  }, [initialGroupId]);

  // Cursor auto-hide logic for clean presentation projection
  const [cursorVisible, setCursorVisible] = useState(true);
  const cursorTimerRef = useRef<any>(null);

  useEffect(() => {
    const handleMouseMove = () => {
      setCursorVisible(true);
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = setTimeout(() => {
        setCursorVisible(false);
      }, 2500);
    };

    window.addEventListener('mousemove', handleMouseMove);
    cursorTimerRef.current = setTimeout(() => setCursorVisible(false), 2500);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    };
  }, []);

  // Fullscreen toggle helpers (Double-click or F11 / F key)
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11' || e.key === 'f' || e.key === 'F') {
        // Prevent default browser F11 and toggle native fullscreen
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape' && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFullscreen]);

  // Initialize broadcast synchronization and aggressive state retrieval
  useEffect(() => {
    initSync(true);
    
    // Projector must load its own assets and songs from DB so local background URLs resolve correctly
    useStore.getState().loadAllData().catch(e => console.warn('Projector failed to load DB data:', e));

    // Resilient state retrieval: immediate on mount, with a single deferred fallback if still disconnected
    const requestSync = () => {
      broadcastStateChange({ type: 'REQUEST_STATE', data: { origin: 'projector', timestamp: Date.now() } });
    };
    requestSync();
    
    // Single fallback at 800ms only if state is still unpopulated
    const fallbackTimer = setTimeout(() => {
      const currentStates = useStore.getState().groupStates;
      if (!currentStates || Object.keys(currentStates).length === 0) {
        requestSync();
      }
    }, 800);

    // Watchdog ping only triggers if state is empty or connection was marked interrupted
    const watchdogInterval = setInterval(() => {
      const currentStates = useStore.getState().groupStates;
      if (!currentStates || Object.keys(currentStates).length === 0) {
        requestSync();
      }
    }, 15000);

    // Refresh state when window gains focus or visibility
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

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
      clearTimeout(fallbackTimer);
      clearInterval(watchdogInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
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

  const activeControlGroupId = useStore(state => state.activeControlGroupId);
  const routeActivationStack = useStore(state => state.routeActivationStack || []);

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
    }

    // Fallback 1: If an explicit route was requested in URL / prop
    if (currentRouteGroupId || routedGroupId) {
      const targetGid = currentRouteGroupId || routedGroupId;
      if (outputGroups.some(g => g.id === targetGid && g.role !== 'confidence' && g.id !== 'group-stage')) {
        candidateSet.add(targetGid);
      }
    }

    // Fallback 2: Any broadcast route without an explicit target assignment can target presentation display
    outputGroups.forEach(g => {
      if (g.role !== 'confidence' && g.id !== 'group-stage') {
        const hasExplicit = (g.displayIds && g.displayIds.length > 0) || Boolean(g.targetDisplayId);
        if (!hasExplicit) {
          candidateSet.add(g.id);
        }
      }
    });

    // Fallback 3: Default all broadcast groups
    if (candidateSet.size === 0) {
      outputGroups.forEach(g => {
        if (g.role !== 'confidence' && g.id !== 'group-stage') {
          candidateSet.add(g.id);
        }
      });
    }

    return Array.from(candidateSet);
  }, [isStageWindow, displayId, currentRouteGroupId, routedGroupId, outputGroups, screens]);

  const groupStates = useStore(state => state.groupStates);

  // Determine all candidate routes currently LIVE on this display
  const liveCandidateGroupIds = useMemo(() => {
    if (isStageWindow) {
      return Boolean(groupStates['group-stage']?.isLiveEnabled) ? ['group-stage'] : [];
    }

    // 1. Check live state of candidate routes
    const liveFromCandidates = candidateGroupIds.filter(gid => Boolean(groupStates[gid]?.isLiveEnabled));
    if (liveFromCandidates.length > 0) return liveFromCandidates;

    // 2. Resilient fallback: If any broadcast group is marked live in groupStates, show it immediately
    const liveBroadcasts = outputGroups
      .filter(g => g.role !== 'confidence' && g.id !== 'group-stage' && Boolean(groupStates[g.id]?.isLiveEnabled))
      .map(g => g.id);
    if (liveBroadcasts.length > 0) return liveBroadcasts;

    // 3. Any key in groupStates marked live
    return Object.keys(groupStates || {}).filter(k => k !== 'group-stage' && Boolean(groupStates[k]?.isLiveEnabled));
  }, [candidateGroupIds, isStageWindow, groupStates, outputGroups]);

  const isLive = useMemo(() => {
    if (isStageWindow) {
      return Boolean(groupStates['group-stage']?.isLiveEnabled);
    }
    if (liveCandidateGroupIds.length > 0) return true;
    return Object.values(groupStates || {}).some(st => Boolean((st as any)?.isLiveEnabled));
  }, [isStageWindow, liveCandidateGroupIds, groupStates]);

  // Stacking Resolution:
  // Render live layers in ascending z-index order (bottom to top).
  // The active control route (activeControlGroupId) must ALWAYS be at the top of the stack (highest z-index),
  // ensuring the route the operator is actively selecting overlays on top cleanly.
  const stackedLayers = useMemo(() => {
    const designatedDefaultId = candidateGroupIds[0] || currentRouteGroupId || routedGroupId || outputGroups[0]?.id || 'group-congregation';

    if (liveCandidateGroupIds.length === 0) {
      return [{
        groupId: designatedDefaultId,
        isBase: true,
        isOverlay: false,
        zIndex: 10
      }];
    }

    if (liveCandidateGroupIds.length === 1) {
      return [{
        groupId: liveCandidateGroupIds[0],
        isBase: true,
        isOverlay: false,
        zIndex: 10
      }];
    }

    // When 2+ routes are live on this projector display:
    // Sort so inactive routes come first (lower z-index) and the active control route comes LAST (highest z-index, on top)
    const sorted = [...liveCandidateGroupIds].sort((a, b) => {
      if (a === activeControlGroupId) return 1;
      if (b === activeControlGroupId) return -1;
      // MRU activation stack fallback
      const idxA = routeActivationStack.indexOf(a);
      const idxB = routeActivationStack.indexOf(b);
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });

    // The bottom-most layer provides the foundational presentation canvas/background
    // All subsequent layers overlay transparently on top with increasing z-index
    return sorted.map((gId, idx) => ({
      groupId: gId,
      isBase: idx === 0,
      isOverlay: idx > 0,
      zIndex: 10 + idx * 10
    }));
  }, [liveCandidateGroupIds, candidateGroupIds, currentRouteGroupId, routedGroupId, outputGroups, activeControlGroupId, routeActivationStack]);

  return (
    <div 
      data-canvas-preview="true"
      onDoubleClick={toggleFullscreen}
      onContextMenu={e => e.preventDefault()}
      className="w-screen h-screen overflow-hidden relative bg-black select-none flex items-center justify-center m-0 p-0"
      style={{
        width: '100vw',
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        cursor: cursorVisible ? 'default' : 'none'
      }}
    >
      {/* Dynamic Multi-Route Projector Stack: Active route is always on top (highest z-index) with transparent overlay */}
      {stackedLayers.map((layer) => {
        const groupObj = outputGroups.find(g => g.id === layer.groupId) || outputGroups[0];
        return (
          <ProjectorLayer
            key={layer.groupId}
            groupId={layer.groupId}
            group={groupObj}
            isLive={isLive}
            isOverlay={layer.isOverlay}
            zIndex={layer.zIndex}
          />
        );
      })}

      {/* Seamless Standby Veil: When no routes are live, fade smoothly to solid black without unmounting canvas */}
      <div 
        className={`absolute inset-0 z-50 bg-black pointer-events-none transition-opacity duration-300 ease-in-out ${
          isLive ? 'opacity-0' : 'opacity-100'
        }`} 
      />

      {/* Standby Diagnostics Pill: Visible only when in standby mode or moving mouse, giving instant feedback */}
      {!isLive && cursorVisible && (
        <div className="absolute bottom-4 left-4 z-[60] pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/75 border border-white/10 text-white/60 text-xs font-mono backdrop-blur-sm transition-opacity duration-300">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>{displayId ? `Target: ${displayId}` : `Display ${displayIndex}`}</span>
          <span className="text-white/30">•</span>
          <span>Standby Ready</span>
          <span className="text-white/30">•</span>
          <span className="text-white/40">Double-click for Fullscreen</span>
        </div>
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

interface ProjectorLayerProps {
  groupId: string;
  group: any;
  isLive: boolean;
  isOverlay: boolean;
  zIndex: number;
}

const ProjectorLayer = React.memo(function ProjectorLayer({
  groupId,
  group,
  isLive: _isLive,
  isOverlay,
  zIndex
}: ProjectorLayerProps) {
  return (
    <div 
      className="absolute inset-0 pointer-events-none w-full h-full m-0 p-0 overflow-hidden" 
      style={{ zIndex, transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
    >
      <ProjectorErrorBoundary fallbackGroupId={groupId}>
        <MonitorPreviewCanvas
          groupId={groupId}
          customGroup={group}
          isProjectorMode={true}
          isOverlayLayer={isOverlay}
          className="w-full h-full"
        />
      </ProjectorErrorBoundary>
    </div>
  );
});


import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { PanelId, PanelState, FloatingCoordinates, WorkspaceLayoutState, WorkspacePreset } from '../types';
import { openDB } from 'idb';

const STORAGE_KEY = 'simpleworship_workspace_state_v2';
const PRESETS_STORAGE_KEY = 'simpleworship_workspace_presets_v2';

const dbPromise = openDB('workspace-layout-db', 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('layout-store')) {
      db.createObjectStore('layout-store');
    }
  },
});

export const BUILTIN_PRESETS: WorkspacePreset[] = [
  {
    id: 'default',
    name: 'Standard 4-Pane (Default)',
    description: 'Classic presentation layout with Schedule, Preview, Live, and Bottom Resources dock.',
    isBuiltIn: true,
    panels: {
      schedule: { visible: true, isCollapsed: false, isDocked: true },
      preview: { visible: true, isCollapsed: false, isDocked: true },
      live: { visible: true, isCollapsed: false, isDocked: true },
      multiGroup: { visible: false, isCollapsed: false, isDocked: true },
      resources: { visible: true, isCollapsed: false, isDocked: true },
      stageMonitor: { visible: false, isCollapsed: false, isDocked: false },
      quickNotes: { visible: false, isCollapsed: false, isDocked: false }, mediaLibrary: { visible: false, isCollapsed: false, isDocked: false }
    },
    panelGroupSizes: {
      verticalSplit: [55, 45],
      horizontalMainSplit: [20, 40, 40],
      bottomSplit: [0, 100],
      previewVerticalSplit: [65, 35],
      liveVerticalSplit: [65, 35],
      resourcesSplit: [65, 35]
    }
  },
  {
    id: 'live_focus',
    name: 'Live Presentation Focus',
    description: 'Enlarged Live Output monitor for active service broadcasting.',
    isBuiltIn: true,
    panels: {
      schedule: { visible: true, isCollapsed: false, isDocked: true },
      preview: { visible: true, isCollapsed: false, isDocked: true },
      live: { visible: true, isCollapsed: false, isDocked: true },
      multiGroup: { visible: false, isCollapsed: false, isDocked: true },
      resources: { visible: true, isCollapsed: false, isDocked: true },
      stageMonitor: { visible: true, isCollapsed: false, isDocked: false },
      quickNotes: { visible: false, isCollapsed: false, isDocked: false }, mediaLibrary: { visible: false, isCollapsed: false, isDocked: false }
    },
    panelGroupSizes: {
      verticalSplit: [60, 40],
      horizontalMainSplit: [15, 35, 50],
      bottomSplit: [0, 100],
      previewVerticalSplit: [55, 45],
      liveVerticalSplit: [50, 50],
      resourcesSplit: [70, 30]
    }
  },
  {
    id: 'operator_cues',
    name: 'Operator & Cues Focus',
    description: 'Expanded Schedule and Preview columns designed for fast cueing and slide curation.',
    isBuiltIn: true,
    panels: {
      schedule: { visible: true, isCollapsed: false, isDocked: true },
      preview: { visible: true, isCollapsed: false, isDocked: true },
      live: { visible: true, isCollapsed: false, isDocked: true },
      multiGroup: { visible: false, isCollapsed: false, isDocked: true },
      resources: { visible: true, isCollapsed: false, isDocked: true },
      stageMonitor: { visible: false, isCollapsed: false, isDocked: false },
      quickNotes: { visible: true, isCollapsed: false, isDocked: false }, mediaLibrary: { visible: false, isCollapsed: false, isDocked: false }
    },
    panelGroupSizes: {
      verticalSplit: [65, 35],
      horizontalMainSplit: [28, 44, 28],
      bottomSplit: [0, 100],
      previewVerticalSplit: [70, 30],
      liveVerticalSplit: [65, 35],
      resourcesSplit: [60, 40]
    }
  },
  {
    id: 'floating_modular',
    name: 'Modular Floating Workstation',
    description: 'Live Output & Stage Monitors popped out into draggable floating windows over the canvas.',
    isBuiltIn: true,
    panels: {
      schedule: { visible: true, isCollapsed: false, isDocked: true },
      preview: { visible: true, isCollapsed: false, isDocked: true },
      live: { visible: true, isCollapsed: false, isDocked: false },
      multiGroup: { visible: false, isCollapsed: false, isDocked: true },
      resources: { visible: true, isCollapsed: false, isDocked: true },
      stageMonitor: { visible: true, isCollapsed: false, isDocked: false },
      quickNotes: { visible: false, isCollapsed: false, isDocked: false }, mediaLibrary: { visible: false, isCollapsed: false, isDocked: false }
    },
    panelGroupSizes: {
      verticalSplit: [55, 45],
      horizontalMainSplit: [30, 70, 0],
      bottomSplit: [0, 100],
      previewVerticalSplit: [65, 35],
      liveVerticalSplit: [65, 35],
      resourcesSplit: [65, 35]
    }
  }
];

const DEFAULT_PANEL_STATES: Record<PanelId, PanelState> = {
  schedule: {
    id: 'schedule',
    title: 'Schedule',
    visible: true,
    visibility: true,
    isCollapsed: false,
    collapsed: false,
    isDocked: true,
    size: 20,
    defaultDockSize: 20,
    floating: { x: 40, y: 80, width: 340, height: 480, zIndex: 10 }
  },
  preview: {
    id: 'preview',
    title: 'Preview',
    visible: true,
    visibility: true,
    isCollapsed: false,
    collapsed: false,
    isDocked: true,
    size: 40,
    defaultDockSize: 40,
    floating: { x: 390, y: 80, width: 440, height: 500, zIndex: 11 }
  },
  live: {
    id: 'live',
    title: 'Live Output',
    visible: true,
    visibility: true,
    isCollapsed: false,
    collapsed: false,
    isDocked: true,
    size: 40,
    defaultDockSize: 40,
    floating: { x: 480, y: 100, width: 520, height: 540, zIndex: 12 }
  },
  multiGroup: {
    id: 'multiGroup',
    title: 'Multi-Group Displays',
    visible: false,
    visibility: false,
    isCollapsed: false,
    collapsed: false,
    isDocked: false,
    size: 35,
    defaultDockSize: 0,
    floating: { x: 100, y: 220, width: 620, height: 260, zIndex: 13 }
  },
  resources: {
    id: 'resources',
    title: 'Resources',
    visible: true,
    visibility: true,
    isCollapsed: false,
    collapsed: false,
    isDocked: true,
    size: 65,
    defaultDockSize: 100,
    floating: { x: 60, y: 120, width: 780, height: 460, zIndex: 14 }
  },
  stageMonitor: {
    id: 'stageMonitor',
    title: 'Confidence / Stage Monitor',
    visible: false,
    visibility: false,
    isCollapsed: false,
    collapsed: false,
    isDocked: false,
    size: 30,
    defaultDockSize: 30,
    floating: { x: 260, y: 140, width: 480, height: 320, zIndex: 15 }
  },
  quickNotes: {
    id: 'quickNotes',
    title: 'Quick Script & Notes',
    visible: false,
    visibility: false,
    isCollapsed: false,
    collapsed: false,
    isDocked: false,
    size: 20,
    defaultDockSize: 20,
    floating: { x: 200, y: 160, width: 380, height: 300, zIndex: 16 }
  },
  mediaLibrary: {
    id: 'mediaLibrary',
    title: 'Media Library',
    visible: false,
    visibility: false,
    isCollapsed: false,
    collapsed: false,
    isDocked: false,
    size: 20,
    defaultDockSize: 20,
    floating: { x: 300, y: 100, width: 450, height: 400, zIndex: 17 }
  }
};

const DEFAULT_WORKSPACE_LAYOUT: WorkspaceLayoutState = {
  version: 2,
  activePresetId: 'default',
  panels: DEFAULT_PANEL_STATES,
  panelGroupSizes: {
    verticalSplit: [55, 45],
    horizontalMainSplit: [20, 40, 40],
    bottomSplit: [30, 70],
    previewVerticalSplit: [65, 35],
    liveVerticalSplit: [65, 35],
    resourcesSplit: [65, 35]
  },
  lastUpdated: Date.now()
};

export interface WorkspaceLayoutContextType {
  state: WorkspaceLayoutState;
  panels: Record<PanelId, PanelState>;
  activePresetId: string;
  presets: WorkspacePreset[];
  customPresets: WorkspacePreset[];
  
  // Panel state actions by Unique Panel ID
  getPanel: (id: PanelId | string) => PanelState;
  updatePanelSize: (id: PanelId | string, size: number) => void;
  updatePanelCollapsed: (id: PanelId | string, collapsed: boolean) => void;
  setPanelCollapsed: (id: PanelId | string, collapsed: boolean) => void;
  togglePanelCollapsed: (id: PanelId | string) => void;
  updatePanelVisibility: (id: PanelId | string, visible: boolean) => void;
  setPanelVisibility: (id: PanelId | string, visible: boolean) => void;
  togglePanelVisibility: (id: PanelId | string) => void;
  togglePanelDock: (id: PanelId | string) => void;
  setPanelDocked: (id: PanelId | string, isDocked: boolean) => void;
  updateFloatingPosition: (id: PanelId | string, coords: Partial<FloatingCoordinates>) => void;
  bringToFront: (id: PanelId | string) => void;
  
  // Layout and Preset actions with manual trigger for resetLayout
  resetLayout: () => void;
  applyPreset: (presetId: string) => void;
  saveCustomPreset: (name: string, description?: string) => void;
  deleteCustomPreset: (presetId: string) => void;
  updateGroupSizes: (groupKey: keyof WorkspaceLayoutState['panelGroupSizes'], sizes: number[]) => void;
  
  // Layout revision key for triggering layout rebuilds
  layoutKey: number;
}

export type WorkspaceContextType = WorkspaceLayoutContextType;

const WorkspaceContext = createContext<WorkspaceLayoutContextType | null>(null);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [layoutState, setLayoutState] = useState<WorkspaceLayoutState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.version === 2 && parsed.panels) {
          // Merge with default panels to handle any newly added panels & ensure size/collapsed/visibility
          const mergedPanels = { ...DEFAULT_PANEL_STATES };
          for (const key of Object.keys(parsed.panels) as PanelId[]) {
            if (mergedPanels[key]) {
              const raw = parsed.panels[key];
              const isVisible = raw.visible !== undefined 
                ? Boolean(raw.visible) 
                : (raw.visibility !== undefined ? Boolean(raw.visibility) : mergedPanels[key].visible);
              const isCollapsed = raw.isCollapsed !== undefined 
                ? Boolean(raw.isCollapsed) 
                : (raw.collapsed !== undefined ? Boolean(raw.collapsed) : mergedPanels[key].isCollapsed);
              const size = typeof raw.size === 'number' 
                ? raw.size 
                : (typeof raw.defaultDockSize === 'number' ? raw.defaultDockSize : mergedPanels[key].size);

              mergedPanels[key] = {
                ...mergedPanels[key],
                ...raw,
                visible: isVisible,
                visibility: isVisible,
                isCollapsed: isCollapsed,
                collapsed: isCollapsed,
                size: size,
                floating: {
                  ...mergedPanels[key].floating,
                  ...(raw.floating || {})
                }
              };
            }
          }
          return {
            ...DEFAULT_WORKSPACE_LAYOUT,
            ...parsed,
            panels: mergedPanels
          };
        }
      }
    } catch (e) {
      console.warn('Failed to load workspace layout state from localStorage, using defaults.', e);
    }
    return DEFAULT_WORKSPACE_LAYOUT;
  });

  const [customPresets, setCustomPresets] = useState<WorkspacePreset[]>(() => {
    try {
      const saved = localStorage.getItem(PRESETS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load custom workspace presets.', e);
    }
    return [];
  });

  const [layoutKey, setLayoutKey] = useState(Date.now());
  const [highestZIndex, setHighestZIndex] = useState(20);

  const [isIdbLoaded, setIsIdbLoaded] = useState(false);

  // Load from IndexedDB on mount
  useEffect(() => {
    dbPromise.then(db => db.get('layout-store', STORAGE_KEY)).then(val => {
      if (val && val.version === 2 && val.panels) {
        // Merge with defaults similar to localstorage
        const mergedPanels = { ...DEFAULT_PANEL_STATES };
        for (const key of Object.keys(val.panels) as PanelId[]) {
          if (mergedPanels[key]) {
            const raw = val.panels[key];
            const isVisible = raw.visible !== undefined ? Boolean(raw.visible) : (raw.visibility !== undefined ? Boolean(raw.visibility) : mergedPanels[key].visible);
            const isCollapsed = raw.isCollapsed !== undefined ? Boolean(raw.isCollapsed) : (raw.collapsed !== undefined ? Boolean(raw.collapsed) : mergedPanels[key].isCollapsed);
            const size = typeof raw.size === 'number' ? raw.size : (typeof raw.defaultDockSize === 'number' ? raw.defaultDockSize : mergedPanels[key].size);

            mergedPanels[key] = {
              ...mergedPanels[key],
              ...raw,
              visible: isVisible,
              visibility: isVisible,
              isCollapsed: isCollapsed,
              collapsed: isCollapsed,
              size: size,
              floating: {
                ...mergedPanels[key].floating,
                ...(raw.floating || {})
              }
            };
          }
        }
        setLayoutState({
          ...DEFAULT_WORKSPACE_LAYOUT,
          ...val,
          panels: mergedPanels
        });
      }
      setIsIdbLoaded(true);
    }).catch(e => {
      console.warn('Failed to load from IDB, using localStorage fallback', e);
      setIsIdbLoaded(true);
    });
  }, []);

  // Sync layout state changes to localStorage and IndexedDB
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layoutState));
      if (isIdbLoaded) {
        dbPromise.then(db => db.put('layout-store', layoutState, STORAGE_KEY)).catch(console.error);
      }
    } catch (e) {
      console.error('Failed to persist workspace layout state:', e);
    }
  }, [layoutState, isIdbLoaded]);

  // Sync custom presets to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(customPresets));
    } catch (e) {
      console.error('Failed to persist custom workspace presets to localStorage:', e);
    }
  }, [customPresets]);

  // Listen to system reset layout events
  useEffect(() => {
    const handleResetEvent = () => {
      resetLayout();
    };

    window.addEventListener('simpleworship:reset-layout', handleResetEvent);
    return () => window.removeEventListener('simpleworship:reset-layout', handleResetEvent);
  }, []);

  const getPanel = useCallback((id: PanelId | string): PanelState => {
    const panelKey = id as PanelId;
    return layoutState.panels[panelKey] || DEFAULT_PANEL_STATES[panelKey] || {
      id: panelKey,
      title: String(id),
      visible: true,
      visibility: true,
      isCollapsed: false,
      collapsed: false,
      isDocked: true,
      size: 30,
      defaultDockSize: 30,
      floating: { x: 50, y: 50, width: 400, height: 400, zIndex: 10 }
    };
  }, [layoutState.panels]);

  const updatePanelSize = useCallback((id: PanelId | string, size: number) => {
    const panelKey = id as PanelId;
    setLayoutState((prev) => {
      const current = prev.panels[panelKey] || DEFAULT_PANEL_STATES[panelKey];
      if (!current) return prev;
      return {
        ...prev,
        panels: {
          ...prev.panels,
          [panelKey]: {
            ...current,
            size
          }
        },
        lastUpdated: Date.now()
      };
    });
  }, []);

  const updatePanelCollapsed = useCallback((id: PanelId | string, isCollapsed: boolean) => {
    const panelKey = id as PanelId;
    setLayoutState((prev) => {
      const current = prev.panels[panelKey] || DEFAULT_PANEL_STATES[panelKey];
      if (!current) return prev;
      return {
        ...prev,
        panels: {
          ...prev.panels,
          [panelKey]: {
            ...current,
            isCollapsed,
            collapsed: isCollapsed
          }
        },
        lastUpdated: Date.now()
      };
    });
  }, []);

  const setPanelCollapsed = updatePanelCollapsed;

  const togglePanelCollapsed = useCallback((id: PanelId | string) => {
    const panelKey = id as PanelId;
    setLayoutState((prev) => {
      const current = prev.panels[panelKey] || DEFAULT_PANEL_STATES[panelKey];
      if (!current) return prev;
      const nextCollapsed = !current.isCollapsed;
      return {
        ...prev,
        panels: {
          ...prev.panels,
          [panelKey]: {
            ...current,
            isCollapsed: nextCollapsed,
            collapsed: nextCollapsed
          }
        },
        lastUpdated: Date.now()
      };
    });
  }, []);

  const updatePanelVisibility = useCallback((id: PanelId | string, visible: boolean) => {
    const panelKey = id as PanelId;
    setLayoutState((prev) => {
      const current = prev.panels[panelKey] || DEFAULT_PANEL_STATES[panelKey];
      if (!current) return prev;
      return {
        ...prev,
        panels: {
          ...prev.panels,
          [panelKey]: {
            ...current,
            visible,
            visibility: visible
          }
        },
        lastUpdated: Date.now()
      };
    });
  }, []);

  const setPanelVisibility = updatePanelVisibility;

  const togglePanelVisibility = useCallback((id: PanelId | string) => {
    const panelKey = id as PanelId;
    setLayoutState((prev) => {
      const current = prev.panels[panelKey] || DEFAULT_PANEL_STATES[panelKey];
      if (!current) return prev;
      const nextVisible = !current.visible;
      return {
        ...prev,
        panels: {
          ...prev.panels,
          [panelKey]: {
            ...current,
            visible: nextVisible,
            visibility: nextVisible
          }
        },
        lastUpdated: Date.now()
      };
    });
  }, []);

  const bringToFront = useCallback((id: PanelId | string) => {
    const panelKey = id as PanelId;
    setHighestZIndex((prevZ) => {
      const nextZ = prevZ + 1;
      setLayoutState((prev) => {
        const current = prev.panels[panelKey] || DEFAULT_PANEL_STATES[panelKey];
        return {
          ...prev,
          panels: {
            ...prev.panels,
            [panelKey]: {
              ...current,
              floating: {
                ...current.floating,
                zIndex: nextZ
              }
            }
          }
        };
      });
      return nextZ;
    });
  }, []);

  const togglePanelDock = useCallback((id: PanelId | string) => {
    const panelKey = id as PanelId;
    setLayoutState((prev) => {
      const current = prev.panels[panelKey] || DEFAULT_PANEL_STATES[panelKey];
      const willBeDocked = !current.isDocked;
      return {
        ...prev,
        panels: {
          ...prev.panels,
          [panelKey]: {
            ...current,
            isDocked: willBeDocked,
            visible: true,
            visibility: true
          }
        },
        lastUpdated: Date.now()
      };
    });
    if (!layoutState.panels[panelKey]?.isDocked) {
      bringToFront(panelKey);
    }
  }, [bringToFront, layoutState.panels]);

  const setPanelDocked = useCallback((id: PanelId | string, isDocked: boolean) => {
    const panelKey = id as PanelId;
    setLayoutState((prev) => {
      const current = prev.panels[panelKey] || DEFAULT_PANEL_STATES[panelKey];
      return {
        ...prev,
        panels: {
          ...prev.panels,
          [panelKey]: { ...current, isDocked }
        },
        lastUpdated: Date.now()
      };
    });
  }, []);

  const updateFloatingPosition = useCallback((id: PanelId | string, coords: Partial<FloatingCoordinates>) => {
    const panelKey = id as PanelId;
    setLayoutState((prev) => {
      const current = prev.panels[panelKey] || DEFAULT_PANEL_STATES[panelKey];
      return {
        ...prev,
        panels: {
          ...prev.panels,
          [panelKey]: {
            ...current,
            floating: {
              ...current.floating,
              ...coords
            }
          }
        },
        lastUpdated: Date.now()
      };
    });
  }, []);

  const updateGroupSizes = useCallback((groupKey: keyof WorkspaceLayoutState['panelGroupSizes'], sizes: number[]) => {
    setLayoutState((prev) => ({
      ...prev,
      panelGroupSizes: {
        ...prev.panelGroupSizes,
        [groupKey]: sizes
      },
      lastUpdated: Date.now()
    }));
  }, []);

  // Manual trigger for resetLayout function
  const resetLayout = useCallback(() => {
    // Clear panel split caches from react-resizable-panels
    localStorage.removeItem('simpleworship-vertical-main-v2');
    localStorage.removeItem('simpleworship-horizontal-top-v2');
    localStorage.removeItem('simpleworship-horizontal-bottom-v2');
    localStorage.removeItem('workspace-layout-v1-vertical');
    localStorage.removeItem('workspace-layout-v1-horizontal');
    localStorage.removeItem('workspace-layout-v1-bottom');
    localStorage.removeItem('workspace-layout-v1-preview');
    localStorage.removeItem('workspace-layout-v1-live');
    localStorage.removeItem('workspace-layout-v1-resources-tree');
    localStorage.removeItem('workspace-layout-v1-songs-tree');
    localStorage.removeItem('workspace-layout-v1-scriptures-tree');

    // Reset layout state to default clean state and immediately save to localStorage
    setLayoutState(DEFAULT_WORKSPACE_LAYOUT);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WORKSPACE_LAYOUT));
    } catch (e) {
      console.error('Failed to write reset workspace layout state to localStorage:', e);
    }
    setLayoutKey(Date.now());
    
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'Workspace layout reset to default' }));
  }, []);

  const applyPreset = useCallback((presetId: string) => {
    const allPresets = [...BUILTIN_PRESETS, ...customPresets];
    const targetPreset = allPresets.find(p => p.id === presetId);
    if (!targetPreset) return;

    setLayoutState((prev) => {
      const newPanels = { ...prev.panels };
      for (const [pId, pConfig] of Object.entries(targetPreset.panels)) {
        const id = pId as PanelId;
        if (newPanels[id] && pConfig && typeof pConfig === 'object') {
          newPanels[id] = {
            ...newPanels[id],
            ...pConfig
          };
        }
      }

      return {
        ...prev,
        activePresetId: presetId,
        panels: newPanels,
        panelGroupSizes: {
          ...prev.panelGroupSizes,
          ...targetPreset.panelGroupSizes
        },
        lastUpdated: Date.now()
      };
    });

    setLayoutKey(Date.now());
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Layout applied: ${targetPreset.name}` }));
  }, [customPresets]);

  const saveCustomPreset = useCallback((name: string, description?: string) => {
    const panelsMap = (Object.keys(layoutState.panels) as PanelId[]).reduce((acc, k) => {
      const p = layoutState.panels[k];
      if (p) {
        acc[k] = { 
          visible: p.visible, 
          visibility: p.visible, 
          isCollapsed: p.isCollapsed, 
          collapsed: p.isCollapsed, 
          isDocked: p.isDocked,
          size: p.size 
        };
      }
      return acc;
    }, {} as Record<PanelId, Partial<PanelState>>);

    const newPreset: WorkspacePreset = {
      id: `custom_${Date.now()}`,
      name: name.trim() || `Custom Preset ${customPresets.length + 1}`,
      description: description || 'User custom workspace layout configuration',
      isBuiltIn: false,
      panels: panelsMap,
      panelGroupSizes: layoutState.panelGroupSizes
    };

    setCustomPresets(prev => [...prev, newPreset]);
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Preset saved: ${newPreset.name}` }));
  }, [customPresets.length, layoutState]);

  const deleteCustomPreset = useCallback((presetId: string) => {
    setCustomPresets(prev => prev.filter(p => p.id !== presetId));
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'Custom preset deleted' }));
  }, []);

  const allPresets = useMemo(() => [...BUILTIN_PRESETS, ...customPresets], [customPresets]);

  const value = useMemo<WorkspaceLayoutContextType>(() => ({
    state: layoutState,
    panels: layoutState.panels,
    activePresetId: layoutState.activePresetId,
    presets: allPresets,
    customPresets,
    getPanel,
    updatePanelSize,
    updatePanelCollapsed,
    setPanelCollapsed,
    togglePanelCollapsed,
    updatePanelVisibility,
    setPanelVisibility,
    togglePanelVisibility,
    togglePanelDock,
    setPanelDocked,
    updateFloatingPosition,
    bringToFront,
    resetLayout,
    applyPreset,
    saveCustomPreset,
    deleteCustomPreset,
    updateGroupSizes,
    layoutKey
  }), [
    layoutState,
    allPresets,
    customPresets,
    getPanel,
    updatePanelSize,
    updatePanelCollapsed,
    setPanelCollapsed,
    togglePanelCollapsed,
    updatePanelVisibility,
    setPanelVisibility,
    togglePanelVisibility,
    togglePanelDock,
    setPanelDocked,
    updateFloatingPosition,
    bringToFront,
    resetLayout,
    applyPreset,
    saveCustomPreset,
    deleteCustomPreset,
    updateGroupSizes,
    layoutKey
  ]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};

// Export useWorkspaceLayout hook
export const useWorkspaceLayout = (): WorkspaceLayoutContextType => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspaceLayout must be used within a WorkspaceProvider');
  }
  return context;
};

// Alias useWorkspace to useWorkspaceLayout for backwards compatibility
export const useWorkspace = useWorkspaceLayout;
export default useWorkspaceLayout;

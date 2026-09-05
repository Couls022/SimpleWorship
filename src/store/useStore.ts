import { create } from 'zustand';
import { 
  Profile, 
  PresentationState, 
  OutputGroup, 
  RouterPanelState,
  Schedule, 
  PresentationItem, 
  Song, 
  ScriptureVerse, 
  Asset, 
  Theme, 
  AlertState, 
  SystemOptions, 
  ShortcutSettings,
  SlideAnnotationState,
  AnnotationToolType,
  AnnotationStroke,
  LaserPointerState
} from '../types';
import { dbApi } from '../db';
import { defaultOutputGroups, defaultSchedule, defaultSongs, defaultThemes, defaultAssets, defaultScriptures } from '../db/seedData';
import { defaultSystemOptions } from '../db/defaultOptions';
import { DEFAULT_SIMPLEWORSHIP_MAPPINGS } from '../utils/keyboardShortcuts';
import { ThemeEngine } from '../core/ThemeEngine';
import { v4 as uuidv4 } from 'uuid';

import { broadcastStateChange, sanitizeForSync } from '../utils/broadcastSync';
import { DisplayManager } from '../core/DisplayManager';

const defaultShortcutSettings: ShortcutSettings = {
  arrowControlsLive: true,
  spacebarAdvancesLive: true,
  enterGoesLive: true,
  singleClickGoLive: false,
  numericQuickJump: true,
  quickKeysBcl: true,
  wrapAroundSlides: false,
  presetName: 'SimpleWorship',
  keyMappings: { ...DEFAULT_SIMPLEWORSHIP_MAPPINGS },
};

const getStoredProfiles = () => {
  try {
    const saved = localStorage.getItem('simpleworship_profiles_v1');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Error loading profiles', e);
  }
  return [{ id: 'default', name: 'Default', isDefault: true }];
};

const getStoredActiveProfile = () => {
  try {
    const saved = localStorage.getItem('simpleworship_active_profile_v1');
    if (saved) return saved;
  } catch (e) {}
  return 'default';
};

const getStoredShortcuts = (): ShortcutSettings => {
  try {
    const saved = localStorage.getItem('simpleworship_shortcuts_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { 
        ...defaultShortcutSettings, 
        ...parsed,
        keyMappings: {
          ...DEFAULT_SIMPLEWORSHIP_MAPPINGS,
          ...(parsed.keyMappings || {})
        }
      };
    }
  } catch (e) {
    console.error('Error loading stored shortcuts', e);
  }
  return defaultShortcutSettings;
};

const getStoredOptions = (): SystemOptions => {
  try {
    const saved = localStorage.getItem('simpleworship_system_options_v1');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error loading stored options', e);
  }
  return defaultSystemOptions;
};

const defaultState: PresentationState = {
  activeScheduleId: null,
  activeItemId: null,
  activeSlideIndex: 0,
  nextSlideIndex: 1,
  isBlack: false,
  isClear: false,
  showLogo: false,
  timestamp: Date.now(),
  isVideoPlaying: true,
  isVideoMuted: false,
  isVideoLooping: true,
  videoVolume: 1,
  videoCurrentTime: 0,
  videoDuration: 0,
  isLiveEnabled: false,
};

const defaultAnnotationState: SlideAnnotationState = {
  enabled: false,
  activeTool: 'pen',
  activeColor: '#FF2A4D',
  strokeSize: 6,
  opacity: 0.9,
  persistAcrossSlides: true,
  strokes: [],
  redoStack: [],
  laserPointer: undefined,
};

interface AppState {
  // Profiles
  profiles: Profile[];
  activeProfileId: string;
  addProfile: (profile: Profile) => void;
  updateProfile: (id: string, updates: Partial<Profile>) => void;
  removeProfile: (id: string) => void;
  setActiveProfile: (id: string) => void;

  // Shortcut Key Settings
  shortcutSettings: ShortcutSettings;
  updateShortcutSettings: (updates: Partial<ShortcutSettings> | ((prev: ShortcutSettings) => ShortcutSettings)) => void;
  resetShortcutSettings: () => void;

  // System Options & Preferences
  systemOptions: SystemOptions;
  updateSystemOptions: (updates: Partial<SystemOptions> | ((prev: SystemOptions) => SystemOptions)) => void;
  resetSystemOptions: () => void;

  // Router Panels
  routerPanels: RouterPanelState[];
  activeRouterId: string | null;
  addRouterPanel: (panel: RouterPanelState) => void;
  removeRouterPanel: (id: string) => void;
  updateRouterPanel: (id: string, updates: Partial<RouterPanelState>) => void;
  setActiveRouterId: (id: string | null) => void;

  // Config
  outputGroups: OutputGroup[];
  setOutputGroups: (groups: OutputGroup[]) => void;
  reorderOutputGroups: (sourceIndex: number, destinationIndex: number) => void;
  moveOutputGroup: (id: string, direction: 'left' | 'right' | 'first' | 'last') => void;
  addOutputGroup: (group: OutputGroup) => void;
  updateOutputGroup: (id: string, updates: Partial<OutputGroup>) => void;
  removeOutputGroup: (id: string) => void;
  setLivePanelCount: (count: number) => void;
  
  // Presentation States (per group for LIVE)
  groupStates: Record<string, PresentationState>;
  setGroupState: (groupId: string, state: Partial<PresentationState>) => void;
  
  // Moderator Control Target
  activeControlGroupId: string | null;
  setActiveControlGroupId: (id: string | null) => void;

  // Active Schedule
  activeSchedule: Schedule | null;
  setActiveSchedule: (schedule: Schedule | null) => void;
  addScheduleItem: (item: Partial<PresentationItem>) => void;
  removeScheduleItem: (itemId: string) => void;
  updateScheduleItem: (itemId: string, updates: Partial<PresentationItem>) => void;
  reorderSchedule: (items: PresentationItem[]) => void;
  toggleScheduleItemExpand: (itemId: string) => void;
  
  // Routing Request for Double Clicks
  routingRequest: { item: Partial<PresentationItem>; isNew: boolean; slideIndex?: number } | null;
  setRoutingRequest: (req: { item: Partial<PresentationItem>; isNew: boolean; slideIndex?: number } | null) => void;

  // PREVIEW State (Independent from Live, matching EasyWorship design)
  previewItemId: string | null;
  previewSlideIndex: number;
  setPreviewItem: (itemOrId: string | null | Partial<PresentationItem>, slideIndex?: number) => void;
  setPreviewSlide: (index: number) => void;
  goLive: () => void; // Pushes preview state to live
  goLiveItem: (itemId: string, slideIndex?: number, targetGroupId?: string, directItem?: PresentationItem) => void; // Directly sends item to live

  // LIVE Navigation & Controls
  goLiveNext: () => void;
  goLivePrev: () => void;
  goNextScheduleItem: () => void;
  goPrevScheduleItem: () => void;
  toggleBlack: () => void;
  toggleClear: () => void;
  toggleLogo: () => void;
  isMasterLive?: boolean; // Deprecated, keep for backwards compatibility if needed, but we don't need it.
  toggleMasterLive: () => void;

  // Alert / Nursery Ticker
  alert: AlertState;
  setAlert: (alert: Partial<AlertState>) => void;

  // Slide Annotation State
  annotationState: SlideAnnotationState;
  setAnnotationTool: (tool: AnnotationToolType) => void;
  setAnnotationColor: (color: string) => void;
  setAnnotationSize: (size: number) => void;
  setAnnotationOpacity: (opacity: number) => void;
  setAnnotationPersist: (persist: boolean) => void;
  toggleAnnotationMode: (enabled?: boolean) => void;
  addAnnotationStroke: (stroke: AnnotationStroke) => void;
  clearAnnotations: () => void;
  undoAnnotation: () => void;
  redoAnnotation: () => void;
  updateLaserPointer: (laser: Partial<LaserPointerState> | null) => void;

  // Resources Data State
  resourcesTab: 'songs' | 'scriptures' | 'media' | 'presentations' | 'themes' | 'cameras';
  setResourcesTab: (tab: 'songs' | 'scriptures' | 'media' | 'presentations' | 'themes' | 'cameras') => void;
  isResourcesOpen: boolean;
  setIsResourcesOpen: (open: boolean) => void;
  toggleResources: () => void;

  songsList: Song[];
  scripturesList: ScriptureVerse[];
  assetsList: Asset[];
  themesList: Theme[];
  availableCameras: any[];
  setAvailableCameras: (cameras: any[]) => void;
  
  loadAllData: () => Promise<void>;
  addSong: (song: Song) => Promise<void>;
  deleteSong: (id: string) => Promise<void>;
  saveTheme: (theme: Theme) => Promise<void>;
  deleteTheme: (id: string) => Promise<void>;
  addAsset: (asset: Asset) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  setDefaultBackground: (assetUrl: string, scope: 'songs' | 'scriptures' | 'presentations' | 'announcements' | 'logo', isVideo?: boolean) => void;
}

export const useStore = create<AppState>((set, get) => ({
  profiles: getStoredProfiles(),
  activeProfileId: getStoredActiveProfile(),
  addProfile: (profile) => set((state) => {
    const next = [...state.profiles, profile];
    localStorage.setItem('simpleworship_profiles_v1', JSON.stringify(next));
    return { profiles: next };
  }),
  updateProfile: (id, updates) => set((state) => {
    const next = state.profiles.map(p => p.id === id ? { ...p, ...updates } : p);
    localStorage.setItem('simpleworship_profiles_v1', JSON.stringify(next));
    return { profiles: next };
  }),
  removeProfile: (id) => set((state) => {
    const next = state.profiles.filter(p => p.id !== id);
    const nextActive = state.activeProfileId === id ? 'default' : state.activeProfileId;
    localStorage.setItem('simpleworship_profiles_v1', JSON.stringify(next));
    localStorage.setItem('simpleworship_active_profile_v1', nextActive);
    return { profiles: next, activeProfileId: nextActive };
  }),
  setActiveProfile: (id) => set((state) => {
    localStorage.setItem('simpleworship_active_profile_v1', id);
    return { activeProfileId: id };
  }),

  shortcutSettings: getStoredShortcuts(),
  updateShortcutSettings: (updates) => {
    set((state) => {
      const next = typeof updates === 'function' ? updates(state.shortcutSettings) : { ...state.shortcutSettings, ...updates };
      try {
        localStorage.setItem('simpleworship_shortcuts_v1', JSON.stringify(next));
      } catch (e) {
        console.error('Error saving shortcut settings', e);
      }
      return { shortcutSettings: next };
    });
  },
  resetShortcutSettings: () => {
    try {
      localStorage.removeItem('simpleworship_shortcuts_v1');
    } catch (e) {}
    set({ shortcutSettings: defaultShortcutSettings });
  },

  systemOptions: getStoredOptions(),
  updateSystemOptions: (updates) => {
    set((state) => {
      const next = typeof updates === 'function' ? updates(state.systemOptions) : { ...state.systemOptions, ...updates };
      try {
        localStorage.setItem('simpleworship_system_options_v1', JSON.stringify(next));
      } catch (e) {
        console.error('Error saving system options', e);
      }
      dbApi.saveSystemOptions(next);

      // Sync system font options into default themes for song, scripture/bible, presentation, and global
      const songFontStyles = ThemeEngine.fontStyleToThemeStyles(next.mainOutput?.song?.songFont);
      const scriptureFontStyles = ThemeEngine.fontStyleToThemeStyles(next.mainOutput?.scripture?.scriptureFont);
      const presentationFontStyles = ThemeEngine.fontStyleToThemeStyles(next.mainOutput?.presentations?.contentFont);
      const globalFontStyles = ThemeEngine.fontStyleToThemeStyles(next.mainOutput?.general?.defaultFont);

      const updatedThemes = state.themesList.map(t => {
        if (t.type === 'song') {
          return { ...t, styles: { ...t.styles, ...songFontStyles } };
        }
        if (t.type === 'bible') {
          return { ...t, styles: { ...t.styles, ...scriptureFontStyles } };
        }
        if (t.type === 'presentation' || t.type === 'announcement') {
          return { ...t, styles: { ...t.styles, ...presentationFontStyles } };
        }
        if (t.type === 'global') {
          return { ...t, styles: { ...t.styles, ...globalFontStyles } };
        }
        return t;
      });

      updatedThemes.forEach(t => dbApi.addTheme(t));

      // Trigger timestamp update on all groupStates so live displays re-render instantly
      const updatedGroupStates = { ...state.groupStates };
      Object.keys(updatedGroupStates).forEach(groupId => {
        if (updatedGroupStates[groupId]) {
          updatedGroupStates[groupId] = {
            ...updatedGroupStates[groupId],
            timestamp: Date.now(),
          };
        }
      });

      // Broadcast system options change to any open projector or secondary monitor windows
      broadcastStateChange({ 
        type: 'SYSTEM_UPDATE', 
        data: { systemOptions: next, themesList: updatedThemes } 
      });
      broadcastStateChange({ type: 'GROUP_STATES_UPDATE', data: { groupStates: updatedGroupStates } });

      return {
        systemOptions: next,
        themesList: updatedThemes,
        groupStates: updatedGroupStates,
      };
    });
  },
  resetSystemOptions: () => {
    try {
      localStorage.removeItem('simpleworship_system_options_v1');
    } catch (e) {}
    set((state) => {
      const next = defaultSystemOptions;
      dbApi.saveSystemOptions(next);

      const updatedGroupStates = { ...state.groupStates };
      Object.keys(updatedGroupStates).forEach(groupId => {
        if (updatedGroupStates[groupId]) {
          updatedGroupStates[groupId] = {
            ...updatedGroupStates[groupId],
            timestamp: Date.now(),
          };
        }
      });

      broadcastStateChange({ type: 'SYSTEM_UPDATE', data: { systemOptions: next } });
      broadcastStateChange({ type: 'GROUP_STATES_UPDATE', data: { groupStates: updatedGroupStates } });

      return {
        systemOptions: next,
        groupStates: updatedGroupStates,
      };
    });
  },

  // Router Panels
  routerPanels: [
    {
      routerId: 'router-1',
      targetOutputGroupId: 'group-congregation',
      active: true,
      visible: true,
      focused: true
    }
  ],
  activeRouterId: 'router-1',
  addRouterPanel: (panel) => set((state) => {
    const panels = [...state.routerPanels, panel];
    return {
      routerPanels: panels,
      activeRouterId: panel.routerId,
      activeControlGroupId: panel.targetOutputGroupId
    };
  }),
  removeRouterPanel: (id) => set((state) => {
    const panels = state.routerPanels.filter(p => p.routerId !== id);
    const newActiveId = state.activeRouterId === id ? (panels[0]?.routerId || null) : state.activeRouterId;
    const newActiveTarget = panels.find(p => p.routerId === newActiveId)?.targetOutputGroupId || null;
    return {
      routerPanels: panels.map(p => ({
        ...p,
        active: p.routerId === newActiveId
      })),
      activeRouterId: newActiveId,
      activeControlGroupId: newActiveTarget
    };
  }),
  updateRouterPanel: (id, updates) => set((state) => {
    const panels = state.routerPanels.map(p => p.routerId === id ? { ...p, ...updates } : p);
    const activeTarget = panels.find(p => p.routerId === state.activeRouterId)?.targetOutputGroupId || null;
    return { 
      routerPanels: panels,
      activeControlGroupId: activeTarget
    };
  }),
  setActiveRouterId: (id) => {
    set((state) => {
      const panels = state.routerPanels.map(p => ({
        ...p,
        active: p.routerId === id,
        focused: p.routerId === id ? true : p.focused
      }));
      const newActiveTarget = panels.find(p => p.routerId === id)?.targetOutputGroupId || null;
      return {
        activeRouterId: id,
        routerPanels: panels,
        activeControlGroupId: newActiveTarget
      };
    });
    const { outputGroups, groupStates, activeControlGroupId } = get();
    DisplayManager.syncPhysicalDisplays(outputGroups, groupStates, activeControlGroupId).catch(() => {});
  },

  outputGroups: defaultOutputGroups,
  setOutputGroups: (groups) => {
    set((state) => {
      const newStates = { ...state.groupStates };
      groups.forEach(g => {
        if (!newStates[g.id]) newStates[g.id] = { ...defaultState, timestamp: Date.now() };
      });
      const newActive = state.activeControlGroupId || (groups.length > 0 ? groups[0].id : null);
      return { outputGroups: groups, groupStates: newStates, activeControlGroupId: newActive };
    });
  },
  reorderOutputGroups: (sourceIndex: number, destinationIndex: number) => {
    set((state) => {
      if (
        sourceIndex < 0 || 
        sourceIndex >= state.outputGroups.length || 
        destinationIndex < 0 || 
        destinationIndex >= state.outputGroups.length || 
        sourceIndex === destinationIndex
      ) {
        return state;
      }
      const newGroups = [...state.outputGroups];
      const [moved] = newGroups.splice(sourceIndex, 1);
      newGroups.splice(destinationIndex, 0, moved);

      try {
        localStorage.setItem('simpleworship_output_groups_order', JSON.stringify(newGroups.map(g => g.id)));
      } catch {}

      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', { 
          detail: `Panels rearranged: "${moved.name}" moved to position #${destinationIndex + 1}` 
        })
      );

      return { outputGroups: newGroups };
    });
  },
  moveOutputGroup: (id: string, direction: 'left' | 'right' | 'first' | 'last') => {
    set((state) => {
      const idx = state.outputGroups.findIndex(g => g.id === id);
      if (idx === -1) return state;
      let targetIdx = idx;
      if (direction === 'left') targetIdx = Math.max(0, idx - 1);
      else if (direction === 'right') targetIdx = Math.min(state.outputGroups.length - 1, idx + 1);
      else if (direction === 'first') targetIdx = 0;
      else if (direction === 'last') targetIdx = state.outputGroups.length - 1;

      if (targetIdx === idx) return state;

      const newGroups = [...state.outputGroups];
      const [moved] = newGroups.splice(idx, 1);
      newGroups.splice(targetIdx, 0, moved);

      try {
        localStorage.setItem('simpleworship_output_groups_order', JSON.stringify(newGroups.map(g => g.id)));
      } catch {}

      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', { 
          detail: `Panel "${moved.name}" shifted ${direction} (Position #${targetIdx + 1})` 
        })
      );

      return { outputGroups: newGroups };
    });
  },
  addOutputGroup: (group) => {
    set((state) => ({ 
      outputGroups: [...state.outputGroups, group],
      groupStates: { ...state.groupStates, [group.id]: { ...defaultState, timestamp: Date.now() } }
    }));
    dbApi.saveOutputGroup(group);
  },
  updateOutputGroup: (id, updates) => {
    set((state) => {
      const groupIndex = state.outputGroups.findIndex((g) => g.id === id);
      if (groupIndex === -1) return state;
      const updatedGroup = { ...state.outputGroups[groupIndex], ...updates };
      const newGroups = [...state.outputGroups];
      newGroups[groupIndex] = updatedGroup;
      dbApi.saveOutputGroup(updatedGroup);

      DisplayManager.syncPhysicalDisplays(newGroups, state.groupStates, state.activeControlGroupId).catch(() => {});

      return { outputGroups: newGroups };
    });
  },
  setLivePanelCount: async (count) => {
    const state = get();
    let current = [...state.outputGroups];
    if (current.length === count) return;
    
    const newGroupStates = { ...state.groupStates };
    
    if (current.length > count) {
      const toRemove = current.slice(count);
      current = current.slice(0, count);
      
      // Clean up deleted panel states
      toRemove.forEach(g => {
        delete newGroupStates[g.id];
      });
      
      await Promise.all(toRemove.map(g => dbApi.deleteOutputGroup(g.id)));
    } else {
      const toAdd: any[] = [];
      for (let i = current.length; i < count; i++) {
        const id = `group-dynamic-${Date.now()}-${i}`;
        const newGroup = {
          id,
          name: i === 0 ? 'Main Sanctuary' : `Display ${i + 1}`,
          role: i === 1 ? "confidence" : "broadcast",
          displayIds: [],
          isBlack: false,
          isClear: false,
          showLogo: true
        };
        toAdd.push(newGroup);
        
        // Initialize dynamic panel's reactive state
        newGroupStates[id] = {
          ...defaultState,
          isLiveEnabled: true,
          timestamp: Date.now()
        };
      }
      current = [...current, ...toAdd];
      await Promise.all(toAdd.map(g => dbApi.saveOutputGroup(g)));
    }
    
    // Auto-update active control group if it was removed
    let newActive = state.activeControlGroupId;
    if (newActive && !current.some(g => g.id === newActive)) {
      newActive = current.length > 0 ? current[0].id : null;
    }
    
    set({ 
      outputGroups: current, 
      groupStates: newGroupStates, 
      activeControlGroupId: newActive 
    });
    
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Enterprise Output Channels synchronized to ${count} panels` 
      })
    );
  },
  removeOutputGroup: (id) => set((state) => {
    const newGroups = state.outputGroups.filter(g => g.id !== id);
    const newStates = { ...state.groupStates };
    delete newStates[id];
    let newActive = state.activeControlGroupId;
    if (newActive === id) {
      newActive = newGroups.length > 0 ? newGroups[0].id : null;
    }
    return { outputGroups: newGroups, groupStates: newStates, activeControlGroupId: newActive };
  }),
  
  groupStates: {
    'group-congregation': { ...defaultState, activeItemId: null, activeSlideIndex: 0, timestamp: Date.now(), isLiveEnabled: false },
    'group-stage': { ...defaultState, activeItemId: null, activeSlideIndex: 0, timestamp: Date.now(), isLiveEnabled: false },
  },
  setGroupState: (groupId, newState) => {
    set((state) => {
      const current = state.groupStates[groupId] || defaultState;
      const updatedGroupStates = {
        ...state.groupStates,
        [groupId]: { ...current, ...newState, timestamp: Date.now() }
      };

      try {
        const sanitized = sanitizeForSync(updatedGroupStates);
        localStorage.setItem('simpleworship_group_states_v1', JSON.stringify(sanitized));
      } catch (e) {}

      broadcastStateChange({
        type: 'GROUP_STATES_UPDATE',
        data: { groupStates: updatedGroupStates }
      });

      if (newState.isLiveEnabled !== undefined && newState.isLiveEnabled !== current.isLiveEnabled) {
        DisplayManager.syncPhysicalDisplays(state.outputGroups, updatedGroupStates, state.activeControlGroupId).catch(() => {});
      }

      return {
        groupStates: updatedGroupStates
      };
    });
  },

  activeControlGroupId: 'group-congregation',
  setActiveControlGroupId: (id) => {
    set((state) => {
      if (!state.activeRouterId) return { activeControlGroupId: id };
      const panels = state.routerPanels.map(p => 
        p.routerId === state.activeRouterId ? { ...p, targetOutputGroupId: id } : p
      );
      return { 
        routerPanels: panels,
        activeControlGroupId: id 
      };
    });
    const { outputGroups, groupStates } = get();
    DisplayManager.syncPhysicalDisplays(outputGroups, groupStates, id).catch(() => {});
  },

  activeSchedule: defaultSchedule,
  setActiveSchedule: (schedule) => set({ activeSchedule: schedule }),

  addScheduleItem: (item) => {
    set((state) => {
      if (!state.activeSchedule) return state;
      const newItem: PresentationItem = {
        id: item.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: item.type || 'song',
        contentId: item.contentId || '',
        name: item.name || 'New Item',
        notes: item.notes || '',
        isExpanded: false,
        customBackgroundUrl: item.customBackgroundUrl,
        data: item.data,
      };
      const updatedSchedule = {
        ...state.activeSchedule,
        items: [...state.activeSchedule.items, newItem]
      };
      dbApi.addSchedule(updatedSchedule);
      return { activeSchedule: updatedSchedule };
    });
  },

  removeScheduleItem: (itemId) => {
    set((state) => {
      if (!state.activeSchedule) return state;
      const updatedSchedule = {
        ...state.activeSchedule,
        items: state.activeSchedule.items.filter(i => i.id !== itemId)
      };
      dbApi.addSchedule(updatedSchedule);
      return { activeSchedule: updatedSchedule };
    });
  },

  updateScheduleItem: (itemId, updates) => {
    set((state) => {
      if (!state.activeSchedule) return state;
      const updatedSchedule = {
        ...state.activeSchedule,
        items: state.activeSchedule.items.map(i => i.id === itemId ? { ...i, ...updates } : i)
      };
      
      const newGroupStates = { ...state.groupStates };
      let groupsUpdated = false;
      
      Object.keys(newGroupStates).forEach(groupId => {
        if (newGroupStates[groupId].activeItemId === itemId && newGroupStates[groupId].directLiveItem) {
          newGroupStates[groupId] = {
            ...newGroupStates[groupId],
            directLiveItem: {
              ...newGroupStates[groupId].directLiveItem!,
              ...updates,
              data: {
                ...(newGroupStates[groupId].directLiveItem!.data || {}),
                ...(updates.data || {})
              }
            }
          };
          groupsUpdated = true;
        }
      });
      
      dbApi.addSchedule(updatedSchedule);
      
      if (groupsUpdated) {
        broadcastStateChange({
          type: 'GROUP_STATES_UPDATE',
          data: { groupStates: newGroupStates }
        });
        return { activeSchedule: updatedSchedule, groupStates: newGroupStates };
      }
      
      return { activeSchedule: updatedSchedule };
    });
  },

  reorderSchedule: (items) => {
    set((state) => {
      if (!state.activeSchedule) return state;
      const updatedSchedule = { ...state.activeSchedule, items };
      dbApi.addSchedule(updatedSchedule);
      return { activeSchedule: updatedSchedule };
    });
  },

  toggleScheduleItemExpand: (itemId) => {
    set((state) => {
      if (!state.activeSchedule) return state;
      return {
        activeSchedule: {
          ...state.activeSchedule,
          items: state.activeSchedule.items.map(i => i.id === itemId ? { ...i, isExpanded: !i.isExpanded } : i)
        }
      };
    });
  },

  routingRequest: null,
  setRoutingRequest: (req) => set({ routingRequest: req }),

  // PREVIEW
  previewItemId: 'item-gen-1', // Default preview item (Genesis 1:1) matching screenshot
  previewSlideIndex: 0,
  setPreviewItem: (itemOrId, slideIndex = 0) => {
    if (!itemOrId) {
      set({ previewItemId: null, previewSlideIndex: slideIndex });
      return;
    }
    if (typeof itemOrId === 'string') {
      set({ previewItemId: itemOrId, previewSlideIndex: slideIndex });
    } else {
      const state = get();
      const existing = state.activeSchedule?.items.find(
        i => i.id === itemOrId.id || (itemOrId.contentId && i.contentId === itemOrId.contentId)
      );
      if (existing) {
        set({ previewItemId: existing.id, previewSlideIndex: slideIndex });
      } else {
        const newItem: PresentationItem = {
          id: itemOrId.id || `item-${Date.now()}`,
          type: itemOrId.type || 'song',
          contentId: itemOrId.contentId || '',
          name: itemOrId.name || 'Preview Item',
          notes: itemOrId.notes || '',
          isExpanded: false,
          customBackgroundUrl: itemOrId.customBackgroundUrl,
          data: itemOrId.data,
        };
        if (state.activeSchedule) {
          const updatedSchedule = {
            ...state.activeSchedule,
            items: [...state.activeSchedule.items, newItem]
          };
          set({ activeSchedule: updatedSchedule, previewItemId: newItem.id, previewSlideIndex: slideIndex });
        } else {
          set({ previewItemId: newItem.id, previewSlideIndex: slideIndex });
        }
      }
    }
  },
  setPreviewSlide: (index) => set({ previewSlideIndex: index }),

  goLive: () => {
    const { previewItemId, previewSlideIndex, activeControlGroupId, activeSchedule, groupStates, setRoutingRequest, goLiveItem } = get();
    
    let itemIdToUse = previewItemId;
    let slideIdxToUse = previewSlideIndex;

    if (!itemIdToUse && activeSchedule && activeSchedule.items.length > 0) {
      itemIdToUse = activeSchedule.items[0].id;
      slideIdxToUse = 0;
    } else if (!itemIdToUse && activeControlGroupId && groupStates[activeControlGroupId]?.activeItemId) {
      itemIdToUse = groupStates[activeControlGroupId].activeItemId;
      slideIdxToUse = groupStates[activeControlGroupId].activeSlideIndex || 0;
    }

    if (!itemIdToUse) return;

    const itemToRoute = activeSchedule?.items?.find(i => i.id === itemIdToUse);
    if (itemToRoute) {
      setRoutingRequest({ item: itemToRoute, isNew: false, slideIndex: slideIdxToUse });
    } else {
      get().goLiveItem(itemIdToUse, slideIdxToUse, activeControlGroupId);
    }
  },

  goLiveItem: (itemId, slideIndex = 0, targetGroupId, directItem) => {
    const { activeControlGroupId, setGroupState, outputGroups, activeSchedule, songsList } = get();
    const groupToUpdate = targetGroupId || activeControlGroupId || (outputGroups.length > 0 ? outputGroups[0].id : undefined);

    set({ previewItemId: itemId, previewSlideIndex: slideIndex });

    // Find presentation item or construct one for direct live persistence
    let liveItem: PresentationItem | undefined = directItem || activeSchedule?.items?.find(i => i.id === itemId);
    if (!liveItem) {
      const song = songsList.find(s => s.id === itemId);
      if (song) {
        liveItem = {
          id: song.id,
          type: 'song',
          name: song.title,
          contentId: song.id,
          notes: song.author || '',
          isExpanded: false,
          customBackgroundUrl: song.defaultBackgroundUrl
        };
      }
    }

    if (groupToUpdate) {
      setGroupState(groupToUpdate, {
        activeItemId: itemId,
        activeSlideIndex: slideIndex,
        directLiveItem: liveItem || null,
        isBlack: false,
        isClear: false,
      });
      if (groupToUpdate !== activeControlGroupId) {
        set({ activeControlGroupId: groupToUpdate });
        DisplayManager.syncPhysicalDisplays(outputGroups, get().groupStates, groupToUpdate).catch(() => {});
      }
    } else if (outputGroups.length > 0) {
      outputGroups.forEach(g => {
        setGroupState(g.id, {
          activeItemId: itemId,
          activeSlideIndex: slideIndex,
          directLiveItem: liveItem || null,
          isBlack: false,
          isClear: false,
        });
      });
    }

    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `GO LIVE: Output updated successfully!` 
      })
    );
  },

  // LIVE Navigation & Controls
  goLiveNext: () => {
    const { activeControlGroupId, groupStates, activeSchedule, songsList, shortcutSettings } = get();
    if (!activeControlGroupId) return;
    const currentState = groupStates[activeControlGroupId] || defaultState;
    const currentItemId = currentState.activeItemId;

    let totalSlides = 999;
    if (currentItemId) {
      const scheduleItem = activeSchedule?.items?.find(i => i.id === currentItemId);
      if (scheduleItem?.data?.slides?.length) {
        totalSlides = scheduleItem.data.slides.length;
      } else {
        const song = songsList.find(s => s.id === currentItemId);
        if (song?.sections?.length) {
          totalSlides = song.sections.length;
        } else if (song?.lyrics) {
          totalSlides = song.lyrics.split(/\n\s*\n/).length;
        }
      }
    }

    let nextIndex = currentState.activeSlideIndex + 1;
    if (nextIndex >= totalSlides) {
      if (shortcutSettings.wrapAroundSlides) {
        nextIndex = 0;
      } else {
        nextIndex = Math.max(0, totalSlides - 1);
      }
    }
    get().setGroupState(activeControlGroupId, { activeSlideIndex: nextIndex });
  },
  
  goLivePrev: () => {
    const { activeControlGroupId, groupStates, activeSchedule, songsList, shortcutSettings } = get();
    if (!activeControlGroupId) return;
    const currentState = groupStates[activeControlGroupId] || defaultState;
    const currentItemId = currentState.activeItemId;

    let prevIndex = currentState.activeSlideIndex - 1;
    if (prevIndex < 0) {
      if (shortcutSettings.wrapAroundSlides) {
        let totalSlides = 1;
        if (currentItemId) {
          const scheduleItem = activeSchedule?.items?.find(i => i.id === currentItemId);
          if (scheduleItem?.data?.slides?.length) {
            totalSlides = scheduleItem.data.slides.length;
          } else {
            const song = songsList.find(s => s.id === currentItemId);
            if (song?.sections?.length) {
              totalSlides = song.sections.length;
            } else if (song?.lyrics) {
              totalSlides = song.lyrics.split(/\n\s*\n/).length;
            }
          }
        }
        prevIndex = Math.max(0, totalSlides - 1);
      } else {
        prevIndex = 0;
      }
    }
    get().setGroupState(activeControlGroupId, { activeSlideIndex: prevIndex });
  },

  goNextScheduleItem: () => {
    const { activeSchedule, activeControlGroupId, groupStates, previewItemId, goLiveItem } = get();
    if (!activeSchedule || !activeSchedule.items || activeSchedule.items.length === 0) return;
    
    const currentItemId = (activeControlGroupId && groupStates[activeControlGroupId]?.activeItemId) || previewItemId;
    const currentIndex = activeSchedule.items.findIndex(i => i.id === currentItemId);
    
    let nextIndex = 0;
    if (currentIndex >= 0 && currentIndex < activeSchedule.items.length - 1) {
      nextIndex = currentIndex + 1;
    } else if (currentIndex === activeSchedule.items.length - 1) {
      nextIndex = 0;
    }
    
    const nextItem = activeSchedule.items[nextIndex];
    if (nextItem) {
      goLiveItem(nextItem.id, 0, activeControlGroupId || undefined);
      window.dispatchEvent(new CustomEvent('simpleworship:notify', { 
        detail: `Selected Next Item: ${nextItem.name}` 
      }));
    }
  },

  goPrevScheduleItem: () => {
    const { activeSchedule, activeControlGroupId, groupStates, previewItemId, goLiveItem } = get();
    if (!activeSchedule || !activeSchedule.items || activeSchedule.items.length === 0) return;
    
    const currentItemId = (activeControlGroupId && groupStates[activeControlGroupId]?.activeItemId) || previewItemId;
    const currentIndex = activeSchedule.items.findIndex(i => i.id === currentItemId);
    
    let prevIndex = 0;
    if (currentIndex > 0) {
      prevIndex = currentIndex - 1;
    } else if (currentIndex === 0) {
      prevIndex = activeSchedule.items.length - 1;
    }
    
    const prevItem = activeSchedule.items[prevIndex];
    if (prevItem) {
      goLiveItem(prevItem.id, 0, activeControlGroupId || undefined);
      window.dispatchEvent(new CustomEvent('simpleworship:notify', { 
        detail: `Selected Previous Item: ${prevItem.name}` 
      }));
    }
  },
  
  toggleBlack: () => {
    const { activeControlGroupId, outputGroups, groupStates } = get();
    const targetId = activeControlGroupId || outputGroups[0]?.id;
    if (!targetId) return;
    const currentState = groupStates[targetId] || defaultState;
    const nextBlack = !currentState.isBlack;
    const targetGroups = activeControlGroupId ? [activeControlGroupId] : outputGroups.map(g => g.id);
    targetGroups.forEach(gId => {
      get().setGroupState(gId, { isBlack: nextBlack, showLogo: false });
    });
  },
  
  toggleClear: () => {
    const { activeControlGroupId, outputGroups, groupStates } = get();
    const targetId = activeControlGroupId || outputGroups[0]?.id;
    if (!targetId) return;
    const currentState = groupStates[targetId] || defaultState;
    const nextClear = !currentState.isClear;
    const targetGroups = activeControlGroupId ? [activeControlGroupId] : outputGroups.map(g => g.id);
    targetGroups.forEach(gId => {
      get().setGroupState(gId, { isClear: nextClear });
    });
  },

  toggleLogo: () => {
    const { activeControlGroupId, outputGroups, groupStates } = get();
    const targetId = activeControlGroupId || outputGroups[0]?.id;
    if (!targetId) return;
    const currentState = groupStates[targetId] || defaultState;
    const nextLogo = !currentState.showLogo;
    const targetGroups = activeControlGroupId ? [activeControlGroupId] : outputGroups.map(g => g.id);
    targetGroups.forEach(gId => {
      get().setGroupState(gId, { showLogo: nextLogo, isBlack: false });
    });
  },

  toggleMasterLive: () => {
    const { activeControlGroupId, outputGroups, groupStates } = get();
    const targetId = activeControlGroupId || outputGroups[0]?.id;
    if (!targetId) return;
    const currentState = groupStates[targetId] || defaultState;
    const nextLive = !currentState.isLiveEnabled;
    const targetGroups = activeControlGroupId ? [activeControlGroupId] : outputGroups.map(g => g.id);
    const updatedStates = { ...groupStates };
    targetGroups.forEach(gId => {
      const currentG = updatedStates[gId] || defaultState;
      updatedStates[gId] = {
        ...currentG,
        isLiveEnabled: nextLive,
        timestamp: Date.now(),
      };
    });

    set({ groupStates: updatedStates });

    try {
      const sanitized = sanitizeForSync(updatedStates);
      localStorage.setItem('simpleworship_group_states_v1', JSON.stringify(sanitized));
    } catch (e) {}

    broadcastStateChange({
      type: 'GROUP_STATES_UPDATE',
      data: { groupStates: updatedStates }
    });

    // Synchronize physical projector windows immediately
    DisplayManager.syncPhysicalDisplays(outputGroups, updatedStates, activeControlGroupId).then(result => {
      if (result.conflicts && result.conflicts.length > 0) {
        const sameDispConflict = result.conflicts.find(c => c.message.includes('operator console'));
        if (sameDispConflict) {
          window.dispatchEvent(
            new CustomEvent('simpleworship:notify', { 
              detail: sameDispConflict.message 
            })
          );
        }
      }
    }).catch(err => {
      console.error('[useStore] DisplayManager.syncPhysicalDisplays error on toggleMasterLive:', err);
    });

    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: nextLive ? 'Live Output Connected & Enabled!' : 'Live Output Muted.' 
      })
    );
  },

  // Alert State
  alert: {
    active: false,
    message: 'Nursery #304 is requested in the Toddler Room',
    position: 'bottom',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    textColor: '#FACC15',
    speed: 15,
  },
  setAlert: (alertUpdate) => set((state) => ({ alert: { ...state.alert, ...alertUpdate } })),

  // Slide Annotation State & Methods
  annotationState: defaultAnnotationState,
  
  setAnnotationTool: (tool) => set((state) => ({
    annotationState: { 
      ...state.annotationState, 
      activeTool: tool,
      opacity: tool === 'highlighter' ? 0.4 : (tool === 'spotlight' ? 0.8 : (state.annotationState.opacity === 0.4 ? 0.9 : state.annotationState.opacity))
    }
  })),

  setAnnotationColor: (color) => set((state) => ({
    annotationState: { ...state.annotationState, activeColor: color }
  })),

  setAnnotationSize: (size) => set((state) => ({
    annotationState: { ...state.annotationState, strokeSize: size }
  })),

  setAnnotationOpacity: (opacity) => set((state) => ({
    annotationState: { ...state.annotationState, opacity }
  })),

  setAnnotationPersist: (persist) => set((state) => ({
    annotationState: { ...state.annotationState, persistAcrossSlides: persist }
  })),

  toggleAnnotationMode: (enabled) => set((state) => {
    const nextEnabled = enabled !== undefined ? enabled : !state.annotationState.enabled;
    return {
      annotationState: {
        ...state.annotationState,
        enabled: nextEnabled,
        laserPointer: nextEnabled ? state.annotationState.laserPointer : undefined
      }
    };
  }),

  addAnnotationStroke: (stroke) => set((state) => {
    const newStrokes = [...state.annotationState.strokes, stroke];
    return {
      annotationState: {
        ...state.annotationState,
        strokes: newStrokes,
        redoStack: []
      }
    };
  }),

  clearAnnotations: () => set((state) => ({
    annotationState: {
      ...state.annotationState,
      strokes: [],
      redoStack: [],
      laserPointer: undefined
    }
  })),

  undoAnnotation: () => set((state) => {
    if (state.annotationState.strokes.length === 0) return state;
    const strokes = [...state.annotationState.strokes];
    const popped = strokes.pop();
    if (!popped) return state;
    return {
      annotationState: {
        ...state.annotationState,
        strokes,
        redoStack: [...state.annotationState.redoStack, popped]
      }
    };
  }),

  redoAnnotation: () => set((state) => {
    if (state.annotationState.redoStack.length === 0) return state;
    const redoStack = [...state.annotationState.redoStack];
    const restored = redoStack.pop();
    if (!restored) return state;
    return {
      annotationState: {
        ...state.annotationState,
        strokes: [...state.annotationState.strokes, restored],
        redoStack
      }
    };
  }),

  updateLaserPointer: (laserUpdate) => set((state) => {
    if (!laserUpdate) {
      return {
        annotationState: {
          ...state.annotationState,
          laserPointer: undefined
        }
      };
    }
    const currentLaser = state.annotationState.laserPointer || {
      active: true,
      x: 0.5,
      y: 0.5,
      color: state.annotationState.activeColor,
      size: state.annotationState.strokeSize * 2,
      lastUpdated: Date.now()
    };
    return {
      annotationState: {
        ...state.annotationState,
        laserPointer: {
          ...currentLaser,
          ...laserUpdate,
          lastUpdated: Date.now()
        }
      }
    };
  }),

  // Resources State
  resourcesTab: 'media',
  setResourcesTab: (tab) => set({ resourcesTab: tab }),
  isResourcesOpen: true,
  setIsResourcesOpen: (open) => set({ isResourcesOpen: open }),
  toggleResources: () => set((state) => ({ isResourcesOpen: !state.isResourcesOpen })),

  songsList: defaultSongs,
  scripturesList: defaultScriptures,
  assetsList: defaultAssets,
  themesList: defaultThemes,
  availableCameras: [],
  setAvailableCameras: (cameras) => set({ availableCameras: cameras }),

  loadAllData: async () => {
    const [songs, themes, assets, outputGroups, schedules, scriptures] = await Promise.all([
      dbApi.getAllSongs(),
      dbApi.getAllThemes(),
      dbApi.getAllAssets(),
      dbApi.getOutputGroups(),
      dbApi.getAllSchedules(),
      dbApi.getAllScriptures(),
    ]);

    // Ensure all seed songs and Baptist Hymnal songs are populated
    let mergedSongs = songs;
    if (songs.length < defaultSongs.length) {
      const existingIds = new Set(songs.map(s => s.id));
      const missing = defaultSongs.filter(s => !existingIds.has(s.id));
      mergedSongs = [...songs, ...missing];
      missing.forEach(s => dbApi.addSong(s));
    }
    set({ songsList: mergedSongs.length > 0 ? mergedSongs : defaultSongs });

    // Ensure all default themes (including theme-logo, song, bible, etc.) exist
    let mergedThemes = [...themes];
    const existingThemeIds = new Set(themes.map(t => t.id));
    const missingDefaultThemes = defaultThemes.filter(t => !existingThemeIds.has(t.id));
    if (missingDefaultThemes.length > 0) {
      mergedThemes = [...mergedThemes, ...missingDefaultThemes];
      missingDefaultThemes.forEach(t => dbApi.addTheme(t));
    }
    set({ themesList: mergedThemes.length > 0 ? mergedThemes : defaultThemes });

    if (assets.length > 0) set({ assetsList: assets });
    
    // Ensure scriptures
    let mergedScriptures = scriptures;
    if (scriptures.length < defaultScriptures.length) {
      const existingIds = new Set(scriptures.map(sc => sc.id));
      const missing = defaultScriptures.filter(sc => !existingIds.has(sc.id));
      mergedScriptures = [...scriptures, ...missing];
      missing.forEach(sc => dbApi.addScripture(sc));
    }
    set({ scripturesList: mergedScriptures.length > 0 ? mergedScriptures : defaultScriptures });

    // Enforce exactly two default output groups with Live deactivated on every load
    try {
      const allExisting = await dbApi.getOutputGroups();
      await Promise.all(allExisting.map(g => dbApi.deleteOutputGroup(g.id)));
    } catch (e) {}

    for (const g of defaultOutputGroups) {
      await dbApi.saveOutputGroup(g);
    }
    set({ outputGroups: defaultOutputGroups });

    // Always reset/initialize group states so that Live is OFF (isLiveEnabled: false)
    const initialStates = {
      'group-congregation': { ...defaultState, isLiveEnabled: false, timestamp: Date.now() },
      'group-stage': { ...defaultState, isLiveEnabled: false, timestamp: Date.now() },
    };
    set({ 
      groupStates: initialStates, 
      activeControlGroupId: 'group-congregation' 
    });

    try {
      localStorage.setItem('simpleworship_group_states_v1', JSON.stringify(initialStates));
      localStorage.setItem('simpleworship_output_groups_order', JSON.stringify(defaultOutputGroups.map(g => g.id)));
    } catch (e) {}
    // Note: When the system starts/boots, schedule panel remains blank (0 items) by default
    // so operators start fresh for the service session.
  },

  addSong: async (song) => {
    await dbApi.addSong(song);
    set((state) => ({ songsList: [...state.songsList.filter(s => s.id !== song.id), song] }));
  },

  deleteSong: async (id) => {
    await dbApi.deleteSong(id);
    set((state) => ({ songsList: state.songsList.filter(s => s.id !== id) }));
  },

  saveTheme: async (theme) => {
    await dbApi.addTheme(theme);
    set((state) => ({
      themesList: state.themesList.some(t => t.id === theme.id)
        ? state.themesList.map(t => t.id === theme.id ? theme : t)
        : [...state.themesList, theme]
    }));
  },

  deleteTheme: async (id) => {
    await dbApi.deleteTheme(id);
    set((state) => ({ themesList: state.themesList.filter(t => t.id !== id) }));
  },

  addAsset: async (asset) => {
    await dbApi.addAsset(asset);
    set((state) => ({ assetsList: [...state.assetsList.filter(a => a.id !== asset.id), asset] }));
  },

  deleteAsset: async (id) => {
    await dbApi.deleteAsset(id);
    set((state) => ({ assetsList: state.assetsList.filter(a => a.id !== id) }));
  },
  setDefaultBackground: (assetUrl, scope, isVideo = false) => {
    set((state) => {
      const targetType = scope === 'scriptures' ? 'bible' : (scope === 'songs' ? 'song' : (scope === 'presentations' ? 'presentation' : (scope === 'announcements' ? 'announcement' : 'logo')));

      let themeFound = false;
      const updatedThemes: Theme[] = state.themesList.map(t => {
        if (t.type === targetType || (scope === 'logo' && (t.type === 'logo' || t.id === 'theme-logo'))) {
          themeFound = true;
          return {
            ...t,
            styles: {
              ...t.styles,
              backgroundType: isVideo ? 'video' : 'image',
              backgroundImageUrl: !isVideo ? assetUrl : undefined,
              backgroundVideoUrl: isVideo ? assetUrl : undefined,
            }
          };
        }
        return t;
      });

      if (!themeFound) {
        const newTheme: Theme = {
          id: `theme-${targetType}`,
          name: `Default ${scope.charAt(0).toUpperCase() + scope.slice(1)} Theme`,
          type: targetType as any,
          styles: {
            backgroundType: isVideo ? 'video' : 'image',
            backgroundImageUrl: !isVideo ? assetUrl : undefined,
            backgroundVideoUrl: isVideo ? assetUrl : undefined,
            showLogo: false,
          }
        };
        updatedThemes.push(newTheme);
      }

      // Persist updated themes to DB
      updatedThemes.forEach(t => dbApi.addTheme(t));

      // Update Songs defaultBackgroundUrl if scope === 'songs'
      let updatedSongs = state.songsList;
      if (scope === 'songs') {
        updatedSongs = state.songsList.map(song => ({
          ...song,
          defaultBackgroundUrl: assetUrl,
        }));
        updatedSongs.forEach(song => dbApi.addSong(song));
      }

      // Update Schedule items matching scope so they immediately reflect the new default background
      let updatedSchedule = state.activeSchedule;
      if (state.activeSchedule) {
        const scheduleItemType = scope === 'scriptures' ? 'bible' : (scope === 'songs' ? 'song' : (scope === 'presentations' ? 'presentation' : 'announcement'));
        const updatedItems = state.activeSchedule.items.map(item => {
          if (item.type === scheduleItemType || (scheduleItemType === 'presentation' && item.type === 'ppt')) {
            return {
              ...item,
              customBackgroundUrl: assetUrl,
            };
          }
          return item;
        });
        updatedSchedule = { ...state.activeSchedule, items: updatedItems };
        dbApi.addSchedule(updatedSchedule);
      }

      // Trigger timestamp updates on control state to force Live/Preview re-renders instantly
      const updatedGroupStates = { ...state.groupStates };
      Object.keys(updatedGroupStates).forEach(groupId => {
        if (updatedGroupStates[groupId]) {
          updatedGroupStates[groupId] = {
            ...updatedGroupStates[groupId],
            timestamp: Date.now(),
          };
        }
      });

      broadcastStateChange({
        type: 'GROUP_STATES_UPDATE',
        data: updatedGroupStates,
      });

      return {
        themesList: updatedThemes,
        songsList: updatedSongs,
        activeSchedule: updatedSchedule,
        groupStates: updatedGroupStates,
      };
    });
  }
}));


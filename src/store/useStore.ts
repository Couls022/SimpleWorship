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
  AlertPreset,
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
import { buildRenderFrame } from '../core/RenderFrameBuilder';

let saveGroupStatesTimer: any = null;
const scheduleGroupStatesSave = (updatedGroupStates: Record<string, any>) => {
  if (saveGroupStatesTimer) clearTimeout(saveGroupStatesTimer);
  saveGroupStatesTimer = setTimeout(() => {
    try {
      const sanitized = sanitizeForSync(updatedGroupStates);
      localStorage.setItem('simpleworship_group_states_v1', JSON.stringify(sanitized));
    } catch (e) {}
  }, 1000);
};

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

export const DEFAULT_ALERT_PRESETS: AlertPreset[] = [
  {
    id: 'preset-nursery-304',
    title: 'Nursery Room #304',
    message: 'Nursery #304 is requested in the Toddler Room',
    position: 'bottom',
    backgroundColor: '#0F172A',
    textColor: '#FACC15',
    showNursery: true,
    nurseryText: '#304',
    autoDismissSecs: 0,
    targetGroup: 'all',
    isDefault: true,
  },
  {
    id: 'preset-nursery-102',
    title: 'Nursery Parents Notice',
    message: 'Nursery #102: Parents please report to the nursery',
    position: 'bottom',
    backgroundColor: '#0F172A',
    textColor: '#FACC15',
    showNursery: true,
    nurseryText: '#102',
    autoDismissSecs: 0,
    targetGroup: 'all',
    isDefault: true,
  },
  {
    id: 'preset-vehicle-move',
    title: 'Vehicle Parking Notice',
    message: 'Driver of White SUV (Plate # ABC-1234), please move your vehicle',
    position: 'bottom',
    backgroundColor: '#7F1D1D',
    textColor: '#FEF08A',
    showNursery: false,
    autoDismissSecs: 60,
    targetGroup: 'all',
    isDefault: true,
  },
  {
    id: 'preset-sunday-school',
    title: 'Sunday School Class Dismissal',
    message: 'Children are dismissed to Sunday School Class',
    position: 'bottom',
    backgroundColor: '#1E3A8A',
    textColor: '#93C5FD',
    showNursery: false,
    autoDismissSecs: 30,
    targetGroup: 'all',
    isDefault: true,
  },
  {
    id: 'preset-fellowship-lunch',
    title: 'Fellowship Lunch Announcement',
    message: 'Special Announcement: Fellowship Lunch right after the service',
    position: 'top',
    backgroundColor: '#064E3B',
    textColor: '#6EE7B7',
    showNursery: false,
    autoDismissSecs: 0,
    targetGroup: 'all',
    isDefault: true,
  }
];

const ALERT_PRESETS_STORAGE_KEY = 'simpleworship_alert_presets_v1';

const getStoredAlertPresets = (): AlertPreset[] => {
  try {
    const saved = localStorage.getItem(ALERT_PRESETS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading stored alert presets', e);
  }
  return DEFAULT_ALERT_PRESETS;
};

const saveStoredAlertPresets = (presets: AlertPreset[]) => {
  try {
    localStorage.setItem(ALERT_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch (e) {
    console.error('Error persisting alert presets', e);
  }
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
  setGroupTargetDisplay: (groupId: string, targetDisplayId: string) => void;
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
  setPreviewItem: (itemOrId: string | null | Partial<PresentationItem>, slideIndex?: number, routerId?: string) => void;
  setPreviewSlide: (index: number, routerId?: string) => void;
  goLive: (routerId?: string) => void; // Pushes preview state to live
  goLiveItem: (itemId: string, slideIndex?: number, targetGroupId?: string, directItem?: PresentationItem, routerId?: string) => void; // Directly sends item to live

  // LIVE Navigation & Controls
  goLiveNext: () => void;
  goLivePrev: () => void;
  goLiveSlide: (slideIndex: number, groupId?: string) => void;
  goNextScheduleItem: () => void;
  goPrevScheduleItem: () => void;
  toggleBlack: (groupId: string) => void;
  toggleClear: (groupId: string) => void;
  toggleLogo: (groupId: string) => void;
  isMasterLive?: boolean; // Deprecated, keep for backwards compatibility if needed, but we don't need it.
  toggleMasterLive: (groupId: string) => void;

  // Alert / Nursery Ticker
  alert: AlertState;
  setAlert: (alert: Partial<AlertState>, groupId?: string) => void;
  groupAlerts: Record<string, AlertState>;
  alertPresets: AlertPreset[];
  addAlertPreset: (preset: Omit<AlertPreset, 'id'> | Partial<AlertPreset>) => AlertPreset;
  updateAlertPreset: (id: string, updates: Partial<AlertPreset>) => void;
  deleteAlertPreset: (id: string) => void;
  resetAlertPresets: () => void;

  // Slide Annotation State
  annotationState: SlideAnnotationState;
  groupAnnotations: Record<string, SlideAnnotationState>;
  getAnnotationState: (groupId?: string) => SlideAnnotationState;
  setAnnotationTool: (tool: AnnotationToolType, groupId?: string) => void;
  setAnnotationColor: (color: string, groupId?: string) => void;
  setAnnotationSize: (size: number, groupId?: string) => void;
  setAnnotationOpacity: (opacity: number, groupId?: string) => void;
  setAnnotationPersist: (persist: boolean, groupId?: string) => void;
  toggleAnnotationMode: (enabled?: boolean, groupId?: string) => void;
  addAnnotationStroke: (stroke: AnnotationStroke, groupId?: string) => void;
  clearAnnotations: (groupId?: string) => void;
  undoAnnotation: (groupId?: string) => void;
  redoAnnotation: (groupId?: string) => void;
  updateLaserPointer: (laser: Partial<LaserPointerState> | null, groupId?: string) => void;

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
    const next = [...state.profiles, { ...profile, createdAt: profile.createdAt || Date.now(), lastUsedAt: Date.now() }];
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
    const nextActive = state.activeProfileId === id ? (next[0]?.id || 'default') : state.activeProfileId;
    localStorage.setItem('simpleworship_profiles_v1', JSON.stringify(next));
    localStorage.setItem('simpleworship_active_profile_v1', nextActive);
    return { profiles: next, activeProfileId: nextActive };
  }),
  setActiveProfile: (id) => {
    const state = get();
    const target = state.profiles.find(p => p.id === id);
    const updatedProfiles = state.profiles.map(p => p.id === id ? { ...p, lastUsedAt: Date.now() } : p);
    
    localStorage.setItem('simpleworship_active_profile_v1', id);
    localStorage.setItem('simpleworship_profiles_v1', JSON.stringify(updatedProfiles));
    
    set({ activeProfileId: id, profiles: updatedProfiles });
    
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Active Profile Switched: "${target?.name || id}" (All databases connected)` 
      })
    );
  },

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

      // Trigger timestamp update on all groupStates so live displays re-render instantly with fresh system options
      const updatedGroupStates = { ...state.groupStates };
      Object.keys(updatedGroupStates).forEach(groupId => {
        if (updatedGroupStates[groupId]) {
          updatedGroupStates[groupId] = {
            ...updatedGroupStates[groupId],
            renderFrame: undefined,
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
      focused: true,
      previewItemId: 'item-gen-1',
      previewSlideIndex: 0
    },
    {
      routerId: 'router-2',
      targetOutputGroupId: 'group-stage',
      active: false,
      visible: true,
      focused: false,
      previewItemId: null,
      previewSlideIndex: 0
    }
  ],
  activeRouterId: 'router-1',
  addRouterPanel: (panel) => set((state) => {
    let targetGroupId = panel.targetOutputGroupId;
    let newGroups = [...state.outputGroups];
    let newGroupStates = { ...state.groupStates };

    // Find which output groups are currently targeted by existing router panels
    const assignedGroupIds = new Set(state.routerPanels.map(p => p.targetOutputGroupId).filter(Boolean));

    // If targetGroupId is not specified or already taken, find an unassigned group or create a new dedicated one
    if (!targetGroupId || assignedGroupIds.has(targetGroupId)) {
      const unassignedGroup = state.outputGroups.find(g => !assignedGroupIds.has(g.id));
      if (unassignedGroup) {
        targetGroupId = unassignedGroup.id;
      } else {
        const count = state.outputGroups.length + 1;
        const createdGroupId = `group-output-${Date.now()}`;
        const newGroup: OutputGroup = {
          id: createdGroupId,
          name: count === 2 ? 'Scripture / Stage Monitor' : `Live Output Panel ${count}`,
          role: count === 2 ? 'confidence' : 'broadcast',
          themeId: count === 2 ? 'theme-scripture' : 'theme-global',
          displayIds: [],
          isBlack: false,
          isClear: false,
          showLogo: false
        };
        newGroups.push(newGroup);
        newGroupStates[createdGroupId] = {
          ...defaultState,
          activeItemId: null,
          activeSlideIndex: 0,
          isLiveEnabled: false,
          timestamp: Date.now()
        };
        dbApi.saveOutputGroup(newGroup);
        targetGroupId = createdGroupId;
      }
    }

    const updatedPanel: RouterPanelState = {
      ...panel,
      targetOutputGroupId: targetGroupId,
      previewItemId: panel.previewItemId ?? null,
      previewSlideIndex: panel.previewSlideIndex ?? 0
    };

    const panels = state.routerPanels.map(p => ({
      ...p,
      active: p.routerId === updatedPanel.routerId
    }));
    panels.push(updatedPanel);

    return {
      outputGroups: newGroups,
      groupStates: newGroupStates,
      routerPanels: panels,
      activeRouterId: updatedPanel.routerId,
      activeControlGroupId: targetGroupId,
      previewItemId: updatedPanel.previewItemId ?? state.previewItemId,
      previewSlideIndex: updatedPanel.previewSlideIndex ?? state.previewSlideIndex
    };
  }),
  removeRouterPanel: (id) => set((state) => {
    const panels = state.routerPanels.filter(p => p.routerId !== id);
    const newActiveId = state.activeRouterId === id ? (panels[0]?.routerId || null) : state.activeRouterId;
    const activePanel = panels.find(p => p.routerId === newActiveId);
    const newActiveTarget = activePanel?.targetOutputGroupId || null;
    return {
      routerPanels: panels.map(p => ({
        ...p,
        active: p.routerId === newActiveId
      })),
      activeRouterId: newActiveId,
      activeControlGroupId: newActiveTarget,
      previewItemId: activePanel?.previewItemId ?? null,
      previewSlideIndex: activePanel?.previewSlideIndex ?? 0
    };
  }),
  updateRouterPanel: (id, updates) => set((state) => {
    const panels = state.routerPanels.map(p => p.routerId === id ? { ...p, ...updates } : p);
    const activePanel = panels.find(p => p.routerId === state.activeRouterId);
    const activeTarget = activePanel?.targetOutputGroupId || null;
    return { 
      routerPanels: panels,
      activeControlGroupId: activeTarget,
      previewItemId: activePanel?.previewItemId ?? state.previewItemId,
      previewSlideIndex: activePanel?.previewSlideIndex ?? state.previewSlideIndex
    };
  }),
  setActiveRouterId: (id) => {
    set((state) => {
      const panels = state.routerPanels.map(p => ({
        ...p,
        active: p.routerId === id,
        focused: p.routerId === id ? true : p.focused
      }));
      const activePanel = panels.find(p => p.routerId === id);
      const newActiveTarget = activePanel?.targetOutputGroupId || null;
      return {
        activeRouterId: id,
        routerPanels: panels,
        activeControlGroupId: newActiveTarget,
        previewItemId: activePanel?.previewItemId ?? null,
        previewSlideIndex: activePanel?.previewSlideIndex ?? 0
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
    set((state) => {
      const newGroups = [...state.outputGroups, group];
      const newStates = { ...state.groupStates, [group.id]: { ...defaultState, timestamp: Date.now() } };
      dbApi.saveOutputGroup(group);
      
      // Request display manager to sync up newly created panel windows
      DisplayManager.syncPhysicalDisplays(newGroups, newStates, state.activeControlGroupId).catch(() => {});
      
      return { 
        outputGroups: newGroups,
        groupStates: newStates
      };
    });
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
  setGroupTargetDisplay: (groupId, targetDisplayId) => {
    set((state) => {
      const groupIndex = state.outputGroups.findIndex(g => g.id === groupId);
      if (groupIndex === -1) return state;
      const updatedGroup = { 
        ...state.outputGroups[groupIndex], 
        targetDisplayId, 
        displayIds: targetDisplayId ? [targetDisplayId] : [] 
      };
      const newGroups = [...state.outputGroups];
      newGroups[groupIndex] = updatedGroup;
      dbApi.saveOutputGroup(updatedGroup);

      DisplayManager.syncPhysicalDisplays(newGroups, state.groupStates, state.activeControlGroupId).catch(() => {});

      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', { 
          detail: `1:1 Target Monitor updated: "${updatedGroup.name}" -> ${targetDisplayId || 'None'}` 
        })
      );

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
    
    // Explicitly sync physical displays with the display manager to account for new or removed dynamic panels
    DisplayManager.syncPhysicalDisplays(current, newGroupStates, newActive).catch(() => {});
    
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
    
    // Explicitly ask display manager to close window
    DisplayManager.closeProjector(id).catch(() => {});
    DisplayManager.syncPhysicalDisplays(newGroups, newStates, newActive).catch(() => {});

    return { outputGroups: newGroups, groupStates: newStates, activeControlGroupId: newActive };
  }),
  
  groupStates: {
    'group-congregation': { ...defaultState, activeItemId: 'song-1', activeSlideIndex: 0, timestamp: Date.now(), isLiveEnabled: false },
    'group-stage': { ...defaultState, activeItemId: 'song-1', activeSlideIndex: 0, timestamp: Date.now(), isLiveEnabled: false },
  },
  setGroupState: (groupId, newState) => {
    set((state) => {
      const current = state.groupStates[groupId] || defaultState;
      const combinedState = { ...current, ...newState, timestamp: Date.now() };

      // Fast-path optimization for video/audio scrub time updates
      const isOnlyPlaybackTimeUpdate = (
        Object.keys(newState).every(k => k === 'videoCurrentTime' || k === 'videoDuration')
      );

      let frame = current.renderFrame;
      if (!isOnlyPlaybackTimeUpdate) {
        // Build RenderFrame for the group
        const targetGroup = state.outputGroups.find(g => g.id === groupId);
        const systemOptions = state.systemOptions;
        
        frame = buildRenderFrame(
          groupId,
          combinedState,
          state.activeSchedule,
          targetGroup,
          systemOptions,
          state.songsList,
          state.themesList,
          DisplayManager.getCachedDisplays()
        );
      }

      combinedState.renderFrame = frame;

      const updatedGroupStates = {
        ...state.groupStates,
        [groupId]: combinedState
      };

      // Debounce blocking synchronous localStorage writes to keep UI thread fluid and zero-lag
      scheduleGroupStatesSave(updatedGroupStates);

      broadcastStateChange({
        type: 'GROUP_STATES_UPDATE',
        data: { groupStates: updatedGroupStates }
      });

      if (!isOnlyPlaybackTimeUpdate && newState.isLiveEnabled !== undefined && newState.isLiveEnabled !== current.isLiveEnabled) {
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
  setPreviewItem: (itemOrId, slideIndex = 0, routerId) => {
    const state = get();
    const routerIdToUse = routerId || state.activeRouterId || state.routerPanels[0]?.routerId || 'router-1';

    let resolvedItemId: string | null = null;
    if (!itemOrId) {
      resolvedItemId = null;
    } else if (typeof itemOrId === 'string') {
      resolvedItemId = itemOrId;
    } else {
      const existing = state.activeSchedule?.items.find(
        i => i.id === itemOrId.id || (itemOrId.contentId && i.contentId === itemOrId.contentId)
      );
      if (existing) {
        resolvedItemId = existing.id;
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
          set({ activeSchedule: updatedSchedule });
        }
        resolvedItemId = newItem.id;
      }
    }

    const updatedPanels = state.routerPanels.map(p => {
      if (p.routerId === routerIdToUse) {
        return { ...p, previewItemId: resolvedItemId, previewSlideIndex: slideIndex };
      }
      return p;
    });

    const activePanel = updatedPanels.find(p => p.routerId === (state.activeRouterId || routerIdToUse)) || updatedPanels[0];

    set({
      routerPanels: updatedPanels,
      previewItemId: activePanel?.previewItemId ?? null,
      previewSlideIndex: activePanel?.previewSlideIndex ?? 0
    });

    broadcastStateChange({
      type: 'PREVIEW_UPDATE',
      data: { routerId: routerIdToUse, previewItemId: resolvedItemId, previewSlideIndex: slideIndex }
    });
  },
  setPreviewSlide: (index, routerId) => {
    const state = get();
    const routerIdToUse = routerId || state.activeRouterId || state.routerPanels[0]?.routerId || 'router-1';
    const updatedPanels = state.routerPanels.map(p => {
      if (p.routerId === routerIdToUse) {
        return { ...p, previewSlideIndex: index };
      }
      return p;
    });
    const activePanel = updatedPanels.find(p => p.routerId === (state.activeRouterId || routerIdToUse)) || updatedPanels[0];
    set({
      routerPanels: updatedPanels,
      previewSlideIndex: activePanel?.previewSlideIndex ?? index
    });
  },

  goLive: (routerId) => {
    const state = get();
    const routerIdToUse = routerId || state.activeRouterId || state.routerPanels[0]?.routerId || 'router-1';
    const routerPanel = state.routerPanels.find(p => p.routerId === routerIdToUse) || state.routerPanels[0];
    const targetGroupId = routerPanel?.targetOutputGroupId || state.activeControlGroupId || state.outputGroups[0]?.id;

    let itemIdToUse = routerPanel?.previewItemId ?? state.previewItemId;
    let slideIdxToUse = routerPanel?.previewSlideIndex ?? state.previewSlideIndex ?? 0;

    if (!itemIdToUse && state.activeSchedule && state.activeSchedule.items.length > 0) {
      itemIdToUse = state.activeSchedule.items[0].id;
      slideIdxToUse = 0;
    } else if (!itemIdToUse && targetGroupId && state.groupStates[targetGroupId]?.activeItemId) {
      itemIdToUse = state.groupStates[targetGroupId].activeItemId;
      slideIdxToUse = state.groupStates[targetGroupId].activeSlideIndex || 0;
    }

    if (!itemIdToUse) {
      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', { 
          detail: 'Please select a song or slide in Schedule or Library to Go Live' 
        })
      );
      return;
    }

    const itemToRoute = state.activeSchedule?.items?.find(i => i.id === itemIdToUse);
    if (itemToRoute) {
      state.setRoutingRequest({ item: itemToRoute, isNew: false, slideIndex: slideIdxToUse });
    } else {
      get().goLiveItem(itemIdToUse, slideIdxToUse, targetGroupId, undefined, routerIdToUse);
    }
  },

  goLiveItem: (itemId, slideIndex = 0, targetGroupId, directItem, routerId) => {
    const { activeControlGroupId, setGroupState, outputGroups, activeSchedule, songsList, routerPanels, activeRouterId } = get();
    const routerIdToUse = routerId || activeRouterId || routerPanels[0]?.routerId || 'router-1';
    const routerPanel = routerPanels.find(p => p.routerId === routerIdToUse);
    const groupToUpdate = targetGroupId || routerPanel?.targetOutputGroupId || activeControlGroupId || (outputGroups.length > 0 ? outputGroups[0].id : undefined);

    const updatedPanels = routerPanels.map(p => {
      if (p.routerId === routerIdToUse) {
        return { ...p, previewItemId: itemId, previewSlideIndex: slideIndex };
      }
      return p;
    });

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

    const activePanel = updatedPanels.find(p => p.routerId === (activeRouterId || routerIdToUse)) || updatedPanels[0];

    set({
      routerPanels: updatedPanels,
      previewItemId: activePanel?.previewItemId ?? itemId,
      previewSlideIndex: activePanel?.previewSlideIndex ?? slideIndex
    });

    if (groupToUpdate) {
      setGroupState(groupToUpdate, {
        activeItemId: itemId,
        activeSlideIndex: slideIndex,
        directLiveItem: liveItem || null,
        isBlack: false,
        isClear: false,
      });
      if (routerIdToUse !== activeRouterId || groupToUpdate !== activeControlGroupId) {
        set({ activeControlGroupId: groupToUpdate, activeRouterId: routerIdToUse });
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
    const { activeControlGroupId, groupStates, activeSchedule, songsList, shortcutSettings, outputGroups } = get();
    const targetGroupId = activeControlGroupId || (outputGroups.length > 0 ? outputGroups[0].id : 'group-congregation');
    const currentState = groupStates[targetGroupId] || defaultState;
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
    get().setGroupState(targetGroupId, { activeSlideIndex: nextIndex });
  },
  
  goLivePrev: () => {
    const { activeControlGroupId, groupStates, activeSchedule, songsList, shortcutSettings, outputGroups } = get();
    const targetGroupId = activeControlGroupId || (outputGroups.length > 0 ? outputGroups[0].id : 'group-congregation');
    const currentState = groupStates[targetGroupId] || defaultState;
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
    get().setGroupState(targetGroupId, { activeSlideIndex: prevIndex });
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Previous Slide: #${prevIndex + 1}` 
      })
    );
  },

  goLiveSlide: (slideIndex: number, groupId?: string) => {
    const { activeControlGroupId, outputGroups, setGroupState } = get();
    const targetGroupId = groupId || activeControlGroupId || (outputGroups.length > 0 ? outputGroups[0].id : 'group-congregation');
    setGroupState(targetGroupId, { activeSlideIndex: Math.max(0, slideIndex) });
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
  
  toggleBlack: (groupId: string) => {
    if (!groupId) return;
    const { groupStates } = get();
    const currentState = groupStates[groupId] || defaultState;
    const nextBlack = !currentState.isBlack;
    get().setGroupState(groupId, { isBlack: nextBlack, showLogo: false });
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: nextBlack ? 'Blackout Enabled on Live Output (F6 / B)' : 'Blackout Disabled' 
      })
    );
  },
  
  toggleClear: (groupId: string) => {
    if (!groupId) return;
    const { groupStates } = get();
    const currentState = groupStates[groupId] || defaultState;
    const nextClear = !currentState.isClear;
    get().setGroupState(groupId, { isClear: nextClear });
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: nextClear ? 'Clear Text Enabled on Live Output (F7 / C)' : 'Text Restored on Live Output' 
      })
    );
  },

  toggleLogo: (groupId: string) => {
    if (!groupId) return;
    const { groupStates } = get();
    const currentState = groupStates[groupId] || defaultState;
    const nextLogo = !currentState.showLogo;
    get().setGroupState(groupId, { showLogo: nextLogo, isBlack: false });
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: nextLogo ? 'Logo Display Enabled on Live Output (F8 / L)' : 'Logo Display Disabled' 
      })
    );
  },

  toggleMasterLive: (groupId: string) => {
    if (!groupId) return;
    const { groupStates, outputGroups, activeControlGroupId } = get();
    const currentState = groupStates[groupId] || defaultState;
    const nextLive = !currentState.isLiveEnabled;
    const updatedStates = { ...groupStates };
    updatedStates[groupId] = {
      ...currentState,
      isLiveEnabled: nextLive,
      timestamp: Date.now(),
    };

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
    DisplayManager.syncPhysicalDisplays(outputGroups, updatedStates, activeControlGroupId).catch(err => {
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
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    textColor: '#FACC15',
    speed: 15,
  },
  groupAlerts: {},
  setAlert: (alertUpdate: Partial<AlertState>, groupId?: string) => set((state) => {
    const currentGlobal = state.alert || {
      active: false,
      message: 'Nursery #304 is requested in the Toddler Room',
      position: 'bottom',
      backgroundColor: 'rgba(15, 23, 42, 0.96)',
      textColor: '#FACC15',
      speed: 15,
    };
    const nextGlobal = { ...currentGlobal, ...alertUpdate } as AlertState;
    
    let newGroupAlerts = { ...state.groupAlerts };
    if (groupId) {
      const currentGroup = state.groupAlerts[groupId] || currentGlobal;
      newGroupAlerts[groupId] = { ...currentGroup, ...alertUpdate } as AlertState;
    } else {
      // Sync across all active output groups if no specific group specified
      Object.keys(newGroupAlerts).forEach((gId) => {
        newGroupAlerts[gId] = { ...newGroupAlerts[gId], ...alertUpdate };
      });
    }

    broadcastStateChange({
      type: 'ALERT_UPDATE',
      data: { alert: nextGlobal, groupAlerts: newGroupAlerts }
    });

    return { 
      alert: nextGlobal,
      groupAlerts: newGroupAlerts
    };
  }),

  // Alert Presets State & Management (Save, Edit, Delete, Reset, Load)
  alertPresets: getStoredAlertPresets(),
  addAlertPreset: (presetData) => {
    const newPreset: AlertPreset = {
      id: (presetData as any).id || `preset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: presetData.title || (presetData.message ? (presetData.message.length > 32 ? presetData.message.slice(0, 32) + '...' : presetData.message) : 'Custom Alert'),
      message: presetData.message || '',
      position: presetData.position || 'bottom',
      backgroundColor: presetData.backgroundColor || 'rgba(15, 23, 42, 0.96)',
      textColor: presetData.textColor || '#FACC15',
      showNursery: presetData.showNursery || false,
      nurseryText: presetData.nurseryText || '',
      targetGroup: presetData.targetGroup || 'all',
      autoDismissSecs: presetData.autoDismissSecs || 0,
      createdAt: Date.now(),
    };

    set((state) => {
      const updated = [newPreset, ...state.alertPresets];
      saveStoredAlertPresets(updated);
      broadcastStateChange({
        type: 'ALERT_PRESETS_UPDATE',
        data: { presets: updated },
      });
      return { alertPresets: updated };
    });

    return newPreset;
  },

  updateAlertPreset: (id, updates) => {
    set((state) => {
      const updated = state.alertPresets.map((p) => (p.id === id ? { ...p, ...updates } : p));
      saveStoredAlertPresets(updated);
      broadcastStateChange({
        type: 'ALERT_PRESETS_UPDATE',
        data: { presets: updated },
      });
      return { alertPresets: updated };
    });
  },

  deleteAlertPreset: (id) => {
    set((state) => {
      const updated = state.alertPresets.filter((p) => p.id !== id);
      saveStoredAlertPresets(updated);
      broadcastStateChange({
        type: 'ALERT_PRESETS_UPDATE',
        data: { presets: updated },
      });
      return { alertPresets: updated };
    });
  },

  resetAlertPresets: () => {
    set(() => {
      const updated = [...DEFAULT_ALERT_PRESETS];
      saveStoredAlertPresets(updated);
      broadcastStateChange({
        type: 'ALERT_PRESETS_UPDATE',
        data: { presets: updated },
      });
      return { alertPresets: updated };
    });
  },

  // Slide Annotation State & Methods
  annotationState: defaultAnnotationState,
  groupAnnotations: {},
  getAnnotationState: (groupId) => {
    const state = get();
    const targetGroup = groupId || state.activeControlGroupId || 'group-congregation';
    return state.groupAnnotations[targetGroup] || state.annotationState || defaultAnnotationState;
  },
  
  setAnnotationTool: (tool, groupId) => set((state) => {
    const targetGroup = groupId || state.activeControlGroupId || 'group-congregation';
    const current = state.groupAnnotations[targetGroup] || state.annotationState || defaultAnnotationState;
    const updated = { 
      ...current, 
      activeTool: tool,
      opacity: tool === 'highlighter' ? 0.4 : (tool === 'spotlight' ? 0.8 : (current.opacity === 0.4 ? 0.9 : current.opacity))
    };
    return {
      annotationState: targetGroup === state.activeControlGroupId ? updated : state.annotationState,
      groupAnnotations: { ...state.groupAnnotations, [targetGroup]: updated }
    };
  }),

  setAnnotationColor: (color, groupId) => set((state) => {
    const targetGroup = groupId || state.activeControlGroupId || 'group-congregation';
    const current = state.groupAnnotations[targetGroup] || state.annotationState || defaultAnnotationState;
    const updated = { ...current, activeColor: color };
    return {
      annotationState: targetGroup === state.activeControlGroupId ? updated : state.annotationState,
      groupAnnotations: { ...state.groupAnnotations, [targetGroup]: updated }
    };
  }),

  setAnnotationSize: (size, groupId) => set((state) => {
    const targetGroup = groupId || state.activeControlGroupId || 'group-congregation';
    const current = state.groupAnnotations[targetGroup] || state.annotationState || defaultAnnotationState;
    const updated = { ...current, strokeSize: size };
    return {
      annotationState: targetGroup === state.activeControlGroupId ? updated : state.annotationState,
      groupAnnotations: { ...state.groupAnnotations, [targetGroup]: updated }
    };
  }),

  setAnnotationOpacity: (opacity, groupId) => set((state) => {
    const targetGroup = groupId || state.activeControlGroupId || 'group-congregation';
    const current = state.groupAnnotations[targetGroup] || state.annotationState || defaultAnnotationState;
    const updated = { ...current, opacity };
    return {
      annotationState: targetGroup === state.activeControlGroupId ? updated : state.annotationState,
      groupAnnotations: { ...state.groupAnnotations, [targetGroup]: updated }
    };
  }),

  setAnnotationPersist: (persist, groupId) => set((state) => {
    const targetGroup = groupId || state.activeControlGroupId || 'group-congregation';
    const current = state.groupAnnotations[targetGroup] || state.annotationState || defaultAnnotationState;
    const updated = { ...current, persistAcrossSlides: persist };
    return {
      annotationState: targetGroup === state.activeControlGroupId ? updated : state.annotationState,
      groupAnnotations: { ...state.groupAnnotations, [targetGroup]: updated }
    };
  }),

  toggleAnnotationMode: (enabled, groupId) => set((state) => {
    const targetGroup = groupId || state.activeControlGroupId || 'group-congregation';
    const current = state.groupAnnotations[targetGroup] || state.annotationState || defaultAnnotationState;
    const nextEnabled = enabled !== undefined ? enabled : !current.enabled;
    const updated = {
      ...current,
      enabled: nextEnabled,
      laserPointer: nextEnabled ? current.laserPointer : undefined
    };
    return {
      annotationState: targetGroup === state.activeControlGroupId ? updated : state.annotationState,
      groupAnnotations: { ...state.groupAnnotations, [targetGroup]: updated }
    };
  }),

  addAnnotationStroke: (stroke, groupId) => set((state) => {
    const targetGroup = groupId || state.activeControlGroupId || 'group-congregation';
    const current = state.groupAnnotations[targetGroup] || state.annotationState || defaultAnnotationState;
    const newStrokes = [...current.strokes, stroke];
    const updated = {
      ...current,
      strokes: newStrokes,
      redoStack: []
    };
    return {
      annotationState: targetGroup === state.activeControlGroupId ? updated : state.annotationState,
      groupAnnotations: { ...state.groupAnnotations, [targetGroup]: updated }
    };
  }),

  clearAnnotations: (groupId) => set((state) => {
    const targetGroup = groupId || state.activeControlGroupId || 'group-congregation';
    const current = state.groupAnnotations[targetGroup] || state.annotationState || defaultAnnotationState;
    const updated = {
      ...current,
      strokes: [],
      redoStack: [],
      laserPointer: undefined
    };
    return {
      annotationState: targetGroup === state.activeControlGroupId ? updated : state.annotationState,
      groupAnnotations: { ...state.groupAnnotations, [targetGroup]: updated }
    };
  }),

  undoAnnotation: (groupId) => set((state) => {
    const targetGroup = groupId || state.activeControlGroupId || 'group-congregation';
    const current = state.groupAnnotations[targetGroup] || state.annotationState || defaultAnnotationState;
    if (current.strokes.length === 0) return state;
    const strokes = [...current.strokes];
    const popped = strokes.pop();
    if (!popped) return state;
    const updated = {
      ...current,
      strokes,
      redoStack: [...current.redoStack, popped]
    };
    return {
      annotationState: targetGroup === state.activeControlGroupId ? updated : state.annotationState,
      groupAnnotations: { ...state.groupAnnotations, [targetGroup]: updated }
    };
  }),

  redoAnnotation: (groupId) => set((state) => {
    const targetGroup = groupId || state.activeControlGroupId || 'group-congregation';
    const current = state.groupAnnotations[targetGroup] || state.annotationState || defaultAnnotationState;
    if (current.redoStack.length === 0) return state;
    const redoStack = [...current.redoStack];
    const restored = redoStack.pop();
    if (!restored) return state;
    const updated = {
      ...current,
      strokes: [...current.strokes, restored],
      redoStack
    };
    return {
      annotationState: targetGroup === state.activeControlGroupId ? updated : state.annotationState,
      groupAnnotations: { ...state.groupAnnotations, [targetGroup]: updated }
    };
  }),

  updateLaserPointer: (laserUpdate, groupId) => set((state) => {
    const targetGroup = groupId || state.activeControlGroupId || 'group-congregation';
    const currentAnn = state.groupAnnotations[targetGroup] || state.annotationState || defaultAnnotationState;

    if (!laserUpdate) {
      const updated = { ...currentAnn, laserPointer: undefined };
      return {
        annotationState: targetGroup === state.activeControlGroupId ? updated : state.annotationState,
        groupAnnotations: { ...state.groupAnnotations, [targetGroup]: updated }
      };
    }
    const currentLaser = currentAnn.laserPointer || {
      active: true,
      x: 0.5,
      y: 0.5,
      color: currentAnn.activeColor,
      size: currentAnn.strokeSize * 2,
      lastUpdated: Date.now()
    };
    const updatedLaser = {
      ...currentLaser,
      ...laserUpdate,
      lastUpdated: Date.now()
    };
    const updated = { ...currentAnn, laserPointer: updatedLaser };
    return {
      annotationState: targetGroup === state.activeControlGroupId ? updated : state.annotationState,
      groupAnnotations: { ...state.groupAnnotations, [targetGroup]: updated }
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
    const [songs, themes, assets, outputGroups, schedules, scriptures, storedOptions] = await Promise.all([
      dbApi.getAllSongs(),
      dbApi.getAllThemes(),
      dbApi.getAllAssets(),
      dbApi.getOutputGroups(),
      dbApi.getAllSchedules(),
      dbApi.getAllScriptures(),
      dbApi.getSystemOptions().catch(() => null),
    ]);

    if (storedOptions) {
      set(state => ({
        systemOptions: {
          ...state.systemOptions,
          ...storedOptions,
        }
      }));
    }

    // Ensure all seed songs and Baptist Hymnal songs are populated
    let mergedSongs = songs.map(s => {
      // Strip old default unsplash background URLs from songs
      if (s.defaultBackgroundUrl && s.defaultBackgroundUrl.includes('unsplash.com')) {
        const { defaultBackgroundUrl, ...rest } = s;
        return rest as Song;
      }
      return s;
    });
    if (mergedSongs.length < defaultSongs.length) {
      const existingIds = new Set(mergedSongs.map(s => s.id));
      const missing = defaultSongs.filter(s => !existingIds.has(s.id));
      mergedSongs = [...mergedSongs, ...missing];
      Promise.all(missing.map(s => dbApi.addSong(s))).catch(() => {});
    }
    set({ songsList: mergedSongs.length > 0 ? mergedSongs : defaultSongs });

    // Ensure all default themes (including theme-logo, song, bible, etc.) exist and are sanitized
    let mergedThemes = themes.map(t => {
      // Clear old default unsplash image URLs from theme styles
      if (t.styles?.backgroundImageUrl && t.styles.backgroundImageUrl.includes('unsplash.com')) {
        return {
          ...t,
          styles: {
            ...t.styles,
            backgroundImageUrl: undefined,
            backgroundVideoUrl: undefined,
            backgroundType: 'color' as const,
            backgroundColor: t.styles.backgroundColor || '#000000'
          }
        };
      }
      return t;
    });
    const existingThemeIds = new Set(mergedThemes.map(t => t.id));
    const missingDefaultThemes = defaultThemes.filter(t => !existingThemeIds.has(t.id));
    if (missingDefaultThemes.length > 0) {
      mergedThemes = [...mergedThemes, ...missingDefaultThemes];
      Promise.all(missingDefaultThemes.map(t => dbApi.addTheme(t))).catch(() => {});
    }
    set({ themesList: mergedThemes.length > 0 ? mergedThemes : defaultThemes });

    if (assets.length > 0) {
      // Cross-check default themes / systemOptions to populate isDefaultScope if not already set
      const logoUrl = storedOptions?.general?.defaultLogoUrl || storedOptions?.mainOutput?.general?.defaultLogoUrl || mergedThemes.find(t => t.type === 'logo' || t.id === 'theme-logo')?.styles?.logoUrl;
      const songBgUrl = mergedThemes.find(t => t.type === 'song' || t.id === 'theme-song')?.styles?.backgroundImageUrl || mergedThemes.find(t => t.type === 'song' || t.id === 'theme-song')?.styles?.backgroundVideoUrl;
      const bibleBgUrl = mergedThemes.find(t => t.type === 'bible' || t.id === 'theme-scripture')?.styles?.backgroundImageUrl || mergedThemes.find(t => t.type === 'bible' || t.id === 'theme-scripture')?.styles?.backgroundVideoUrl;
      const pptBgUrl = mergedThemes.find(t => t.type === 'presentation' || t.id === 'theme-presentation')?.styles?.backgroundImageUrl || mergedThemes.find(t => t.type === 'presentation' || t.id === 'theme-presentation')?.styles?.backgroundVideoUrl;
      const annBgUrl = mergedThemes.find(t => t.type === 'announcement' || t.id === 'theme-announcement')?.styles?.backgroundImageUrl || mergedThemes.find(t => t.type === 'announcement' || t.id === 'theme-announcement')?.styles?.backgroundVideoUrl;

      const hydratedAssets = assets.map(a => {
        const scopes = { ...(a.isDefaultScope || {}) };
        if (logoUrl && (a.url === logoUrl || a.id === logoUrl)) scopes.logo = true;
        if (songBgUrl && (a.url === songBgUrl || a.id === songBgUrl)) scopes.songs = true;
        if (bibleBgUrl && (a.url === bibleBgUrl || a.id === bibleBgUrl)) scopes.scriptures = true;
        if (pptBgUrl && (a.url === pptBgUrl || a.id === pptBgUrl)) scopes.presentations = true;
        if (annBgUrl && (a.url === annBgUrl || a.id === annBgUrl)) scopes.announcements = true;
        return { ...a, isDefaultScope: scopes };
      });

      set({ assetsList: hydratedAssets });
    }
    
    // Ensure scriptures
    let mergedScriptures = scriptures;
    if (scriptures.length < defaultScriptures.length) {
      const existingIds = new Set(scriptures.map(sc => sc.id));
      const missing = defaultScriptures.filter(sc => !existingIds.has(sc.id));
      mergedScriptures = [...scriptures, ...missing];
      Promise.all(missing.map(sc => dbApi.addScripture(sc))).catch(() => {});
    }
    set({ scripturesList: mergedScriptures.length > 0 ? mergedScriptures : defaultScriptures });

    // Load or initialize output groups efficiently without deleting DB records
    let finalOutputGroups = outputGroups;
    if (!finalOutputGroups || finalOutputGroups.length === 0) {
      finalOutputGroups = defaultOutputGroups;
      await Promise.all(defaultOutputGroups.map(g => dbApi.saveOutputGroup(g)));
    }
    set({ outputGroups: finalOutputGroups });

    // Always reset/initialize group states so that Live is OFF (isLiveEnabled: false) on fresh load
    const initialStates: Record<string, any> = {};
    finalOutputGroups.forEach(g => {
      initialStates[g.id] = { ...defaultState, isLiveEnabled: false, timestamp: Date.now() };
    });
    set({ 
      groupStates: initialStates, 
      activeControlGroupId: finalOutputGroups[0]?.id || 'group-congregation' 
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

      // Check if target asset is currently the active default for this scope to support toggle-off
      const targetAsset = state.assetsList.find(a => a.url === assetUrl || a.id === assetUrl);
      const isCurrentlyActiveDefault = targetAsset?.isDefaultScope?.[scope] === true;
      const isTogglingOff = isCurrentlyActiveDefault;

      const finalAssetUrl = isTogglingOff ? '' : assetUrl;

      // 1. Update assetsList so ONLY target asset is marked default for this scope (automatic replacement)
      const updatedAssetsList = state.assetsList.map(a => {
        const isMatch = a.url === assetUrl || a.id === assetUrl;
        const currentScopes = a.isDefaultScope || {};
        
        let newScopeState = false;
        if (isMatch) {
          newScopeState = !isCurrentlyActiveDefault;
        }

        const nextScopes = {
          ...currentScopes,
          [scope]: newScopeState,
        };

        const updated = {
          ...a,
          isDefaultScope: nextScopes,
        };

        dbApi.addAsset(updated).catch(() => {});
        return updated;
      });

      // 2. Persist in SystemOptions if scope is 'logo'
      let nextSystemOptions = state.systemOptions;
      if (scope === 'logo') {
        nextSystemOptions = {
          ...state.systemOptions,
          mainOutput: {
            ...state.systemOptions?.mainOutput,
            general: {
              ...(state.systemOptions?.mainOutput?.general || {}),
              defaultLogoUrl: finalAssetUrl,
            } as any
          },
          general: {
            ...((state.systemOptions as any)?.general || {}),
            defaultLogoUrl: finalAssetUrl,
          } as any
        };
        try {
          localStorage.setItem('simpleworship_system_options_v1', JSON.stringify(nextSystemOptions));
        } catch (e) {}
        dbApi.saveSystemOptions(nextSystemOptions).catch(() => {});
      }

      // 3. Update Theme in themesList
      let themeFound = false;
      const updatedThemes: Theme[] = state.themesList.map(t => {
        const isMatch = (
          t.type === targetType ||
          (scope === 'logo' && (t.type === 'logo' || t.id === 'theme-logo')) ||
          (scope === 'scriptures' && (t.type === 'bible' || t.id === 'theme-scripture')) ||
          (scope === 'songs' && (t.type === 'song' || t.id === 'theme-song')) ||
          (scope === 'presentations' && (t.type === 'presentation' || (t.type as any) === 'ppt' || t.id === 'theme-presentation')) ||
          (scope === 'announcements' && (t.type === 'announcement' || t.id === 'theme-announcement'))
        );

        if (isMatch) {
          themeFound = true;
          return {
            ...t,
            styles: {
              ...t.styles,
              backgroundType: isTogglingOff ? ('color' as const) : (isVideo ? 'video' : 'image'),
              backgroundImageUrl: (!isTogglingOff && !isVideo) ? finalAssetUrl : undefined,
              backgroundVideoUrl: (!isTogglingOff && isVideo) ? finalAssetUrl : undefined,
              logoUrl: scope === 'logo' ? finalAssetUrl : t.styles?.logoUrl,
            }
          };
        }
        return t;
      });

      if (!themeFound && !isTogglingOff) {
        const newTheme: Theme = {
          id: scope === 'logo' ? 'theme-logo' : (scope === 'scriptures' ? 'theme-scripture' : (scope === 'songs' ? 'theme-song' : (scope === 'presentations' ? 'theme-presentation' : `theme-${targetType}`))),
          name: `Default ${scope.charAt(0).toUpperCase() + scope.slice(1)} Theme`,
          type: targetType as any,
          styles: {
            backgroundType: isVideo ? 'video' : 'image',
            backgroundImageUrl: !isVideo ? finalAssetUrl : undefined,
            backgroundVideoUrl: isVideo ? finalAssetUrl : undefined,
            logoUrl: scope === 'logo' && !isVideo ? finalAssetUrl : undefined,
            showLogo: scope === 'logo',
          }
        };
        updatedThemes.push(newTheme);
      }

      // Persist updated themes to DB
      updatedThemes.forEach(t => dbApi.addTheme(t).catch(() => {}));

      // 4. Update Songs defaultBackgroundUrl if scope === 'songs'
      let updatedSongs = state.songsList;
      if (scope === 'songs') {
        updatedSongs = state.songsList.map(song => ({
          ...song,
          defaultBackgroundUrl: finalAssetUrl,
        }));
        updatedSongs.forEach(song => dbApi.addSong(song).catch(() => {}));
      }

      // 5. Update Schedule items matching scope so they immediately reflect the new default background
      let updatedSchedule = state.activeSchedule;
      if (state.activeSchedule) {
        const scheduleItemType = scope === 'scriptures' ? 'bible' : (scope === 'songs' ? 'song' : (scope === 'presentations' ? 'presentation' : 'announcement'));
        const updatedItems = state.activeSchedule.items.map(item => {
          if (item.type === scheduleItemType || (scheduleItemType === 'presentation' && item.type === 'ppt')) {
            return {
              ...item,
              customBackgroundUrl: finalAssetUrl,
            };
          }
          return item;
        });
        updatedSchedule = { ...state.activeSchedule, items: updatedItems };
        dbApi.addSchedule(updatedSchedule).catch(() => {});
      }

      // 6. Update direct live items in groupStates so active live displays reflect the new default background instantly
      const targetScheduleType = scope === 'scriptures' ? 'bible' : (scope === 'songs' ? 'song' : (scope === 'presentations' ? 'presentation' : (scope === 'announcements' ? 'announcement' : 'logo')));

      const updatedGroupStates = { ...state.groupStates };
      Object.keys(updatedGroupStates).forEach(groupId => {
        if (updatedGroupStates[groupId]) {
          const stateGroup = updatedGroupStates[groupId];
          const directItem = stateGroup.directLiveItem;
          let newDirectItem = directItem;

          if (directItem) {
            const grpType = directItem.type === 'bible' ? 'bible' : (directItem.type === 'ppt' ? 'presentation' : directItem.type);
            if (grpType === targetScheduleType) {
              newDirectItem = {
                ...directItem,
                customBackgroundUrl: finalAssetUrl,
              };
            }
          }

          updatedGroupStates[groupId] = {
            ...stateGroup,
            directLiveItem: newDirectItem,
            timestamp: Date.now(),
          };
        }
      });

      // Broadcast to external projector displays and stage views
      broadcastStateChange({
        type: 'GROUP_STATES_UPDATE',
        data: { groupStates: updatedGroupStates },
      });

      if (updatedSchedule) {
        broadcastStateChange({
          type: 'SCHEDULE_UPDATE',
          data: { activeSchedule: updatedSchedule },
        });
      }

      broadcastStateChange({
        type: 'SYSTEM_UPDATE',
        data: { themesList: updatedThemes, systemOptions: nextSystemOptions },
      });

      return {
        assetsList: updatedAssetsList,
        systemOptions: nextSystemOptions,
        themesList: updatedThemes,
        songsList: updatedSongs,
        activeSchedule: updatedSchedule,
        groupStates: updatedGroupStates,
      };
    });
  }
}));


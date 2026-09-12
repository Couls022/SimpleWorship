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
import { dbApi, registerAsset } from '../db';
import { defaultOutputGroups, defaultSchedule, defaultSongs, defaultThemes, defaultAssets, defaultScriptures } from '../db/seedData';
import { defaultSystemOptions } from '../db/defaultOptions';
import { DEFAULT_SIMPLEWORSHIP_MAPPINGS } from '../utils/keyboardShortcuts';
import { ThemeEngine } from '../core/ThemeEngine';
import { PresentationCore } from '../core/PresentationCore';
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

export const DEFAULT_ALERT_PRESETS: AlertPreset[] = [];

const ALERT_PRESETS_STORAGE_KEY = 'simpleworship_alert_presets_v2';

const getStoredAlertPresets = (): AlertPreset[] => {
  try {
    const saved = localStorage.getItem(ALERT_PRESETS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading stored alert presets', e);
  }
  return [];
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
  // Staged Presentation States (for operator preview before commit)
  stagedGroupStates: Record<string, PresentationState>;
  setStagedGroupState: (groupId: string, state: Partial<PresentationState>) => void;
  commitStagedState: (groupId: string) => void;
  
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
  toggleMasterLive: (groupId?: string) => void;

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
  setDefaultBackground: (assetUrl: string, scope: 'songs' | 'scriptures' | 'presentations' | 'announcements' | 'logo' | 'timers', isVideo?: boolean) => void;
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

      // Invalidate cached slides so slide breakdown changes (breakOnNewVerse, flow threshold) immediately reflect
      PresentationCore.clearSlideCache();

      // Trigger timestamp update on all groupStates and stagedGroupStates so live displays and canvas re-render instantly with fresh system options
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

      const updatedStagedGroupStates = { ...state.stagedGroupStates };
      Object.keys(updatedStagedGroupStates).forEach(groupId => {
        if (updatedStagedGroupStates[groupId]) {
          updatedStagedGroupStates[groupId] = {
            ...updatedStagedGroupStates[groupId],
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

      DisplayManager.syncPhysicalDisplays(state.outputGroups, updatedGroupStates, state.activeControlGroupId).catch(() => {});

      return {
        systemOptions: next,
        themesList: updatedThemes,
        groupStates: updatedGroupStates,
        stagedGroupStates: updatedStagedGroupStates,
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
      targetOutputGroupId: 'group-r2',
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
    let newStagedStates = { ...state.stagedGroupStates };

    // Find which output groups are currently targeted by existing router panels
    const assignedGroupIds = new Set(state.routerPanels.map(p => p.targetOutputGroupId).filter(Boolean));

    // If targetGroupId is not specified or already taken, find an unassigned group or create a new dedicated one
    if (!targetGroupId || assignedGroupIds.has(targetGroupId)) {
      const unassignedGroup = state.outputGroups.find(g => !assignedGroupIds.has(g.id));
      if (unassignedGroup) {
        targetGroupId = unassignedGroup.id;
      } else {
        const count = state.routerPanels.length + 1;
        const createdGroupId = `group-output-${Date.now()}`;
        const defaultDisplayIds = state.outputGroups[0]?.displayIds || [];
        const newGroup: OutputGroup = {
          id: createdGroupId,
          name: `Router ${count} (Overlay R${count})`,
          role: 'broadcast',
          themeId: count % 2 === 0 ? 'theme-scripture' : 'theme-global',
          displayIds: defaultDisplayIds.length > 0 ? [...defaultDisplayIds] : [],
          isBlack: false,
          isClear: false,
          showLogo: false
        };
        newGroups.push(newGroup);

        const isMasterLive = Boolean(
          state.groupStates['group-congregation']?.isLiveEnabled || 
          (state.activeControlGroupId && state.groupStates[state.activeControlGroupId]?.isLiveEnabled)
        );

        newGroupStates[createdGroupId] = {
          ...defaultState,
          activeItemId: null,
          activeSlideIndex: 0,
          isLiveEnabled: isMasterLive,
          timestamp: Date.now()
        };
        newStagedStates[createdGroupId] = {
          ...defaultState,
          activeItemId: null,
          activeSlideIndex: 0,
          isLiveEnabled: isMasterLive,
          timestamp: Date.now()
        };
        dbApi.saveOutputGroup(newGroup);
        targetGroupId = createdGroupId;
      }
    }

    if (targetGroupId && !newStagedStates[targetGroupId]) {
      newStagedStates[targetGroupId] = {
        ...defaultState,
        activeItemId: null,
        activeSlideIndex: 0,
        isLiveEnabled: Boolean(newGroupStates[targetGroupId]?.isLiveEnabled),
        timestamp: Date.now()
      };
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

    scheduleGroupStatesSave(newGroupStates);
    broadcastStateChange({
      type: 'SYNC_STATE',
      data: {
        outputGroups: newGroups,
        groupStates: newGroupStates,
        routerPanels: panels,
        activeControlGroupId: targetGroupId,
      }
    });
    DisplayManager.syncPhysicalDisplays(newGroups, newGroupStates, targetGroupId).catch(() => {});

    return {
      outputGroups: newGroups,
      groupStates: newGroupStates,
      stagedGroupStates: newStagedStates,
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

    broadcastStateChange({
      type: 'SYNC_STATE',
      data: {
        outputGroups: state.outputGroups,
        groupStates: state.groupStates,
        routerPanels: panels,
        activeControlGroupId: newActiveTarget,
      }
    });

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

    broadcastStateChange({
      type: 'SYNC_STATE',
      data: {
        routerPanels: panels,
        activeControlGroupId: activeTarget,
      }
    });

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
        activeControlGroupId: newActiveTarget || state.activeControlGroupId,
        previewItemId: activePanel?.previewItemId ?? null,
        previewSlideIndex: activePanel?.previewSlideIndex ?? 0
      };
    });
    const { outputGroups, groupStates, activeControlGroupId, routerPanels } = get();
    DisplayManager.syncPhysicalDisplays(outputGroups, groupStates, activeControlGroupId).catch(() => {});
    
    // Broadcast active router and active control group to all projector windows
    broadcastStateChange({
      type: 'SYNC_STATE',
      data: {
        activeRouterId: id,
        activeControlGroupId,
        routerPanels,
        outputGroups,
        groupStates
      }
    });
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
      
      broadcastStateChange({
        type: 'SYNC_STATE',
        data: {
          outputGroups: newGroups,
          groupStates: newStates,
          activeControlGroupId: state.activeControlGroupId
        }
      });

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

      broadcastStateChange({
        type: 'SYNC_STATE',
        data: {
          outputGroups: newGroups
        }
      });

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

      broadcastStateChange({
        type: 'SYNC_STATE',
        data: {
          outputGroups: newGroups
        }
      });

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
          isLiveEnabled: false,
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
    
    broadcastStateChange({
      type: 'SYNC_STATE',
      data: {
        outputGroups: current,
        groupStates: newGroupStates,
        activeControlGroupId: newActive
      }
    });

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
    'group-r2': { ...defaultState, activeItemId: null, activeSlideIndex: 0, timestamp: Date.now(), isLiveEnabled: false },
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

      if (!isOnlyPlaybackTimeUpdate) {
        // Debounce blocking synchronous localStorage writes to keep UI thread fluid and zero-lag
        scheduleGroupStatesSave(updatedGroupStates);

        broadcastStateChange({
          type: 'GROUP_STATES_UPDATE',
          data: { groupStates: updatedGroupStates }
        });

        if (newState.isLiveEnabled !== undefined && newState.isLiveEnabled !== current.isLiveEnabled) {
          DisplayManager.syncPhysicalDisplays(state.outputGroups, updatedGroupStates, state.activeControlGroupId).catch(() => {});
        }
      }

      return {
        groupStates: updatedGroupStates
      };
    });
  },

  stagedGroupStates: {
    'group-congregation': { ...defaultState, activeItemId: 'song-1', activeSlideIndex: 0, timestamp: Date.now(), isLiveEnabled: false },
    'group-r2': { ...defaultState, activeItemId: null, activeSlideIndex: 0, timestamp: Date.now(), isLiveEnabled: false },
    'group-stage': { ...defaultState, activeItemId: 'song-1', activeSlideIndex: 0, timestamp: Date.now(), isLiveEnabled: false },
  },
  setStagedGroupState: (groupId, newState) => {
    set((state) => {
      const current = state.stagedGroupStates[groupId] || defaultState;
      const combinedState = { ...current, ...newState, timestamp: Date.now() };

      const isOnlyPlaybackTimeUpdate = (
        Object.keys(newState).every(k => k === 'videoCurrentTime' || k === 'videoDuration')
      );

      let frame = current.renderFrame;
      if (!isOnlyPlaybackTimeUpdate) {
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

      // Synchronize canonical presentation state to both stagedGroupStates (Live Display Canvas)
      // and groupStates (Target Monitor / Projector).
      // Crucial: do NOT automatically force isLiveEnabled to true when updating content/staged state.
      // Retain whatever the user's explicit Live Switch state is (Live On or Live Off).
      const publicState = state.groupStates[groupId] || defaultState;
      const isCurrentlyLive = newState.isLiveEnabled !== undefined 
        ? newState.isLiveEnabled 
        : Boolean(publicState?.isLiveEnabled);

      combinedState.isLiveEnabled = isCurrentlyLive;

      const updatedStaged = {
        ...state.stagedGroupStates,
        [groupId]: combinedState
      };

      const updatedPublicGroup = {
        ...publicState,
        activeItemId: combinedState.activeItemId,
        activeSlideIndex: combinedState.activeSlideIndex,
        directLiveItem: combinedState.directLiveItem,
        isVideoPlaying: combinedState.isVideoPlaying,
        isVideoMuted: combinedState.isVideoMuted,
        isVideoLooping: combinedState.isVideoLooping,
        videoVolume: combinedState.videoVolume,
        videoSeekTime: combinedState.videoSeekTime,
        isBlack: combinedState.isBlack ?? false,
        isClear: combinedState.isClear ?? false,
        showLogo: combinedState.showLogo ?? false,
        isLiveEnabled: isCurrentlyLive,
        renderFrame: frame,
        timestamp: Date.now(),
      };

      const updatedGroupStates = {
        ...state.groupStates,
        [groupId]: updatedPublicGroup
      };

      if (!isOnlyPlaybackTimeUpdate) {
        scheduleGroupStatesSave(updatedGroupStates);

        broadcastStateChange({
          type: 'GROUP_STATES_UPDATE',
          data: { groupStates: updatedGroupStates }
        });
      }

      return {
        stagedGroupStates: updatedStaged,
        groupStates: updatedGroupStates
      };
    });
  },
  commitStagedState: (groupId) => {
    const { stagedGroupStates, outputGroups, groupStates, activeControlGroupId } = get();
    const targetGroupIds = groupId === 'ALL' ? outputGroups.map(g => g.id) : [groupId];
    let committedName = '';
    const updatedStates = { ...groupStates };

    targetGroupIds.forEach(id => {
      const staged = stagedGroupStates[id];
      const current = updatedStates[id] || defaultState;
      if (staged) {
        updatedStates[id] = {
          ...current,
          activeItemId: staged.activeItemId,
          activeSlideIndex: staged.activeSlideIndex,
          directLiveItem: staged.directLiveItem,
          isVideoPlaying: staged.isVideoPlaying,
          isVideoMuted: staged.isVideoMuted,
          isVideoLooping: staged.isVideoLooping,
          videoVolume: staged.videoVolume,
          videoSeekTime: staged.videoSeekTime,
          isBlack: false,
          isClear: false,
          showLogo: staged.showLogo ?? false,
          isLiveEnabled: true,
          renderFrame: staged.renderFrame,
          timestamp: Date.now(),
        };
        if (!committedName && staged.directLiveItem?.name) {
          committedName = staged.directLiveItem.name;
        }
      } else {
        updatedStates[id] = {
          ...current,
          isLiveEnabled: true,
          timestamp: Date.now(),
        };
      }
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

    // Immediately sync physical projector output
    DisplayManager.syncPhysicalDisplays(outputGroups, updatedStates, activeControlGroupId).catch(() => {});

    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', {
        detail: `LIVE ON: ${committedName ? `"${committedName}"` : 'Operator presentation'} sent to Projector!`
      })
    );
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
    const { outputGroups, groupStates, routerPanels } = get();
    DisplayManager.syncPhysicalDisplays(outputGroups, groupStates, id).catch(() => {});
    
    // Broadcast active control change with current states so ProjectorView can mirror the active tab without dropping state
    broadcastStateChange({ 
      type: 'SYNC_STATE', 
      data: { 
        activeControlGroupId: id,
        outputGroups,
        groupStates,
        routerPanels
      } 
    });
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

    if (!targetGroupId) return;

    // Check if there is already a staged item ready for this group
    const staged = state.stagedGroupStates[targetGroupId];
    if (staged?.activeItemId) {
      // Commit what is already verified on the operator stage
      state.commitStagedState(targetGroupId);
      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', { 
          detail: 'Pushed Staged Content Directly to Live Output (F5 / Enter)' 
        })
      );
      return;
    }

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
          detail: 'Please select a song or slide in Schedule or Library to Stage' 
        })
      );
      return;
    }

    const itemToRoute = state.activeSchedule?.items?.find(i => i.id === itemIdToUse);
    if (itemToRoute) {
      get().goLiveItem(itemToRoute.id, slideIdxToUse, targetGroupId, itemToRoute, routerIdToUse);
      get().commitStagedState(targetGroupId);
    } else {
      get().goLiveItem(itemIdToUse, slideIdxToUse, targetGroupId, undefined, routerIdToUse);
      get().commitStagedState(targetGroupId);
    }
  },

  goLiveItem: (itemId, slideIndex = 0, targetGroupId, directItem, routerId) => {
    const { activeControlGroupId, setStagedGroupState, outputGroups, activeSchedule, songsList, routerPanels, activeRouterId } = get();
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
          customBackgroundUrl: undefined
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
      setStagedGroupState(groupToUpdate, {
        activeItemId: itemId,
        activeSlideIndex: slideIndex,
        directLiveItem: liveItem || null,
        isBlack: false,
        isClear: false,
      });
      if (routerIdToUse !== activeRouterId || groupToUpdate !== activeControlGroupId) {
        set({ activeControlGroupId: groupToUpdate, activeRouterId: routerIdToUse });
      }
    } else if (outputGroups.length > 0) {
      outputGroups.forEach(g => {
        setStagedGroupState(g.id, {
          activeItemId: itemId,
          activeSlideIndex: slideIndex,
          directLiveItem: liveItem || null,
          isBlack: false,
          isClear: false,
        });
      });
    }

    const targetGroupState = groupToUpdate ? get().groupStates[groupToUpdate] : undefined;
    const isLive = Boolean(targetGroupState?.isLiveEnabled);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: isLive
          ? `LIVE: "${liveItem?.name || 'Item'}" actively mirrored on Projector.`
          : `STAGED: "${liveItem?.name || 'Item'}" ready on Live Display Canvas (Projector is in Standby/Black).`
      })
    );
  },

  // LIVE Navigation & Controls
  goLiveNext: () => {
    const { activeControlGroupId, stagedGroupStates, groupStates, activeSchedule, songsList, shortcutSettings, outputGroups, systemOptions } = get();
    const targetGroupId = activeControlGroupId || (outputGroups.length > 0 ? outputGroups[0].id : 'group-congregation');
    const currentState = stagedGroupStates[targetGroupId] || groupStates[targetGroupId] || defaultState;
    const currentItemId = currentState.activeItemId || activeSchedule?.items?.[0]?.id || songsList?.[0]?.id;

    let totalSlides = 1;
    if (currentItemId) {
      const liveItem = (
        currentState.directLiveItem 
        || activeSchedule?.items?.find(i => i.id === currentItemId)
        || (songsList.find(s => s.id === currentItemId) ? { id: currentItemId, name: '', type: 'song', contentId: currentItemId } as any : null)
      );
      if (liveItem) {
        const slides = PresentationCore.generateSlides(liveItem, songsList, systemOptions);
        totalSlides = Math.max(1, slides.length);
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
    get().setStagedGroupState(targetGroupId, { 
      activeItemId: currentItemId,
      activeSlideIndex: nextIndex 
    });
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Next Slide: #${nextIndex + 1}${totalSlides > 1 ? ` of ${totalSlides}` : ''}` 
      })
    );
  },
  
  goLivePrev: () => {
    const { activeControlGroupId, stagedGroupStates, groupStates, activeSchedule, songsList, shortcutSettings, outputGroups, systemOptions } = get();
    const targetGroupId = activeControlGroupId || (outputGroups.length > 0 ? outputGroups[0].id : 'group-congregation');
    const currentState = stagedGroupStates[targetGroupId] || groupStates[targetGroupId] || defaultState;
    const currentItemId = currentState.activeItemId || activeSchedule?.items?.[0]?.id || songsList?.[0]?.id;

    let totalSlides = 1;
    if (currentItemId) {
      const liveItem = (
        currentState.directLiveItem 
        || activeSchedule?.items?.find(i => i.id === currentItemId)
        || (songsList.find(s => s.id === currentItemId) ? { id: currentItemId, name: '', type: 'song', contentId: currentItemId } as any : null)
      );
      if (liveItem) {
        const slides = PresentationCore.generateSlides(liveItem, songsList, systemOptions);
        totalSlides = Math.max(1, slides.length);
      }
    }

    let prevIndex = currentState.activeSlideIndex - 1;
    if (prevIndex < 0) {
      if (shortcutSettings.wrapAroundSlides) {
        prevIndex = Math.max(0, totalSlides - 1);
      } else {
        prevIndex = 0;
      }
    }
    get().setStagedGroupState(targetGroupId, { 
      activeItemId: currentItemId,
      activeSlideIndex: prevIndex 
    });
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Prev Slide: #${prevIndex + 1}${totalSlides > 1 ? ` of ${totalSlides}` : ''}` 
      })
    );
  },

  goLiveSlide: (slideIndex: number, groupId?: string) => {
    const { activeControlGroupId, outputGroups, setStagedGroupState } = get();
    const targetGroupId = groupId || activeControlGroupId || (outputGroups.length > 0 ? outputGroups[0].id : 'group-congregation');
    setStagedGroupState(targetGroupId, { activeSlideIndex: Math.max(0, slideIndex) });
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
  
  toggleBlack: (groupId?: string) => {
    const { stagedGroupStates, groupStates, outputGroups, activeControlGroupId } = get();
    const targetGroupId = groupId || activeControlGroupId || outputGroups[0]?.id || 'group-congregation';
    const currentState = stagedGroupStates[targetGroupId] || groupStates[targetGroupId] || defaultState;
    const nextBlack = !currentState.isBlack;
    get().setStagedGroupState(targetGroupId, { isBlack: nextBlack, showLogo: false });
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: nextBlack ? 'Blackout Enabled (F6 / B)' : 'Blackout Disabled' 
      })
    );
  },
  
  toggleClear: (groupId?: string) => {
    const { stagedGroupStates, groupStates, outputGroups, activeControlGroupId } = get();
    const targetGroupId = groupId || activeControlGroupId || outputGroups[0]?.id || 'group-congregation';
    const currentState = stagedGroupStates[targetGroupId] || groupStates[targetGroupId] || defaultState;
    const nextClear = !currentState.isClear;
    get().setStagedGroupState(targetGroupId, { isClear: nextClear });
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: nextClear ? 'Clear Text Enabled (F7 / C)' : 'Text Restored' 
      })
    );
  },

  toggleLogo: (groupId?: string) => {
    const { stagedGroupStates, groupStates, outputGroups, activeControlGroupId } = get();
    const targetGroupId = groupId || activeControlGroupId || outputGroups[0]?.id || 'group-congregation';
    const currentState = stagedGroupStates[targetGroupId] || groupStates[targetGroupId] || defaultState;
    const nextLogo = !currentState.showLogo;
    get().setStagedGroupState(targetGroupId, { showLogo: nextLogo, isBlack: false });
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: nextLogo ? 'Logo Display Enabled (F8 / L)' : 'Logo Display Disabled' 
      })
    );
  },

  toggleMasterLive: (groupId?: string) => {
    const { groupStates, stagedGroupStates, outputGroups, activeControlGroupId, songsList, themesList, systemOptions, activeSchedule } = get();
    
    // Check if master live is currently on
    const isCurrentlyLive = groupId 
      ? Boolean(groupStates[groupId]?.isLiveEnabled)
      : Boolean(groupStates['group-congregation']?.isLiveEnabled || (activeControlGroupId && groupStates[activeControlGroupId]?.isLiveEnabled));
    const nextLive = !isCurrentlyLive;

    const updatedStates = { ...groupStates };
    const updatedStaged = { ...stagedGroupStates };

    const targetGroupIds = groupId 
      ? [groupId] 
      : outputGroups.filter(g => g.role === 'broadcast' || g.id === 'group-congregation' || g.id === 'group-r2').map(g => g.id);

    targetGroupIds.forEach(targetGroupId => {
      const currentState = groupStates[targetGroupId] || defaultState;
      const targetGroup = outputGroups.find(g => g.id === targetGroupId);

      if (nextLive) {
        // Turning LIVE ON:
        // Mirror the staged content from the Live Display Canvas to the projector screen
        const staged = stagedGroupStates[targetGroupId] || currentState;
        let effectiveActiveItemId = staged.activeItemId || currentState.activeItemId;
        let effectiveDirectLiveItem = staged.directLiveItem || currentState.directLiveItem;

        // If activeItemId is still not set, default to first item in schedule or song list for congregation
        if (!effectiveActiveItemId && !effectiveDirectLiveItem && targetGroupId === 'group-congregation') {
          if (activeSchedule?.items && activeSchedule.items.length > 0) {
            effectiveActiveItemId = activeSchedule.items[0].id;
            effectiveDirectLiveItem = activeSchedule.items[0];
          } else if (songsList.length > 0) {
            effectiveActiveItemId = songsList[0].id;
            const s = songsList[0];
            effectiveDirectLiveItem = {
              id: s.id,
              type: 'song',
              name: s.title,
              contentId: s.id,
              notes: s.author || '',
              isExpanded: false,
              customBackgroundUrl: undefined,
            };
          }
        }

        const combined = {
          ...staged,
          activeScheduleId: staged.activeScheduleId || activeSchedule?.id || null,
          activeItemId: effectiveActiveItemId,
          activeSlideIndex: staged.activeSlideIndex ?? 0,
          directLiveItem: effectiveDirectLiveItem || null,
          isVideoPlaying: staged.isVideoPlaying,
          isVideoMuted: staged.isVideoMuted,
          isVideoLooping: staged.isVideoLooping,
          videoVolume: staged.videoVolume,
          videoSeekTime: staged.videoSeekTime,
          isBlack: false,
          isClear: false,
          showLogo: staged.showLogo ?? false,
          isLiveEnabled: true,
        };

        const frame = staged.renderFrame || buildRenderFrame(
          targetGroupId,
          combined,
          activeSchedule,
          targetGroup,
          systemOptions,
          songsList,
          themesList,
          DisplayManager.getCachedDisplays()
        );

        updatedStates[targetGroupId] = {
          ...currentState,
          ...combined,
          renderFrame: frame,
          timestamp: Date.now(),
        };

        updatedStaged[targetGroupId] = {
          ...staged,
          ...combined,
          renderFrame: frame,
          timestamp: Date.now(),
        };
      } else {
        // Turning LIVE OFF:
        // Projector screen returns to Standby / Black
        updatedStates[targetGroupId] = {
          ...currentState,
          isLiveEnabled: false,
          timestamp: Date.now(),
        };
        if (updatedStaged[targetGroupId]) {
          updatedStaged[targetGroupId] = {
            ...updatedStaged[targetGroupId],
            isLiveEnabled: false,
            timestamp: Date.now(),
          };
        }
      }
    });

    set({ groupStates: updatedStates, stagedGroupStates: updatedStaged });

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
        detail: nextLive 
          ? 'LIVE ON: Projector is now actively mirroring the Live Display Canvas' 
          : 'LIVE OFF: Projector is in Standby/Black. Canvas is open for staging.' 
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
    // 1. Fetch and register assets first so assetUrlMap and objectUrlCache are fully ready
    const assets = await dbApi.getAllAssets();
    assets.forEach(a => registerAsset(a));

    const [songs, themes, outputGroups, schedules, scriptures, storedOptions] = await Promise.all([
      dbApi.getAllSongs(),
      dbApi.getAllThemes(),
      dbApi.getOutputGroups(),
      dbApi.getAllSchedules(),
      dbApi.getAllScriptures(),
      dbApi.getSystemOptions().catch(() => null),
    ]);

    // Map old ephemeral blob URLs (stored in DB) to newly minted blob URLs
    const assetUrlMap = new Map<string, string>();
    assets.forEach(a => {
      if ((a as any)._oldUrl) {
        assetUrlMap.set((a as any)._oldUrl, a.url);
      }
      assetUrlMap.set(a.id, a.url);
      assetUrlMap.set(a.url, a.url);
    });

    const mapUrl = (url: string | undefined) => {
      if (!url) return undefined;
      return assetUrlMap.get(url) || url;
    };

    if (storedOptions) {
      if (storedOptions.general?.defaultLogoUrl) {
        storedOptions.general.defaultLogoUrl = mapUrl(storedOptions.general.defaultLogoUrl);
      }
      if (storedOptions.mainOutput?.general?.defaultLogoUrl) {
        storedOptions.mainOutput.general.defaultLogoUrl = mapUrl(storedOptions.mainOutput.general.defaultLogoUrl);
      }
      if (storedOptions.mainOutput?.general?.logoUrl) {
        storedOptions.mainOutput.general.logoUrl = mapUrl(storedOptions.mainOutput.general.logoUrl);
      }
      if (storedOptions.mainOutput?.song?.backdropAssetUrl) {
        storedOptions.mainOutput.song.backdropAssetUrl = mapUrl(storedOptions.mainOutput.song.backdropAssetUrl);
      }
      if (storedOptions.mainOutput?.scripture?.backdropAssetUrl) {
        storedOptions.mainOutput.scripture.backdropAssetUrl = mapUrl(storedOptions.mainOutput.scripture.backdropAssetUrl);
      }
      if ((storedOptions.serviceIntervals as any)?.backgroundAssetUrl) {
        (storedOptions.serviceIntervals as any).backgroundAssetUrl = mapUrl((storedOptions.serviceIntervals as any).backgroundAssetUrl);
      }
      if (storedOptions.serviceIntervals?.backgroundAssetId) {
        const mappedBg = mapUrl(storedOptions.serviceIntervals.backgroundAssetId);
        (storedOptions.serviceIntervals as any).backgroundAssetUrl = mappedBg;
      }
      set(state => ({
        systemOptions: {
          ...state.systemOptions,
          ...storedOptions,
        }
      }));
    }

    // Ensure all seed songs and built-in songs are populated
    let mergedSongs = songs.map(s => {
      // Strip old default unsplash background URLs from songs
      if (s.defaultBackgroundUrl && s.defaultBackgroundUrl.includes('unsplash.com')) {
        const { defaultBackgroundUrl, ...rest } = s;
        return rest as Song;
      }
      const mappedThemeOverride = s.themeOverride ? {
        ...s.themeOverride,
        backgroundImageUrl: mapUrl(s.themeOverride.backgroundImageUrl),
        backgroundVideoUrl: mapUrl(s.themeOverride.backgroundVideoUrl),
        logoUrl: mapUrl(s.themeOverride.logoUrl)
      } : undefined;

      return {
        ...s,
        defaultBackgroundUrl: mapUrl(s.defaultBackgroundUrl),
        themeOverride: mappedThemeOverride
      };
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
      return {
        ...t,
        styles: {
          ...t.styles,
          backgroundImageUrl: mapUrl(t.styles.backgroundImageUrl),
          backgroundVideoUrl: mapUrl(t.styles.backgroundVideoUrl),
          logoUrl: mapUrl(t.styles.logoUrl),
        }
      } as Theme;
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
      const songBgUrl = mergedThemes.find(t => t.type === 'song' || t.id === 'theme-song')?.styles?.backgroundImageUrl || mergedThemes.find(t => t.type === 'song' || t.id === 'theme-song')?.styles?.backgroundVideoUrl || storedOptions?.mainOutput?.song?.backdropAssetUrl;
      const bibleBgUrl = mergedThemes.find(t => t.type === 'bible' || t.id === 'theme-scripture')?.styles?.backgroundImageUrl || mergedThemes.find(t => t.type === 'bible' || t.id === 'theme-scripture')?.styles?.backgroundVideoUrl || storedOptions?.mainOutput?.scripture?.backdropAssetUrl;
      const pptBgUrl = mergedThemes.find(t => t.type === 'presentation' || t.id === 'theme-presentation')?.styles?.backgroundImageUrl || mergedThemes.find(t => t.type === 'presentation' || t.id === 'theme-presentation')?.styles?.backgroundVideoUrl;
      const annBgUrl = mergedThemes.find(t => t.type === 'announcement' || t.id === 'theme-announcement')?.styles?.backgroundImageUrl || mergedThemes.find(t => t.type === 'announcement' || t.id === 'theme-announcement')?.styles?.backgroundVideoUrl;
      const timerBgUrl = storedOptions?.serviceIntervals?.backgroundAssetId || (storedOptions?.serviceIntervals as any)?.backgroundAssetUrl || mergedThemes.find(t => t.type === 'timer' || t.id === 'theme-timer')?.styles?.backgroundImageUrl || mergedThemes.find(t => t.type === 'timer' || t.id === 'theme-timer')?.styles?.backgroundVideoUrl;

      const hydratedAssets = assets.map(a => {
        const scopes = { ...(a.isDefaultScope || {}) };
        if (logoUrl && (a.url === logoUrl || a.id === logoUrl)) scopes.logo = true;
        if (songBgUrl && (a.url === songBgUrl || a.id === songBgUrl)) scopes.songs = true;
        if (bibleBgUrl && (a.url === bibleBgUrl || a.id === bibleBgUrl)) scopes.scriptures = true;
        if (pptBgUrl && (a.url === pptBgUrl || a.id === pptBgUrl)) scopes.presentations = true;
        if (annBgUrl && (a.url === annBgUrl || a.id === annBgUrl)) scopes.announcements = true;
        if (timerBgUrl && (a.url === timerBgUrl || a.id === timerBgUrl)) scopes.timers = true;
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
    let finalOutputGroups = [...outputGroups];
    if (!finalOutputGroups || finalOutputGroups.length === 0) {
      finalOutputGroups = [...defaultOutputGroups];
      await Promise.all(defaultOutputGroups.map(g => dbApi.saveOutputGroup(g)));
    } else {
      // Ensure default groups like group-r2 exist
      for (const dg of defaultOutputGroups) {
        if (!finalOutputGroups.some(g => g.id === dg.id)) {
          finalOutputGroups.push(dg);
          dbApi.saveOutputGroup(dg).catch(() => {});
        }
      }
    }
    set({ outputGroups: finalOutputGroups });

    // Initialize or rehydrate group states
    let initialStates: Record<string, any> = {};
    try {
      const stored = localStorage.getItem('simpleworship_group_states_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          initialStates = parsed;
        }
      }
    } catch (e) {}

    finalOutputGroups.forEach(g => {
      if (!initialStates[g.id]) {
        initialStates[g.id] = { ...defaultState, isLiveEnabled: false, timestamp: Date.now() };
      }
    });

    const initialStaged: Record<string, any> = {};
    finalOutputGroups.forEach(g => {
      initialStaged[g.id] = { ...(initialStates[g.id] || defaultState) };
    });

    // Ensure router-2 routes to group-r2 if currently set to group-stage
    const currentPanels = get().routerPanels.map(p => {
      if (p.routerId === 'router-2' && p.targetOutputGroupId === 'group-stage') {
        return { ...p, targetOutputGroupId: 'group-r2' };
      }
      return p;
    });

    set({ 
      groupStates: initialStates,
      stagedGroupStates: initialStaged,
      routerPanels: currentPanels,
      activeControlGroupId: finalOutputGroups[0]?.id || 'group-congregation' 
    });

    try {
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
    const { blob, ...assetWithoutBlob } = asset;
    set((state) => ({ assetsList: [...state.assetsList.filter(a => a.id !== asset.id), assetWithoutBlob as any] }));
  },

  deleteAsset: async (id) => {
    await dbApi.deleteAsset(id);
    set((state) => ({ assetsList: state.assetsList.filter(a => a.id !== id) }));
  },
  setDefaultBackground: (assetUrl, scope, isVideo = false) => {
    set((state) => {
      const targetType = scope === 'scriptures' ? 'bible' : (scope === 'songs' ? 'song' : (scope === 'presentations' ? 'presentation' : (scope === 'announcements' ? 'announcement' : (scope === 'timers' ? 'timer' : 'logo'))));

      // Check if target asset is currently the active default for this scope to support toggle-off
      const targetAsset = state.assetsList.find(a => a.url === assetUrl || a.id === assetUrl);
      const isCurrentlyActiveDefault = targetAsset?.isDefaultScope?.[scope] === true;
      const isTogglingOff = isCurrentlyActiveDefault;

      const finalAssetId = isTogglingOff ? undefined : (targetAsset?.id || assetUrl);
      const finalAssetBlobUrl = isTogglingOff ? undefined : (targetAsset?.url || assetUrl);

      // Register asset in memory cache
      if (targetAsset) {
        registerAsset(targetAsset);
      }

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

        registerAsset(updated);
        dbApi.addAsset(updated).catch(() => {});
        return updated;
      });

      // 2. Persist in SystemOptions depending on scope
      let nextSystemOptions = { ...state.systemOptions };
      if (scope === 'logo') {
        const sysOptsForDb = {
          ...state.systemOptions,
          mainOutput: {
            ...state.systemOptions?.mainOutput,
            general: {
              ...(state.systemOptions?.mainOutput?.general || {}),
              defaultLogoUrl: finalAssetId,
              logoUrl: finalAssetId,
            } as any
          },
          general: {
            ...((state.systemOptions as any)?.general || {}),
            defaultLogoUrl: finalAssetId,
          } as any
        };
        nextSystemOptions = {
          ...sysOptsForDb,
          mainOutput: {
            ...sysOptsForDb.mainOutput,
            general: { ...sysOptsForDb.mainOutput.general, defaultLogoUrl: finalAssetBlobUrl, logoUrl: finalAssetBlobUrl } as any
          },
          general: { ...sysOptsForDb.general, defaultLogoUrl: finalAssetBlobUrl } as any
        };
        try {
          localStorage.setItem('simpleworship_system_options_v1', JSON.stringify(sysOptsForDb));
        } catch (e) {}
        dbApi.saveSystemOptions(sysOptsForDb).catch(() => {});
      } else if (scope === 'timers') {
        const sysOptsForDb: SystemOptions = {
          ...state.systemOptions,
          serviceIntervals: {
            ...(state.systemOptions?.serviceIntervals || { countdownEnabled: false, countdownTime: '05:00', intervalType: 'Pre-Service Countdown', showOnMainDisplay: false }),
            backgroundAssetId: finalAssetId,
            backgroundAssetUrl: finalAssetBlobUrl,
          }
        } as SystemOptions;
        nextSystemOptions = sysOptsForDb;
        try {
          localStorage.setItem('simpleworship_system_options_v1', JSON.stringify(sysOptsForDb));
        } catch (e) {}
        dbApi.saveSystemOptions(sysOptsForDb).catch(() => {});
      } else if (scope === 'songs') {
        const sysOptsForDb: SystemOptions = {
          ...state.systemOptions,
          mainOutput: {
            ...state.systemOptions?.mainOutput,
            song: {
              ...(state.systemOptions?.mainOutput?.song || {}),
              backdropAssetUrl: finalAssetBlobUrl,
            }
          }
        } as SystemOptions;
        nextSystemOptions = sysOptsForDb;
        try {
          localStorage.setItem('simpleworship_system_options_v1', JSON.stringify(sysOptsForDb));
        } catch (e) {}
        dbApi.saveSystemOptions(sysOptsForDb).catch(() => {});
      } else if (scope === 'scriptures') {
        const sysOptsForDb: SystemOptions = {
          ...state.systemOptions,
          mainOutput: {
            ...state.systemOptions?.mainOutput,
            scripture: {
              ...(state.systemOptions?.mainOutput?.scripture || {}),
              backdropAssetUrl: finalAssetBlobUrl,
            }
          }
        } as SystemOptions;
        nextSystemOptions = sysOptsForDb;
        try {
          localStorage.setItem('simpleworship_system_options_v1', JSON.stringify(sysOptsForDb));
        } catch (e) {}
        dbApi.saveSystemOptions(sysOptsForDb).catch(() => {});
      }

      // 3. Update Theme in themesList
      let themeFound = false;
      const updatedThemes: Theme[] = state.themesList.map(t => {
        const isMatch = (
          (scope === 'logo' && (t.type === 'logo' || t.id === 'theme-logo')) ||
          (scope === 'timers' && (t.type === 'timer' || t.id === 'theme-timer')) ||
          (scope === 'scriptures' && (t.type === 'bible' || t.id === 'theme-scripture' || t.id === 'theme-bible')) ||
          (scope === 'songs' && (t.type === 'song' || t.id === 'theme-song')) ||
          (scope === 'presentations' && (t.type === 'presentation' || (t.type as any) === 'ppt' || t.id === 'theme-presentation')) ||
          (scope === 'announcements' && (t.type === 'announcement' || t.id === 'theme-announcement'))
        );

        if (isMatch) {
          themeFound = true;
          const updatedForDb: Theme = {
            ...t,
            styles: {
              ...t.styles,
              backgroundType: isTogglingOff ? ('color' as const) : (isVideo ? 'video' : 'image'),
              backgroundImageUrl: (!isTogglingOff && !isVideo) ? finalAssetId : undefined,
              backgroundVideoUrl: (!isTogglingOff && isVideo) ? finalAssetId : undefined,
              logoUrl: scope === 'logo' ? finalAssetId : t.styles?.logoUrl,
            }
          };
          dbApi.addTheme(updatedForDb).catch(() => {});
          
          return {
            ...updatedForDb,
            styles: {
              ...updatedForDb.styles,
              backgroundImageUrl: (!isTogglingOff && !isVideo) ? finalAssetBlobUrl : undefined,
              backgroundVideoUrl: (!isTogglingOff && isVideo) ? finalAssetBlobUrl : undefined,
              logoUrl: scope === 'logo' ? finalAssetBlobUrl : updatedForDb.styles?.logoUrl,
            }
          };
        }
        return t;
      });

      if (!themeFound && !isTogglingOff) {
        const themeId = scope === 'logo' ? 'theme-logo' : (scope === 'timers' ? 'theme-timer' : (scope === 'scriptures' ? 'theme-scripture' : (scope === 'songs' ? 'theme-song' : (scope === 'presentations' ? 'theme-presentation' : `theme-${targetType}`))));
        const newThemeForDb: Theme = {
          id: themeId,
          name: `Default ${scope.charAt(0).toUpperCase() + scope.slice(1)} Theme`,
          type: targetType as any,
          styles: {
            backgroundType: isVideo ? 'video' : 'image',
            backgroundImageUrl: !isVideo ? finalAssetId : undefined,
            backgroundVideoUrl: isVideo ? finalAssetId : undefined,
            logoUrl: scope === 'logo' && !isVideo ? finalAssetId : undefined,
            showLogo: scope === 'logo',
          }
        };
        dbApi.addTheme(newThemeForDb).catch(() => {});
        
        const newThemeForState: Theme = {
          ...newThemeForDb,
          styles: {
            ...newThemeForDb.styles,
            backgroundImageUrl: !isVideo ? finalAssetBlobUrl : undefined,
            backgroundVideoUrl: isVideo ? finalAssetBlobUrl : undefined,
            logoUrl: scope === 'logo' && !isVideo ? finalAssetBlobUrl : undefined,
          }
        };
        updatedThemes.push(newThemeForState);
      }

      // Clear slide cache so existing slides immediately resolve the new background
      PresentationCore.clearSlideCache();

      // Trigger timestamp refresh across all group states and staged group states so Live cards, monitors, and projector view re-render
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

      const updatedStagedGroupStates = { ...state.stagedGroupStates };
      Object.keys(updatedStagedGroupStates).forEach(groupId => {
        if (updatedStagedGroupStates[groupId]) {
          updatedStagedGroupStates[groupId] = {
            ...updatedStagedGroupStates[groupId],
            renderFrame: undefined,
            timestamp: Date.now(),
          };
        }
      });

      // Broadcast to external projector displays and stage views
      broadcastStateChange({
        type: 'SYSTEM_UPDATE',
        data: { themesList: updatedThemes, systemOptions: nextSystemOptions },
      });
      broadcastStateChange({
        type: 'GROUP_STATES_UPDATE',
        data: { groupStates: updatedGroupStates },
      });

      return {
        assetsList: updatedAssetsList,
        systemOptions: nextSystemOptions,
        themesList: updatedThemes,
        groupStates: updatedGroupStates,
        stagedGroupStates: updatedStagedGroupStates,
      };
    });
  }
}));


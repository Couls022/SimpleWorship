import { create } from 'zustand';
import { Profile, PresentationState, OutputGroup, Schedule, PresentationItem, Song, ScriptureVerse, Asset, Theme, AlertState, SystemOptions, ShortcutSettings } from '../types';
import { dbApi } from '../db';
import { defaultOutputGroups, defaultSchedule, defaultSongs, defaultThemes, defaultAssets, defaultScriptures } from '../db/seedData';
import { defaultSystemOptions } from '../db/defaultOptions';
import { DEFAULT_SIMPLEWORSHIP_MAPPINGS } from '../utils/keyboardShortcuts';
import { ThemeEngine } from '../core/ThemeEngine';
import { v4 as uuidv4 } from 'uuid';

import { broadcastStateChange } from '../utils/broadcastSync';

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
  goLiveItem: (itemId: string, slideIndex?: number, targetGroupId?: string) => void; // Directly sends item to live

  // LIVE Navigation & Controls
  goLiveNext: () => void;
  goLivePrev: () => void;
  goNextScheduleItem: () => void;
  goPrevScheduleItem: () => void;
  toggleBlack: () => void;
  toggleClear: () => void;
  toggleLogo: () => void;
  isMasterLive: boolean;
  toggleMasterLive: () => void;

  // Alert / Nursery Ticker
  alert: AlertState;
  setAlert: (alert: Partial<AlertState>) => void;

  // Resources Data State
  resourcesTab: 'songs' | 'scriptures' | 'media' | 'presentations' | 'themes';
  setResourcesTab: (tab: 'songs' | 'scriptures' | 'media' | 'presentations' | 'themes') => void;
  isResourcesOpen: boolean;
  setIsResourcesOpen: (open: boolean) => void;
  toggleResources: () => void;

  songsList: Song[];
  scripturesList: ScriptureVerse[];
  assetsList: Asset[];
  themesList: Theme[];
  
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
      return { outputGroups: newGroups };
    });
  },
  setLivePanelCount: async (count) => {
    const state = get();
    let current = [...state.outputGroups];
    if (current.length === count) return;
    if (current.length > count) {
      const toRemove = current.slice(count);
      current = current.slice(0, count);
      await Promise.all(toRemove.map(g => dbApi.deleteOutputGroup(g.id)));
    } else {
      const toAdd: any[] = [];
      for (let i = current.length; i < count; i++) {
        toAdd.push({
          id: `group-dynamic-${Date.now()}-${i}`,
          name: `Display ${i + 1}`,
          role: "confidence",
          displayIds: [],
          isBlack: false,
          isClear: false,
          showLogo: true
        });
      }
      current = [...current, ...toAdd];
      await Promise.all(toAdd.map(g => dbApi.saveOutputGroup(g)));
    }
    set({ outputGroups: current });
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
    'group-main': { ...defaultState, activeItemId: 'item-gen-1-7', activeSlideIndex: 0, timestamp: Date.now() },
  },
  setGroupState: (groupId, newState) => {
    set((state) => {
      const current = state.groupStates[groupId] || defaultState;
      const updatedGroupStates = {
        ...state.groupStates,
        [groupId]: { ...current, ...newState, timestamp: Date.now() }
      };

      try {
        localStorage.setItem('simpleworship_group_states_v1', JSON.stringify(updatedGroupStates));
      } catch (e) {}

      broadcastStateChange({
        type: 'GROUP_STATES_UPDATE',
        data: { groupStates: updatedGroupStates }
      });

      return {
        groupStates: updatedGroupStates
      };
    });
  },

  activeControlGroupId: 'group-main',
  setActiveControlGroupId: (id) => set({ activeControlGroupId: id }),

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
      dbApi.addSchedule(updatedSchedule);
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

  goLiveItem: (itemId, slideIndex = 0, targetGroupId) => {
    const { activeControlGroupId, setGroupState, outputGroups } = get();
    const groupToUpdate = targetGroupId || activeControlGroupId || (outputGroups.length > 0 ? outputGroups[0].id : undefined);

    set({ previewItemId: itemId, previewSlideIndex: slideIndex });

    if (groupToUpdate) {
      setGroupState(groupToUpdate, {
        activeItemId: itemId,
        activeSlideIndex: slideIndex,
        isBlack: false,
        isClear: false,
      });
      if (groupToUpdate !== activeControlGroupId) {
        set({ activeControlGroupId: groupToUpdate });
      }
    } else if (outputGroups.length > 0) {
      outputGroups.forEach(g => {
        setGroupState(g.id, {
          activeItemId: itemId,
          activeSlideIndex: slideIndex,
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

  isMasterLive: true,
  toggleMasterLive: () => set((state) => ({ isMasterLive: !state.isMasterLive })),

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

  // Resources State
  resourcesTab: 'scriptures', // Default matching screenshot showing Scriptures tab
  setResourcesTab: (tab) => set({ resourcesTab: tab }),
  isResourcesOpen: true,
  setIsResourcesOpen: (open) => set({ isResourcesOpen: open }),
  toggleResources: () => set((state) => ({ isResourcesOpen: !state.isResourcesOpen })),

  songsList: defaultSongs,
  scripturesList: defaultScriptures,
  assetsList: defaultAssets,
  themesList: defaultThemes,

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

    if (!localStorage.getItem('worship_v3_panels_migrated')) {
      await Promise.all(outputGroups.map(g => dbApi.deleteOutputGroup(g.id)));
      defaultOutputGroups.forEach(g => dbApi.saveOutputGroup(g));
      get().setOutputGroups(defaultOutputGroups);
      localStorage.setItem('worship_v3_panels_migrated', 'true');
    } else {
      let finalGroups = outputGroups;
      try {
        const savedOrder = JSON.parse(localStorage.getItem('simpleworship_output_groups_order') || '[]');
        if (Array.isArray(savedOrder) && savedOrder.length > 0) {
          const map = new Map(outputGroups.map(g => [g.id, g]));
          const ordered: OutputGroup[] = [];
          savedOrder.forEach(id => {
            if (map.has(id)) {
              ordered.push(map.get(id)!);
              map.delete(id);
            }
          });
          // append any remaining
          map.forEach(g => ordered.push(g));
          if (ordered.length > 0) {
            finalGroups = ordered;
          }
        }
      } catch (e) {}
      get().setOutputGroups(finalGroups);
    }
    if (schedules.length > 0) {
      set({ activeSchedule: schedules[0] });
    }
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


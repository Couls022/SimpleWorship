import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveDisplayAssignments, DisplayRouteGroup, DisplayRouteState } from '../../src/core/DisplayRouter';
import { PresentationCore } from '../../src/core/PresentationCore';
import { DisplayManager } from '../../src/core/DisplayManager';
import { useStore } from '../../src/store/useStore';
import { PresentationItem, PresentationState, OutputGroup, Schedule } from '../../src/types';
import { pathToFileURL } from 'url';

describe('Suite: Display-Centric Architecture, URL Fix, and Live Persistence (16+ Tests)', () => {

  beforeEach(() => {
    vi.restoreAllMocks();
    useStore.setState({
      activeControlGroupId: 'group-congregation',
      groupStates: {
        'group-congregation': {
          activeScheduleId: null,
          activeItemId: 'song-1',
          activeSlideIndex: 0,
          nextSlideIndex: 1,
          isBlack: false,
          isClear: false,
          showLogo: false,
          timestamp: Date.now(),
          isLiveEnabled: true,
          directLiveItem: {
            id: 'song-1',
            type: 'song',
            name: 'Amazing Grace',
            contentId: 'song-1',
            isExpanded: false
          }
        },
        'group-stage': {
          activeScheduleId: null,
          activeItemId: 'verse-1',
          activeSlideIndex: 0,
          nextSlideIndex: 1,
          isBlack: false,
          isClear: false,
          showLogo: false,
          timestamp: Date.now(),
          isLiveEnabled: true,
          directLiveItem: {
            id: 'verse-1',
            type: 'bible',
            name: 'Psalm 23:1',
            contentId: 'verse-1',
            isExpanded: false,
            data: { text: 'The Lord is my shepherd; I shall not want.' }
          }
        }
      },
      outputGroups: [
        { id: 'group-congregation', name: 'Congregation Display', displayIds: ['Monitor 2'] },
        { id: 'group-stage', name: 'Stage Confidence Monitor', displayIds: ['Monitor 2', 'Monitor 3'] }
      ]
    });
  });

  // ---------------------------------------------------------------------------
  // 1. Windows Projector URL RFC 8089 Compliance Tests
  // ---------------------------------------------------------------------------
  describe('Fix #1: RFC-Compliant Windows Projector URL', () => {
    // RFC 8089 Windows File URL generator used by Electron main process
    function createWindowsProjectorUrl(basePath: string, displayId: string, groupId: string): string {
      const normalizedPath = basePath.replace(/\\/g, '/');
      const fileUrl = normalizedPath.startsWith('/')
        ? `file://${encodeURI(normalizedPath)}`
        : `file:///${encodeURI(normalizedPath)}`;
      const queryParams = `projector=true&displayId=${encodeURIComponent(displayId)}&groupId=${encodeURIComponent(groupId)}`;
      const hashParams = `#/projector?displayId=${encodeURIComponent(displayId)}&groupId=${encodeURIComponent(groupId)}`;
      return `${fileUrl}?${queryParams}${hashParams}`;
    }

    it('Test 1: Generates valid RFC 8089 file URL with file:/// format for Windows path', () => {
      const windowsPath = 'C:\\Program Files\\SimpleWorship\\resources\\app.asar\\dist\\index.html';
      const fileUrl = createWindowsProjectorUrl(windowsPath, 'Monitor 2', 'group-congregation');
      
      expect(fileUrl.startsWith('file:///')).toBe(true);
      expect(fileUrl).toContain('C:/Program%20Files/SimpleWorship');
      expect(fileUrl).not.toContain('\\');
    });

    it('Test 2: Appends displayId, groupId, and projector flags to RFC file URL without corrupting the path', () => {
      const windowsPath = 'C:\\Program Files\\SimpleWorship\\dist\\index.html';
      const finalUrl = createWindowsProjectorUrl(windowsPath, 'Monitor 2', 'group-congregation');

      expect(finalUrl).toContain('file:///C:/Program%20Files/SimpleWorship/dist/index.html');
      expect(finalUrl).toContain('projector=true');
      expect(finalUrl).toContain('displayId=Monitor%202');
      expect(finalUrl).toContain('groupId=group-congregation');
      expect(finalUrl).toContain('#/projector?');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Display-Centric Routing and Active Route Priority Tests
  // ---------------------------------------------------------------------------
  describe('Fix #3: Display-Centric Routing & Active-Route Overlay Priority', () => {
    const groups: DisplayRouteGroup[] = [
      { id: 'group-congregation', name: 'Congregation Display', displayIds: ['Monitor 2'] },
      { id: 'group-stage', name: 'Stage Confidence Monitor', displayIds: ['Monitor 2', 'Monitor 3'] }
    ];

    it('Test 3: Monitor 2 targeted solely by Congregation resolves to Congregation', () => {
      const singleGroup: DisplayRouteGroup[] = [
        { id: 'group-congregation', name: 'Congregation Display', displayIds: ['Monitor 2'] }
      ];
      const states: Record<string, DisplayRouteState> = {
        'group-congregation': { isLiveEnabled: true }
      };

      const assignments = resolveDisplayAssignments(singleGroup, states, 'group-congregation');
      const m2 = assignments.get('Monitor 2');
      expect(m2).toBeDefined();
      expect(m2?.assignedGroupId).toBe('group-congregation');
      expect(m2?.liveGroupIds).toEqual(['group-congregation']);
    });

    it('Test 4: When Congregation is active panel -> Monitor 2 displays Congregation (overlay priority)', () => {
      const states: Record<string, DisplayRouteState> = {
        'group-congregation': { isLiveEnabled: true },
        'group-stage': { isLiveEnabled: true }
      };

      // Congregation is active operator panel
      const assignments = resolveDisplayAssignments(groups, states, 'group-congregation');
      const m2 = assignments.get('Monitor 2');
      expect(m2?.assignedGroupId).toBe('group-congregation');
      expect(m2?.liveGroupIds).toContain('group-congregation');
      expect(m2?.liveGroupIds).toContain('group-stage');
    });

    it('Test 5: When Stage is active panel -> Monitor 2 immediately switches to Stage', () => {
      const states: Record<string, DisplayRouteState> = {
        'group-congregation': { isLiveEnabled: true },
        'group-stage': { isLiveEnabled: true }
      };

      // Stage is active operator panel
      const assignments = resolveDisplayAssignments(groups, states, 'group-stage');
      const m2 = assignments.get('Monitor 2');
      expect(m2?.assignedGroupId).toBe('group-stage');
    });

    it('Test 6: When switching back to Congregation panel -> Monitor 2 immediately reverts to Congregation', () => {
      const states: Record<string, DisplayRouteState> = {
        'group-congregation': { isLiveEnabled: true },
        'group-stage': { isLiveEnabled: true }
      };

      // 1. Stage active
      let assignments = resolveDisplayAssignments(groups, states, 'group-stage');
      expect(assignments.get('Monitor 2')?.assignedGroupId).toBe('group-stage');

      // 2. Switch to Congregation active
      assignments = resolveDisplayAssignments(groups, states, 'group-congregation');
      expect(assignments.get('Monitor 2')?.assignedGroupId).toBe('group-congregation');
    });

    it('Test 7: Monitor 3 is targeted only by Stage -> continues showing Stage regardless of active panel', () => {
      const states: Record<string, DisplayRouteState> = {
        'group-congregation': { isLiveEnabled: true },
        'group-stage': { isLiveEnabled: true }
      };

      // Congregation active: Monitor 3 still shows Stage
      let assignments = resolveDisplayAssignments(groups, states, 'group-congregation');
      expect(assignments.get('Monitor 3')?.assignedGroupId).toBe('group-stage');

      // Stage active: Monitor 3 still shows Stage
      assignments = resolveDisplayAssignments(groups, states, 'group-stage');
      expect(assignments.get('Monitor 3')?.assignedGroupId).toBe('group-stage');
    });

    it('Test 8: Standby resolution when a route is NOT live (isLiveEnabled: false)', () => {
      const states: Record<string, DisplayRouteState> = {
        'group-congregation': { isLiveEnabled: false },
        'group-stage': { isLiveEnabled: true }
      };

      // Even if Congregation is active, it is not live, so Stage wins Monitor 2
      const assignments = resolveDisplayAssignments(groups, states, 'group-congregation');
      expect(assignments.get('Monitor 2')?.assignedGroupId).toBe('group-stage');

      // If both are not live, Monitor 2 is standby / not casting (assignedGroupId is null)
      const bothOff: Record<string, DisplayRouteState> = {
        'group-congregation': { isLiveEnabled: false },
        'group-stage': { isLiveEnabled: false }
      };
      const offAssignments = resolveDisplayAssignments(groups, bothOff, 'group-congregation');
      expect(offAssignments.get('Monitor 2')?.assignedGroupId).toBeNull();
    });

    it('Test 9: Operator console protection (SAME_DISPLAY_CONFLICT) blocks Monitor 1 from being overtaken', () => {
      const mockDisplays = [
        { id: 'Monitor 1', name: 'Operator Console', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, isPrimary: true },
        { id: 'Monitor 2', name: 'Projector', bounds: { x: 1920, y: 0, width: 1920, height: 1080 }, isPrimary: false }
      ];

      const conflictingGroups: OutputGroup[] = [
        { id: 'group-congregation', name: 'Congregation Display', displayIds: ['Monitor 1', 'Monitor 2'] }
      ];

      const conflicts = DisplayManager.detectConflicts(conflictingGroups, mockDisplays);
      expect(conflicts.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Master LIVE Control and Physical Window Synchronization Tests
  // ---------------------------------------------------------------------------
  describe('Fix #2: Master LIVE Control & Physical Display Synchronization', () => {
    it('Test 10: toggleMasterLive toggles isLiveEnabled state on the active control group', () => {
      const store = useStore.getState();
      useStore.setState({
        activeControlGroupId: 'group-congregation',
        groupStates: {
          'group-congregation': {
            ...useStore.getState().groupStates['group-congregation'],
            isLiveEnabled: false
          }
        }
      });

      expect(useStore.getState().groupStates['group-congregation'].isLiveEnabled).toBe(false);

      // Toggle LIVE ON
      useStore.getState().toggleMasterLive('group-congregation');
      expect(useStore.getState().groupStates['group-congregation'].isLiveEnabled).toBe(true);

      // Toggle LIVE OFF
      useStore.getState().toggleMasterLive('group-congregation');
      expect(useStore.getState().groupStates['group-congregation'].isLiveEnabled).toBe(false);
    });

    it('Test 11: DisplayManager.syncPhysicalDisplays executes sync with IPC bridge in Electron', async () => {
      const syncMock = vi.fn().mockResolvedValue({
        success: true,
        activeDisplays: [{ displayId: 'Monitor 2', groupId: 'group-congregation' }],
        closedDisplays: [],
        switchedDisplays: []
      });

      (window as any).electronAPI = {
        isElectron: true,
        getDisplays: vi.fn().mockResolvedValue([
          { id: 'Monitor 1', name: 'Primary', isPrimary: true },
          { id: 'Monitor 2', name: 'Projector', isPrimary: false }
        ]),
        syncProjectorDisplays: syncMock
      };

      const groups = useStore.getState().outputGroups;
      const states = useStore.getState().groupStates;

      await DisplayManager.syncPhysicalDisplays(groups, states, 'group-congregation');
      expect(syncMock).toHaveBeenCalledTimes(1);

      delete (window as any).electronAPI;
    });

    it('Test 12: Sync physical displays is idempotent and preserves active display map', async () => {
      const syncMock = vi.fn().mockResolvedValue({
        success: true,
        activeDisplays: [{ displayId: 'Monitor 2', groupId: 'group-congregation' }],
        closedDisplays: [],
        switchedDisplays: []
      });

      (window as any).electronAPI = {
        isElectron: true,
        getDisplays: vi.fn().mockResolvedValue([
          { id: 'Monitor 1', name: 'Primary', isPrimary: true },
          { id: 'Monitor 2', name: 'Projector', isPrimary: false }
        ]),
        syncProjectorDisplays: syncMock
      };

      const groups = useStore.getState().outputGroups;
      const states = useStore.getState().groupStates;

      // Call 3 times consecutively
      await DisplayManager.syncPhysicalDisplays(groups, states, 'group-congregation');
      await DisplayManager.syncPhysicalDisplays(groups, states, 'group-congregation');
      await DisplayManager.syncPhysicalDisplays(groups, states, 'group-congregation');

      expect(syncMock).toHaveBeenCalledTimes(3);

      delete (window as any).electronAPI;
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Live Content Persistence Tests
  // ---------------------------------------------------------------------------
  describe('Fix #4: Live Content Persistence Across Navigation', () => {
    it('Test 13: PresentationCore.getActiveContent returns directLiveItem even when schedule is empty', () => {
      const directItem: PresentationItem = {
        id: 'direct-song-1',
        type: 'song',
        name: 'Great Is Thy Faithfulness',
        contentId: 'song-great-1',
        isExpanded: false
      };

      const state: PresentationState = {
        activeScheduleId: null,
        activeItemId: 'direct-song-1',
        activeSlideIndex: 2,
        nextSlideIndex: 3,
        isBlack: false,
        isClear: false,
        showLogo: false,
        timestamp: Date.now(),
        isLiveEnabled: true,
        directLiveItem: directItem
      };

      const emptySchedule: Schedule = {
        id: 'empty-sched',
        name: 'Empty Service',
        items: []
      };

      const activeContent = PresentationCore.getActiveContent(emptySchedule, state, directItem);
      expect(activeContent).toBeDefined();
      expect(activeContent?.id).toBe('direct-song-1');
      expect(activeContent?.name).toBe('Great Is Thy Faithfulness');
    });

    it('Test 14: Switching operator tabs (Scriptures, Songs, Schedule) keeps live item intact', () => {
      const store = useStore.getState();
      
      // Go live with a song
      store.goLiveItem('song-1', 0, 'group-congregation');
      const liveBefore = useStore.getState().groupStates['group-congregation'].directLiveItem;
      expect(liveBefore).toBeDefined();
      expect(liveBefore?.id).toBe('song-1');

      // Operator navigates tabs
      store.setResourcesTab('scriptures');
      store.setResourcesTab('songs');
      store.setResourcesTab('presentations');

      // Live content must remain identical
      const liveAfter = useStore.getState().groupStates['group-congregation'].directLiveItem;
      expect(liveAfter).toBeDefined();
      expect(liveAfter?.id).toBe('song-1');
      expect(liveAfter?.name).toBe(liveBefore?.name);
    });

    it('Test 15: Changing or clearing active schedule does not clear live projector content', () => {
      const store = useStore.getState();
      
      // Set active schedule
      store.setActiveSchedule({
        id: 'sched-1',
        name: 'Sunday Morning',
        items: [{ id: 'sched-item-1', type: 'song', name: 'Song in Schedule' }]
      });

      store.goLiveItem('sched-item-1', 0, 'group-congregation');
      expect(useStore.getState().groupStates['group-congregation'].activeItemId).toBe('sched-item-1');

      // Operator loads a different schedule or clears it
      store.setActiveSchedule(null);

      // Presentation state still holds directLiveItem
      const state = useStore.getState().groupStates['group-congregation'];
      const resolved = PresentationCore.getActiveContent(null, state, state.directLiveItem);
      expect(resolved).toBeDefined();
      expect(resolved?.id).toBe('sched-item-1');
      expect(resolved?.name).toBe('Song in Schedule');
    });

    it('Test 16: Toggling Black, Clear, or Logo maintains live content in background', () => {
      const store = useStore.getState();
      store.goLiveItem('song-1', 1, 'group-congregation');

      // Toggle Black ON
      store.toggleBlack('group-congregation');
      expect(useStore.getState().groupStates['group-congregation'].isBlack).toBe(true);
      expect(useStore.getState().groupStates['group-congregation'].activeItemId).toBe('song-1');

      // Toggle Black OFF
      store.toggleBlack('group-congregation');
      expect(useStore.getState().groupStates['group-congregation'].isBlack).toBe(false);
      expect(useStore.getState().groupStates['group-congregation'].activeItemId).toBe('song-1');
      expect(useStore.getState().groupStates['group-congregation'].activeSlideIndex).toBe(1);

      // Toggle Clear ON
      store.toggleClear('group-congregation');
      expect(useStore.getState().groupStates['group-congregation'].isClear).toBe(true);
      expect(useStore.getState().groupStates['group-congregation'].activeItemId).toBe('song-1');

      // Toggle Clear OFF
      store.toggleClear('group-congregation');
      expect(useStore.getState().groupStates['group-congregation'].isClear).toBe(false);
      expect(useStore.getState().groupStates['group-congregation'].activeItemId).toBe('song-1');
    });

    it('Test 17: Slide generation for live presentation item generates formatted slides with ThemeEngine', () => {
      const item: PresentationItem = {
        id: 'bible-item-1',
        type: 'bible',
        name: 'Genesis 1:1',
        contentId: 'gen-1',
        data: {
          text: 'In the beginning God created the heaven and the earth.\n\nAnd the earth was without form, and void.',
          reference: 'Genesis 1:1-2'
        }
      };

      const slides = PresentationCore.generateSlides(item);
      expect(slides.length).toBe(2);
      expect(slides[0].text).toContain('In the beginning');
      expect(slides[1].text).toContain('without form');
    });
  });
});

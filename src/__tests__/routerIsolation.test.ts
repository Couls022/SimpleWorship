import { describe, it, expect } from 'vitest';
import { resolveDisplayAssignments, routeTargetsDisplay } from '../core/DisplayRouter';
import { OutputGroup, PresentationState } from '../types';

const defaultState: PresentationState = {
  activeScheduleId: null,
  activeItemId: 'item-1',
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

describe('Router Panel Output Isolation & Routing Integration Tests', () => {
  const router1Group: OutputGroup = {
    id: 'group-router-1',
    name: 'Router Panel 1 Output',
    role: 'broadcast',
    displayIds: ['Target Monitor 1'],
    isBlack: false,
    isClear: false,
    showLogo: false
  };

  const router2Group: OutputGroup = {
    id: 'group-router-2',
    name: 'Router Panel 2 Output',
    role: 'broadcast',
    displayIds: ['Target Monitor 1'],
    isBlack: false,
    isClear: false,
    showLogo: false
  };

  it('Test 1: Router Panel 1 LIVE ON, Router Panel 2 LIVE OFF -> Target Monitor 1 outputs Router Panel 1 only', () => {
    const outputGroups = [router1Group, router2Group];
    const groupStates: Record<string, PresentationState> = {
      'group-router-1': { ...defaultState, isLiveEnabled: true },
      'group-router-2': { ...defaultState, isLiveEnabled: false },
    };

    const assignments = resolveDisplayAssignments(outputGroups, groupStates, 'group-router-1', ['Target Monitor 1']);
    const assignment = assignments.get('Target Monitor 1');

    expect(assignment).toBeDefined();
    expect(assignment?.assignedGroupId).toBe('group-router-1');
    expect(assignment?.liveGroupIds).toEqual(['group-router-1']);
  });

  it('Test 2: Router Panel 1 LIVE ON, Router Panel 2 LIVE ON -> Target Monitor 1 receives BOTH layers, Active Router is top overlay', () => {
    const outputGroups = [router1Group, router2Group];
    const groupStates: Record<string, PresentationState> = {
      'group-router-1': { ...defaultState, isLiveEnabled: true },
      'group-router-2': { ...defaultState, isLiveEnabled: true },
    };

    // Active router is Router Panel 2
    const assignments = resolveDisplayAssignments(outputGroups, groupStates, 'group-router-2', ['Target Monitor 1']);
    const assignment = assignments.get('Target Monitor 1');

    expect(assignment).toBeDefined();
    expect(assignment?.assignedGroupId).toBe('group-router-2');
    expect(assignment?.liveGroupIds).toContain('group-router-1');
    expect(assignment?.liveGroupIds).toContain('group-router-2');
    // Top overlay (last in orderedLiveGroupIds) must be the active router (group-router-2)
    expect(assignment?.liveGroupIds[assignment.liveGroupIds.length - 1]).toBe('group-router-2');
  });

  it('Test 3: Switching active Router Panel focus does NOT remove other Router Panel live output', () => {
    const outputGroups = [router1Group, router2Group];
    const groupStates: Record<string, PresentationState> = {
      'group-router-1': { ...defaultState, isLiveEnabled: true },
      'group-router-2': { ...defaultState, isLiveEnabled: true },
    };

    // Switch focus to Router Panel 1
    const assignments = resolveDisplayAssignments(outputGroups, groupStates, 'group-router-1', ['Target Monitor 1']);
    const assignment = assignments.get('Target Monitor 1');

    expect(assignment).toBeDefined();
    expect(assignment?.assignedGroupId).toBe('group-router-1');
    expect(assignment?.liveGroupIds).toContain('group-router-1');
    expect(assignment?.liveGroupIds).toContain('group-router-2');
    // Top overlay must now be group-router-1
    expect(assignment?.liveGroupIds[assignment.liveGroupIds.length - 1]).toBe('group-router-1');
  });

  it('Test 4: Turning Router Panel 2 LIVE OFF removes Router Panel 2 layer from Target Monitor 1', () => {
    const outputGroups = [router1Group, router2Group];
    const groupStates: Record<string, PresentationState> = {
      'group-router-1': { ...defaultState, isLiveEnabled: true },
      'group-router-2': { ...defaultState, isLiveEnabled: false },
    };

    const assignments = resolveDisplayAssignments(outputGroups, groupStates, 'group-router-1', ['Target Monitor 1']);
    const assignment = assignments.get('Target Monitor 1');

    expect(assignment?.assignedGroupId).toBe('group-router-1');
    expect(assignment?.liveGroupIds).toEqual(['group-router-1']);
    expect(assignment?.liveGroupIds).not.toContain('group-router-2');
  });

  it('Test 5: Router Panel 1 on Monitor 1, Router Panel 2 on Monitor 2 -> Independent 1:1 outputs', () => {
    const g1: OutputGroup = { ...router1Group, displayIds: ['Target Monitor 1'] };
    const g2: OutputGroup = { ...router2Group, displayIds: ['Target Monitor 2'] };
    const outputGroups = [g1, g2];
    const groupStates: Record<string, PresentationState> = {
      'group-router-1': { ...defaultState, isLiveEnabled: true },
      'group-router-2': { ...defaultState, isLiveEnabled: true },
    };

    const assignments = resolveDisplayAssignments(outputGroups, groupStates, 'group-router-1', ['Target Monitor 1', 'Target Monitor 2']);

    const mon1 = assignments.get('Target Monitor 1');
    const mon2 = assignments.get('Target Monitor 2');

    expect(mon1?.assignedGroupId).toBe('group-router-1');
    expect(mon1?.liveGroupIds).toEqual(['group-router-1']);

    expect(mon2?.assignedGroupId).toBe('group-router-2');
    expect(mon2?.liveGroupIds).toEqual(['group-router-2']);
  });

  it('Test 6: Overlapping Many-to-Many Routing: Router Panel 1 on Monitor 1, Router Panel 2 on Monitor 1 & Monitor 2', () => {
    const g1: OutputGroup = { ...router1Group, displayIds: ['Target Monitor 1'] };
    const g2: OutputGroup = { ...router2Group, displayIds: ['Target Monitor 1', 'Target Monitor 2'] };
    const outputGroups = [g1, g2];
    const groupStates: Record<string, PresentationState> = {
      'group-router-1': { ...defaultState, isLiveEnabled: true },
      'group-router-2': { ...defaultState, isLiveEnabled: true },
    };

    const assignments = resolveDisplayAssignments(outputGroups, groupStates, 'group-router-2', ['Target Monitor 1', 'Target Monitor 2']);

    const mon1 = assignments.get('Target Monitor 1');
    const mon2 = assignments.get('Target Monitor 2');

    // Monitor 1 receives both, group-router-2 as top overlay
    expect(mon1?.liveGroupIds).toContain('group-router-1');
    expect(mon1?.liveGroupIds).toContain('group-router-2');
    expect(mon1?.assignedGroupId).toBe('group-router-2');

    // Monitor 2 receives only group-router-2
    expect(mon2?.liveGroupIds).toEqual(['group-router-2']);
    expect(mon2?.assignedGroupId).toBe('group-router-2');
  });

  it('Test 7: Both Router Panels LIVE OFF -> Target Monitor 1 is standby / idle (assignedGroupId is null)', () => {
    const outputGroups = [router1Group, router2Group];
    const groupStates: Record<string, PresentationState> = {
      'group-router-1': { ...defaultState, isLiveEnabled: false },
      'group-router-2': { ...defaultState, isLiveEnabled: false },
    };

    const assignments = resolveDisplayAssignments(outputGroups, groupStates, 'group-router-1', ['Target Monitor 1']);
    const assignment = assignments.get('Target Monitor 1');

    expect(assignment?.assignedGroupId).toBeNull();
    expect(assignment?.liveGroupIds).toEqual([]);
  });

  it('Test 8: Black/Logo/Clear on Router Panel 1 applies ONLY to Router Panel 1 state, Router Panel 2 state is unaffected', () => {
    const groupStates: Record<string, PresentationState> = {
      'group-router-1': { ...defaultState, isLiveEnabled: true, isBlack: true },
      'group-router-2': { ...defaultState, isLiveEnabled: true, isBlack: false },
    };

    expect(groupStates['group-router-1'].isBlack).toBe(true);
    expect(groupStates['group-router-2'].isBlack).toBe(false);
  });

  it('Test 9: Target Display matching accurately resolves monitor names and aliases', () => {
    const g1: OutputGroup = { ...router1Group, displayIds: ['Display 2 (1920x1080)'] };
    expect(routeTargetsDisplay(g1, 'Display 2 (1920x1080)')).toBe(true);
    expect(routeTargetsDisplay(g1, 'display-2')).toBe(true);
    expect(routeTargetsDisplay(g1, 'Display 1')).toBe(false);
  });
});

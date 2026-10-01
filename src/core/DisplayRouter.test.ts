import { describe, it, expect } from 'vitest';
import { isSamePhysicalDisplay, routeTargetsDisplay, resolveDisplayAssignments } from './DisplayRouter';
import { OutputGroup } from '../types';

describe('DisplayRouter & Route Panel Stability Isolation Tests', () => {
  const mockScreens = [
    { id: 'disp-primary', displayId: 'disp-primary', label: 'Auditorium Projector 1920x1080 (Primary)', isPrimary: true, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    { id: 'disp-secondary', displayId: 'disp-secondary', label: 'Balcony Overflow 1920x1080', isPrimary: false, bounds: { x: 1920, y: 0, width: 1920, height: 1080 } },
    { id: 'disp-stage', displayId: 'disp-stage', label: 'Stage Confidence Monitor 1920x1080', isPrimary: false, bounds: { x: 3840, y: 0, width: 1920, height: 1080 } }
  ];

  it('1. Physical display matching is exact and never causes bleed across distinct monitors', () => {
    expect(isSamePhysicalDisplay('disp-primary', 'disp-primary', mockScreens)).toBe(true);
    expect(isSamePhysicalDisplay('disp-primary', 'disp-secondary', mockScreens)).toBe(false);
    expect(isSamePhysicalDisplay('disp-secondary', 'disp-stage', mockScreens)).toBe(false);
  });

  it('2. Unconfigured primary Route 1 targets presentation screens by default and never stage displays; unconfigured auxiliary routes do not target until locked', () => {
    const route1Group: OutputGroup = {
      id: 'group-congregation',
      name: 'Route 1',
      role: 'broadcast',
      displayIds: [],
      targetDisplayId: '',
      isBlack: false,
      isClear: false,
      showLogo: true
    };

    const route2Group: OutputGroup = {
      id: 'group-r2',
      name: 'Route 2',
      role: 'broadcast',
      displayIds: [],
      targetDisplayId: '',
      isBlack: false,
      isClear: false,
      showLogo: false
    };

    const route3Group: OutputGroup = {
      id: 'group-r3',
      name: 'Route 3',
      role: 'broadcast',
      displayIds: [],
      targetDisplayId: '',
      isBlack: false,
      isClear: false,
      showLogo: false
    };

    // Unconfigured Route 1 (primary) targets presentation display by default
    expect(routeTargetsDisplay(route1Group, 'disp-primary', mockScreens)).toBe(true);
    // Unconfigured Route 2 and Route 3 do NOT target any display until explicitly locked by operator
    expect(routeTargetsDisplay(route2Group, 'disp-primary', mockScreens)).toBe(false);
    expect(routeTargetsDisplay(route3Group, 'disp-primary', mockScreens)).toBe(false);

    // Primary route NEVER bleeds onto stage/confidence monitors
    expect(routeTargetsDisplay(route1Group, 'disp-stage', mockScreens)).toBe(false);
    expect(routeTargetsDisplay(route2Group, 'disp-stage', mockScreens)).toBe(false);
    expect(routeTargetsDisplay(route3Group, 'disp-stage', mockScreens)).toBe(false);
  });

  it('3. Explicitly configured route strictly targets ONLY its assigned monitors', () => {
    const route2Explicit: OutputGroup = {
      id: 'group-r2',
      name: 'Route 2',
      role: 'broadcast',
      displayIds: ['disp-secondary'],
      targetDisplayId: 'disp-secondary',
      isBlack: false,
      isClear: false,
      showLogo: false
    };

    expect(routeTargetsDisplay(route2Explicit, 'disp-secondary', mockScreens)).toBe(true);
    expect(routeTargetsDisplay(route2Explicit, 'disp-primary', mockScreens)).toBe(false);
    expect(routeTargetsDisplay(route2Explicit, 'disp-stage', mockScreens)).toBe(false);
  });

  it('4. Display assignments cleanly isolate routes per monitor with zero cross-talk', () => {
    const outputGroups: OutputGroup[] = [
      {
        id: 'group-congregation',
        name: 'Route 1',
        role: 'broadcast',
        displayIds: ['disp-primary'],
        targetDisplayId: 'disp-primary',
        isBlack: false,
        isClear: false,
        showLogo: true
      },
      {
        id: 'group-r2',
        name: 'Route 2',
        role: 'broadcast',
        displayIds: ['disp-secondary'],
        targetDisplayId: 'disp-secondary',
        isBlack: false,
        isClear: false,
        showLogo: false
      }
    ];

    const groupStates = {
      'group-congregation': { isLiveEnabled: true, activeItemId: 'song-1' },
      'group-r2': { isLiveEnabled: false, activeItemId: 'scripture-1' }
    };

    const assignments = resolveDisplayAssignments(
      outputGroups,
      groupStates as any,
      'group-congregation',
      ['disp-primary', 'disp-secondary'],
      mockScreens
    );

    const primaryAssign = assignments.get('disp-primary');
    const secondaryAssign = assignments.get('disp-secondary');

    // Primary display has Route 1 winning
    expect(primaryAssign?.assignedGroupId).toBe('group-congregation');
    expect(primaryAssign?.liveGroupIds).toEqual(['group-congregation']);

    // Secondary display has Route 2 in standby (not live), so assignedGroupId is null (black/standby)
    expect(secondaryAssign?.assignedGroupId).toBe(null);
    expect(secondaryAssign?.liveGroupIds).toEqual([]);
    expect(secondaryAssign?.candidateGroupIds).toEqual(['group-r2']);
  });

  it('5. When Route 2 turns Live ON, secondary display cleanly activates Route 2 while Route 1 remains on primary', () => {
    const outputGroups: OutputGroup[] = [
      {
        id: 'group-congregation',
        name: 'Route 1',
        role: 'broadcast',
        displayIds: ['disp-primary'],
        targetDisplayId: 'disp-primary',
        isBlack: false,
        isClear: false,
        showLogo: true
      },
      {
        id: 'group-r2',
        name: 'Route 2',
        role: 'broadcast',
        displayIds: ['disp-secondary'],
        targetDisplayId: 'disp-secondary',
        isBlack: false,
        isClear: false,
        showLogo: false
      }
    ];

    const groupStates = {
      'group-congregation': { isLiveEnabled: true, activeItemId: 'song-1' },
      'group-r2': { isLiveEnabled: true, activeItemId: 'scripture-1' }
    };

    const assignments = resolveDisplayAssignments(
      outputGroups,
      groupStates as any,
      'group-r2',
      ['disp-primary', 'disp-secondary'],
      mockScreens
    );

    const primaryAssign = assignments.get('disp-primary');
    const secondaryAssign = assignments.get('disp-secondary');

    expect(primaryAssign?.assignedGroupId).toBe('group-congregation');
    expect(secondaryAssign?.assignedGroupId).toBe('group-r2');
  });

  it('6. Multi-route overlay on target monitor: When multiple isolated router panels target the same monitor, all are candidates and stacked in MRU order', () => {
    const outputGroups: OutputGroup[] = [
      {
        id: 'group-congregation',
        name: 'Route 1 (Lyrics)',
        role: 'broadcast',
        displayIds: ['disp-secondary'],
        targetDisplayId: 'disp-secondary',
        isBlack: false,
        isClear: false,
        showLogo: true
      },
      {
        id: 'group-r2',
        name: 'Route 2 (Scripture Overlay)',
        role: 'broadcast',
        displayIds: ['disp-secondary'],
        targetDisplayId: 'disp-secondary',
        isBlack: false,
        isClear: false,
        showLogo: false
      },
      {
        id: 'group-r3',
        name: 'Route 3 (Urgent Alert)',
        role: 'broadcast',
        displayIds: ['disp-secondary'],
        targetDisplayId: 'disp-secondary',
        isBlack: false,
        isClear: false,
        showLogo: false
      }
    ];

    const groupStates = {
      'group-congregation': { isLiveEnabled: true, activeItemId: 'song-1' },
      'group-r2': { isLiveEnabled: true, activeItemId: 'scripture-1' },
      'group-r3': { isLiveEnabled: true, activeItemId: 'alert-1' }
    };

    // Route 3 was activated most recently, Route 2 second, Route 1 third
    const activationStack = ['group-r3', 'group-r2', 'group-congregation'];

    const assignments = resolveDisplayAssignments(
      outputGroups,
      groupStates as any,
      'group-r3',
      ['disp-secondary'],
      mockScreens,
      activationStack
    );

    const assign = assignments.get('disp-secondary');
    expect(assign).toBeDefined();
    // All 3 routes target this display and are candidates
    expect(assign?.candidateGroupIds).toEqual(['group-congregation', 'group-r2', 'group-r3']);
    // All 3 routes are LIVE
    expect(assign?.liveGroupIds).toEqual(['group-congregation', 'group-r2', 'group-r3']);
    // Stacked layers strictly in MRU order: Route 3 on top (index 0), then Route 2, then Route 1
    expect(assign?.stackedGroupIds).toEqual(['group-r3', 'group-r2', 'group-congregation']);
    // Route 3 (most active) is assigned as winning route on top
    expect(assign?.assignedGroupId).toBe('group-r3');
  });

  it('7. Dynamic re-stacking: When operator switches focus to Route 2, Route 2 dynamically becomes topmost overlay', () => {
    const outputGroups: OutputGroup[] = [
      {
        id: 'group-congregation',
        name: 'Route 1',
        role: 'broadcast',
        displayIds: ['disp-secondary'],
        targetDisplayId: 'disp-secondary',
        isBlack: false,
        isClear: false,
        showLogo: true
      },
      {
        id: 'group-r2',
        name: 'Route 2',
        role: 'broadcast',
        displayIds: ['disp-secondary'],
        targetDisplayId: 'disp-secondary',
        isBlack: false,
        isClear: false,
        showLogo: false
      }
    ];

    const groupStates = {
      'group-congregation': { isLiveEnabled: true, activeItemId: 'song-1' },
      'group-r2': { isLiveEnabled: true, activeItemId: 'scripture-1' }
    };

    // Operator focused Route 2: stack places Route 2 at index 0
    const activationStackAfterFocus = ['group-r2', 'group-congregation'];

    const assignments = resolveDisplayAssignments(
      outputGroups,
      groupStates as any,
      'group-r2',
      ['disp-secondary'],
      mockScreens,
      activationStackAfterFocus
    );

    const assign = assignments.get('disp-secondary');
    expect(assign?.assignedGroupId).toBe('group-r2');
    expect(assign?.stackedGroupIds).toEqual(['group-r2', 'group-congregation']);
  });

  it('8. User Scenario: Route 1 locked to Monitor 1 & 2, Route 2 locked ONLY to Monitor 1', () => {
    const outputGroups: OutputGroup[] = [
      {
        id: 'group-congregation',
        name: 'Route 1',
        role: 'broadcast',
        displayIds: ['disp-primary', 'disp-secondary'],
        targetDisplayId: 'disp-primary',
        isBlack: false,
        isClear: false,
        showLogo: false
      },
      {
        id: 'group-r2',
        name: 'Route 2',
        role: 'broadcast',
        displayIds: ['disp-primary'],
        targetDisplayId: 'disp-primary',
        isBlack: false,
        isClear: false,
        showLogo: false
      }
    ];

    const groupStates = {
      'group-congregation': { isLiveEnabled: true, activeItemId: 'song-1' },
      'group-r2': { isLiveEnabled: true, activeItemId: 'scripture-1' }
    };

    // Phase 1: Route 1 is active
    let assignments = resolveDisplayAssignments(
      outputGroups,
      groupStates as any,
      'group-congregation',
      ['disp-primary', 'disp-secondary'],
      mockScreens,
      ['group-congregation', 'group-r2']
    );

    // Monitor 1 shows Route 1
    expect(assignments.get('disp-primary')?.assignedGroupId).toBe('group-congregation');
    expect(assignments.get('disp-primary')?.candidateGroupIds).toEqual(['group-congregation', 'group-r2']);

    // Monitor 2 shows Route 1
    expect(assignments.get('disp-secondary')?.assignedGroupId).toBe('group-congregation');
    expect(assignments.get('disp-secondary')?.candidateGroupIds).toEqual(['group-congregation']);

    // Phase 2: Operator switches to Route 2 (Route 2 is active)
    assignments = resolveDisplayAssignments(
      outputGroups,
      groupStates as any,
      'group-r2',
      ['disp-primary', 'disp-secondary'],
      mockScreens,
      ['group-r2', 'group-congregation']
    );

    // Monitor 1 changes to Route 2 (on top overlay)
    expect(assignments.get('disp-primary')?.assignedGroupId).toBe('group-r2');
    expect(assignments.get('disp-primary')?.candidateGroupIds).toEqual(['group-congregation', 'group-r2']);
    expect(assignments.get('disp-primary')?.stackedGroupIds).toEqual(['group-r2', 'group-congregation']);

    // Monitor 2 STAYS on Route 1 (Route 2 is NOT targeted to Monitor 2)
    expect(assignments.get('disp-secondary')?.assignedGroupId).toBe('group-congregation');
    expect(assignments.get('disp-secondary')?.candidateGroupIds).toEqual(['group-congregation']);
    expect(assignments.get('disp-secondary')?.stackedGroupIds).toEqual(['group-congregation']);

    // Phase 3: Operator switches back to Route 1
    assignments = resolveDisplayAssignments(
      outputGroups,
      groupStates as any,
      'group-congregation',
      ['disp-primary', 'disp-secondary'],
      mockScreens,
      ['group-congregation', 'group-r2']
    );

    // Monitor 1 switches back to Route 1
    expect(assignments.get('disp-primary')?.assignedGroupId).toBe('group-congregation');
    // Monitor 2 continues showing Route 1
    expect(assignments.get('disp-secondary')?.assignedGroupId).toBe('group-congregation');
  });

  it('9. Dynamically created Add Route (Route 3) is completely isolated with its own target locks and overlays', () => {
    const mock3Screens = [
      ...mockScreens,
      { id: 'disp-foldback', label: 'Monitor 3', width: 1920, height: 1080 }
    ];

    const outputGroups: OutputGroup[] = [
      {
        id: 'group-congregation',
        name: 'Route 1',
        role: 'broadcast',
        displayIds: ['disp-primary', 'disp-secondary'],
        targetDisplayId: 'disp-primary',
        isBlack: false,
        isClear: false,
        showLogo: false
      },
      {
        id: 'group-r2',
        name: 'Route 2',
        role: 'broadcast',
        displayIds: ['disp-primary'],
        targetDisplayId: 'disp-primary',
        isBlack: false,
        isClear: false,
        showLogo: false
      },
      {
        id: 'group-r3',
        name: 'Route 3',
        role: 'broadcast',
        displayIds: ['disp-secondary', 'disp-foldback'],
        targetDisplayId: 'disp-secondary',
        isBlack: false,
        isClear: false,
        showLogo: false
      }
    ];

    const groupStates = {
      'group-congregation': { isLiveEnabled: true, activeItemId: 'song-1' },
      'group-r2': { isLiveEnabled: true, activeItemId: 'scripture-1' },
      'group-r3': { isLiveEnabled: true, activeItemId: 'announcement-1' }
    };

    // When Route 3 (Add Route) is active
    const assignments = resolveDisplayAssignments(
      outputGroups,
      groupStates as any,
      'group-r3',
      ['disp-primary', 'disp-secondary', 'disp-foldback'],
      mock3Screens,
      ['group-r3', 'group-r2', 'group-congregation']
    );

    // Monitor 1 (targeted by Route 1 & 2 only): Shows Route 2 (highest in stack among candidates for Monitor 1)
    expect(assignments.get('disp-primary')?.assignedGroupId).toBe('group-r2');
    expect(assignments.get('disp-primary')?.candidateGroupIds).toEqual(['group-congregation', 'group-r2']);

    // Monitor 2 (targeted by Route 1 & 3): Overlays Route 3 (active route) on top of Route 1
    expect(assignments.get('disp-secondary')?.assignedGroupId).toBe('group-r3');
    expect(assignments.get('disp-secondary')?.candidateGroupIds).toEqual(['group-congregation', 'group-r3']);
    expect(assignments.get('disp-secondary')?.stackedGroupIds).toEqual(['group-r3', 'group-congregation']);

    // Monitor 3 (targeted by Route 3 only): Shows Route 3
    expect(assignments.get('disp-foldback')?.assignedGroupId).toBe('group-r3');
    expect(assignments.get('disp-foldback')?.candidateGroupIds).toEqual(['group-r3']);
  });

  it('10. Exact Diagram from Image: Route 1 on Mon 1, 2, 3; Route 2 on Mon 4 (or Mon 1 & 4)', () => {
    const mock4Screens = [
      { id: 'mon-1', label: 'Monitor 1', width: 1920, height: 1080 },
      { id: 'mon-2', label: 'Monitor 2', width: 1920, height: 1080 },
      { id: 'mon-3', label: 'Monitor 3', width: 1920, height: 1080 },
      { id: 'mon-4', label: 'Monitor 4', width: 1920, height: 1080 },
    ];

    const outputGroups: OutputGroup[] = [
      {
        id: 'group-congregation',
        name: 'Route 1',
        role: 'broadcast',
        displayIds: ['mon-1', 'mon-2', 'mon-3'],
        targetDisplayId: 'mon-1',
        isBlack: false,
        isClear: false,
        showLogo: false
      },
      {
        id: 'group-r2',
        name: 'Route 2',
        role: 'broadcast',
        displayIds: ['mon-4'],
        targetDisplayId: 'mon-4',
        isBlack: false,
        isClear: false,
        showLogo: false
      }
    ];

    const groupStates = {
      'group-congregation': { isLiveEnabled: true, activeItemId: 'song-1' },
      'group-r2': { isLiveEnabled: true, activeItemId: 'scripture-1' }
    };

    // Both are Live. Route 1 is Active.
    let assignments = resolveDisplayAssignments(
      outputGroups,
      groupStates as any,
      'group-congregation',
      ['mon-1', 'mon-2', 'mon-3', 'mon-4'],
      mock4Screens,
      ['group-congregation', 'group-r2']
    );

    // Mon 1, 2, 3 show Route 1
    expect(assignments.get('mon-1')?.assignedGroupId).toBe('group-congregation');
    expect(assignments.get('mon-2')?.assignedGroupId).toBe('group-congregation');
    expect(assignments.get('mon-3')?.assignedGroupId).toBe('group-congregation');
    // Mon 4 shows Route 2 ONLY
    expect(assignments.get('mon-4')?.assignedGroupId).toBe('group-r2');
    expect(assignments.get('mon-4')?.candidateGroupIds).toEqual(['group-r2']);

    // Operator switches to Route 2 (Route 2 is active)
    assignments = resolveDisplayAssignments(
      outputGroups,
      groupStates as any,
      'group-r2',
      ['mon-1', 'mon-2', 'mon-3', 'mon-4'],
      mock4Screens,
      ['group-r2', 'group-congregation']
    );

    // Mon 1, 2, 3 STILL show Route 1 without change (Route 2 is NOT on Mon 1, 2, 3)
    expect(assignments.get('mon-1')?.assignedGroupId).toBe('group-congregation');
    expect(assignments.get('mon-2')?.assignedGroupId).toBe('group-congregation');
    expect(assignments.get('mon-3')?.assignedGroupId).toBe('group-congregation');
    // Mon 4 shows Route 2
    expect(assignments.get('mon-4')?.assignedGroupId).toBe('group-r2');

    // Scenario with Shared Target: Route 2 is ALSO targeted to Mon 1 (Mon 1 & Mon 4)
    const sharedGroups: OutputGroup[] = [
      outputGroups[0],
      {
        ...outputGroups[1],
        displayIds: ['mon-1', 'mon-4']
      }
    ];

    // When Route 2 is active with shared Mon 1 target:
    const sharedAssignments = resolveDisplayAssignments(
      sharedGroups,
      groupStates as any,
      'group-r2',
      ['mon-1', 'mon-2', 'mon-3', 'mon-4'],
      mock4Screens,
      ['group-r2', 'group-congregation']
    );

    // Mon 1: Overlays Route 2 (active route) on top of Route 1
    expect(sharedAssignments.get('mon-1')?.assignedGroupId).toBe('group-r2');
    expect(sharedAssignments.get('mon-1')?.stackedGroupIds).toEqual(['group-r2', 'group-congregation']);

    // Mon 2 & Mon 3: Still show Route 1
    expect(sharedAssignments.get('mon-2')?.assignedGroupId).toBe('group-congregation');
    expect(sharedAssignments.get('mon-3')?.assignedGroupId).toBe('group-congregation');

    // Mon 4: Shows Route 2
    expect(sharedAssignments.get('mon-4')?.assignedGroupId).toBe('group-r2');
  });
});

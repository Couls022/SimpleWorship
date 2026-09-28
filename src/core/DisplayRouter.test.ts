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

  it('2. Unconfigured secondary routes (Route 2, Route 3...) NEVER target presentation screens by default', () => {
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

    // Route 1 (primary) defaults to true on standard presentation displays when unconfigured
    expect(routeTargetsDisplay(route1Group, 'disp-primary', mockScreens)).toBe(true);

    // Route 2 and Route 3 MUST be false (strictly isolated) so they do NOT bleed onto main auditorium display
    expect(routeTargetsDisplay(route2Group, 'disp-primary', mockScreens)).toBe(false);
    expect(routeTargetsDisplay(route3Group, 'disp-primary', mockScreens)).toBe(false);
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
});

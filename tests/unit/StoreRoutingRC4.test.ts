import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/store/useStore';

describe('Many-to-Many Routing Architecture (RC4)', () => {
  beforeEach(() => {
    // Reset store state with multi-router initial state
    useStore.setState({
      groupStates: {
        'group-1': { activeItemId: 'song-1', activeSlideIndex: 0, isLiveEnabled: false, isBlack: false, isClear: false, showLogo: false, timestamp: 0 },
        'group-2': { activeItemId: 'song-2', activeSlideIndex: 0, isLiveEnabled: false, isBlack: false, isClear: false, showLogo: false, timestamp: 0 },
      },
      outputGroups: [
        { id: 'group-1', name: 'Monitor 1', displayIds: [] },
        { id: 'group-2', name: 'Monitor 2', displayIds: [] }
      ],
      routerPanels: [
        { routerId: 'router-1', targetOutputGroupId: 'group-1', active: true, visible: true, focused: true },
        { routerId: 'router-2', targetOutputGroupId: 'group-2', active: false, visible: true, focused: false }
      ],
      activeRouterId: 'router-1',
      activeControlGroupId: 'group-1',
    });
  });

  it('allows multiple routers to target the same output group', () => {
    const store = useStore.getState();
    store.updateRouterPanel('router-2', { targetOutputGroupId: 'group-1' });

    const state = useStore.getState();
    expect(state.routerPanels[0].targetOutputGroupId).toBe('group-1');
    expect(state.routerPanels[1].targetOutputGroupId).toBe('group-1');
  });

  it('updates activeControlGroupId when active router changes target', () => {
    const store = useStore.getState();
    store.updateRouterPanel('router-1', { targetOutputGroupId: 'group-2' });

    const state = useStore.getState();
    expect(state.activeControlGroupId).toBe('group-2');
  });

  it('updates activeControlGroupId when switching active router', () => {
    const store = useStore.getState();
    store.setActiveRouterId('router-2');

    const state = useStore.getState();
    expect(state.activeRouterId).toBe('router-2');
    expect(state.activeControlGroupId).toBe('group-2');
    expect(state.routerPanels.find(p => p.routerId === 'router-2')?.active).toBe(true);
    expect(state.routerPanels.find(p => p.routerId === 'router-1')?.active).toBe(false);
  });
  
  it('handles removing the active router', () => {
    const store = useStore.getState();
    store.removeRouterPanel('router-1');
    
    const state = useStore.getState();
    // It should fallback to another available router
    expect(state.activeRouterId).toBe('router-2');
    expect(state.activeControlGroupId).toBe('group-2');
  });
});

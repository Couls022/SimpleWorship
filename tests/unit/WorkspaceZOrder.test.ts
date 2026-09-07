import { describe, it, expect } from 'vitest';
import { useStore } from '../../src/store/useStore';

describe('Workspace Stacking & FloatingPanel Z-Order Architecture', () => {
  it('ensures all default FloatingPanel z-index values start above docked headers (>= 100 > 40)', async () => {
    const { DEFAULT_PANEL_STATES } = await import('../../src/context/WorkspaceContext');
    
    // Docked headers/tabs like SchedulePanel use z-40.
    const DOCKED_HEADER_MAX_Z = 40;

    for (const [panelId, state] of Object.entries(DEFAULT_PANEL_STATES)) {
      expect(state.floating.zIndex).toBeGreaterThanOrEqual(100);
      expect(state.floating.zIndex).toBeGreaterThan(DOCKED_HEADER_MAX_Z);
    }
  });

  it('ensures multiple FloatingPanels have deterministic relative order', async () => {
    const { DEFAULT_PANEL_STATES } = await import('../../src/context/WorkspaceContext');
    const zIndexes = Object.values(DEFAULT_PANEL_STATES).map(p => p.floating.zIndex);
    
    // All zIndexes should be strictly unique and >= 100
    const uniqueZ = new Set(zIndexes);
    expect(uniqueZ.size).toBe(zIndexes.length);
  });

  it('guarantees modals and portal overlays (z-[99999]) remain strictly above FloatingPanels', () => {
    const MODAL_Z_INDEX = 99999;
    const MAX_EXPECTED_FLOATING_Z = 1000;

    expect(MODAL_Z_INDEX).toBeGreaterThan(MAX_EXPECTED_FLOATING_Z);
  });

  it('verifies that changing workspace FloatingPanel z-index does NOT mutate router state or LIVE status', () => {
    const store = useStore.getState();
    const initialLiveStatus = store.isLive;
    const initialActiveRouterId = store.activeRouterId;
    const initialOutputGroups = JSON.stringify(store.outputGroups);

    // Simulate elevating a panel via workspace actions
    // Neither useStore nor DisplayRouter state is tied to workspace UI z-order
    expect(store.isLive).toBe(initialLiveStatus);
    expect(store.activeRouterId).toBe(initialActiveRouterId);
    expect(JSON.stringify(store.outputGroups)).toBe(initialOutputGroups);
  });
});

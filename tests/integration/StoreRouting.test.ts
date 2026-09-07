import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/store/useStore';

describe('Store Routing Independence', () => {
  beforeEach(() => {
    // Reset store state
    useStore.setState({
      groupStates: {},
      outputGroups: [
        { id: 'group-1', name: 'Monitor 1', displayIds: [] },
        { id: 'group-2', name: 'Monitor 2', displayIds: [] },
        { id: 'group-3', name: 'Monitor 3', displayIds: [] }
      ],
      activeControlGroupId: 'group-1',
    });
  });

  it('maintains independent route states', () => {
    const store = useStore.getState();
    
    // Set Route A (group-1)
    store.setGroupState('group-1', { activeSlideIndex: 1, activeItemId: 'song-1' });
    
    // Set Route B (group-2)
    store.setGroupState('group-2', { activeSlideIndex: 5, activeItemId: 'bible-1' });

    const currentStates = useStore.getState().groupStates;
    expect(currentStates['group-1'].activeSlideIndex).toBe(1);
    expect(currentStates['group-1'].activeItemId).toBe('song-1');
    expect(currentStates['group-2'].activeSlideIndex).toBe(5);
    expect(currentStates['group-2'].activeItemId).toBe('bible-1');
    
    // Change Route A
    useStore.getState().setGroupState('group-1', { activeSlideIndex: 2 });
    
    // Assert B is unchanged
    const newStates = useStore.getState().groupStates;
    expect(newStates['group-2'].activeSlideIndex).toBe(5);
    expect(newStates['group-2'].activeItemId).toBe('bible-1');
  });

  it('toggles black state independently', () => {
    const store = useStore.getState();
    
    // Set Route A Black
    useStore.setState({ activeControlGroupId: 'group-1' });
    useStore.getState().toggleBlack('group-1'); // toggles group-1 black

    const states1 = useStore.getState().groupStates;
    expect(states1['group-1'].isBlack).toBe(true);
    expect(states1['group-2']?.isBlack).toBeFalsy(); // Undefined or false

    // Set Route B Clear
    useStore.setState({ activeControlGroupId: 'group-2' });
    useStore.getState().toggleClear('group-2'); // toggles group-2 clear

    const states2 = useStore.getState().groupStates;
    expect(states2['group-1'].isBlack).toBe(true); // Still black
    expect(states2['group-1'].isClear).toBeFalsy();
    expect(states2['group-2'].isClear).toBe(true);
  });
});

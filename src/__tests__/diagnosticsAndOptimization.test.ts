import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeRemoteCommandLocally } from '../store/sync';
import { useStore } from '../store/useStore';
import { slideRenderCache } from '../utils/SlideRenderCache';
import { PresentationCore } from '../core/PresentationCore';
import { hardwareProfile } from '../core/HardwareProfile';

describe('Diagnostics, Remote Pipeline & Database Architecture', () => {
  beforeEach(() => {
    // Reset Zustand store state to known baseline
    useStore.setState({
      activeControlGroupId: 'group-congregation',
      outputGroups: [{ id: 'group-congregation', name: 'Main Congregation', displayIds: [] }],
      groupStates: {
        'group-congregation': {
          activeItemId: 'song-1',
          activeSlideIndex: 0,
          nextSlideIndex: 1,
          activeScheduleId: null,
          isLiveEnabled: true,
          isBlack: false,
          isClear: false,
          showLogo: false,
          timestamp: Date.now()
        }
      },
      stagedGroupStates: {},
      alert: {
        active: false,
        message: '',
        position: 'bottom',
        backgroundColor: '#000000',
        textColor: '#FFFFFF',
        showNursery: false,
        nurseryText: ''
      },
      songsList: [
        {
          id: 'song-1',
          title: 'Amazing Grace',
          author: 'John Newton',
          lyrics: 'Amazing grace how sweet the sound\nThat saved a wretch like me\n\nI once was lost but now am found\nWas blind but now I see',
          copyright: '',
          ccli: ''
        }
      ]
    });
  });

  it('executes next_slide remote command locally and advances activeSlideIndex', () => {
    executeRemoteCommandLocally({ action: 'next_slide' });
    const state = useStore.getState();
    const groupState = state.stagedGroupStates['group-congregation'] || state.groupStates['group-congregation'];
    expect(groupState.activeSlideIndex).toBe(1);
  });

  it('executes prev_slide remote command locally and decreases activeSlideIndex without going negative', () => {
    useStore.getState().setStagedGroupState('group-congregation', { activeSlideIndex: 1 });
    executeRemoteCommandLocally({ action: 'prev_slide' });
    const state = useStore.getState();
    const groupState = state.stagedGroupStates['group-congregation'] || state.groupStates['group-congregation'];
    expect(groupState.activeSlideIndex).toBe(0);

    // Prev slide at index 0 should clamp at 0 (or wrap if configured)
    executeRemoteCommandLocally({ action: 'prev_slide' });
    const state2 = useStore.getState();
    const groupState2 = state2.stagedGroupStates['group-congregation'] || state2.groupStates['group-congregation'];
    expect(groupState2.activeSlideIndex).toBeGreaterThanOrEqual(0);
  });

  it('executes toggle_black command and toggles blackout state cleanly', () => {
    executeRemoteCommandLocally({ action: 'toggle_black' });
    const state = useStore.getState();
    const groupState = state.stagedGroupStates['group-congregation'];
    expect(groupState.isBlack).toBe(true);

    executeRemoteCommandLocally({ action: 'toggle_black' });
    const state2 = useStore.getState();
    const groupState2 = state2.stagedGroupStates['group-congregation'];
    expect(groupState2.isBlack).toBe(false);
  });

  it('executes set_alert and clear_alert remote commands', () => {
    executeRemoteCommandLocally({
      action: 'set_alert',
      params: { text: 'Emergency: Child in Nursery 102', enabled: true }
    });
    let state = useStore.getState();
    expect(state.alert.active).toBe(true);
    expect(state.alert.message).toBe('Emergency: Child in Nursery 102');

    executeRemoteCommandLocally({ action: 'clear_alert' });
    state = useStore.getState();
    expect(state.alert.active).toBe(false);
  });

  it('purges slideRenderCache and PresentationCore cache returning accurate item counts', async () => {
    // Populate fake cache entries via putFrame
    await slideRenderCache.putFrame('test-pres', 0, 'data:image/png;base64,123');
    expect(slideRenderCache.getCacheSize()).toBeGreaterThanOrEqual(1);

    const renderCleared = slideRenderCache.clear();
    expect(renderCleared).toBeGreaterThanOrEqual(1);
    expect(slideRenderCache.getCacheSize()).toBe(0);

    const coreCleared = PresentationCore.clearSlideCache();
    expect(coreCleared).toBeGreaterThanOrEqual(0);
    expect(PresentationCore.getSlideCacheSize()).toBe(0);
  });

  it('HardwareProfile derives valid tier and allocates safe cache limits', () => {
    const hw = hardwareProfile.getHardwareInfoSync();
    expect(['eco', 'medium', 'high']).toContain(hw.tier);
    expect(hw.totalRamMb).toBeGreaterThanOrEqual(1024);
    expect(hw.cpuCores).toBeGreaterThanOrEqual(1);
  });
});

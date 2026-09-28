import { describe, it, expect, beforeEach } from 'vitest';
import { hardwareProfile } from './HardwareProfile';

// Mock localStorage for Node test runner
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    }
  };
})();

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
}

describe('HardwareProfile GPU Detection & Switching Logic', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('provides a valid synchronous hardware baseline', () => {
    const syncInfo = hardwareProfile.getHardwareInfoSync();
    expect(syncInfo).toBeDefined();
    expect(syncInfo.tier).toBeDefined();
    expect(syncInfo.directXStatus).toBeDefined();
    expect(typeof syncInfo.isHardwareAccelerated).toBe('boolean');
  });

  it('allows switching GPU preference between discrete, integrated, and auto', () => {
    // 1. Switch to discrete
    const discInfo = hardwareProfile.switchGpu('discrete');
    expect(hardwareProfile.getPreferredGpuMode()).toBe('discrete');
    expect(discInfo.preferredGpuMode).toBe('discrete');
    expect(globalThis.localStorage.getItem('simpleworship_gpu_preference')).toBe('discrete');

    // 2. Switch to integrated
    const intInfo = hardwareProfile.switchGpu('integrated');
    expect(hardwareProfile.getPreferredGpuMode()).toBe('integrated');
    expect(intInfo.preferredGpuMode).toBe('integrated');
    expect(globalThis.localStorage.getItem('simpleworship_gpu_preference')).toBe('integrated');

    // 3. Switch to auto
    const autoInfo = hardwareProfile.switchGpu('auto');
    expect(hardwareProfile.getPreferredGpuMode()).toBe('auto');
    expect(autoInfo.preferredGpuMode).toBe('auto');
  });

  it('notifies registered listeners when GPU preference changes', () => {
    let notified = false;
    const unsub = hardwareProfile.onHardwareChanged((info) => {
      if (info.preferredGpuMode === 'integrated') {
        notified = true;
      }
    });

    hardwareProfile.switchGpu('integrated');
    expect(notified).toBe(true);
    unsub();
  });
});

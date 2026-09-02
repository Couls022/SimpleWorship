import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DisplayManager } from '../../src/core/DisplayManager';

describe('DisplayManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns default fallback screen in standard browser environment', async () => {
    const displays = await DisplayManager.getDisplays();
    expect(displays).toBeDefined();
    expect(displays.length).toBeGreaterThanOrEqual(1);
    expect(displays[0].id).toBeDefined();
    expect(displays[0].bounds).toBeDefined();
  });

  it('retrieves displays from Electron IPC when available', async () => {
    const mockDisplays = [
      { id: 'disp-1', name: 'Primary Monitor', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, isPrimary: true },
      { id: 'disp-2', name: 'Projector', bounds: { x: 1920, y: 0, width: 1920, height: 1080 }, isPrimary: false }
    ];

    (window as any).electronAPI = {
      getDisplays: vi.fn().mockResolvedValue(mockDisplays)
    };

    const displays = await DisplayManager.getDisplays();
    expect(displays).toEqual(mockDisplays);

    delete (window as any).electronAPI;
  });

  it('retrieves displays from getScreenDetails API when available', async () => {
    const mockScreens = [
      { label: 'Monitor 1', left: 0, top: 0, width: 1920, height: 1080, isPrimary: true, isInternal: true },
      { label: 'Monitor 2', left: 1920, top: 0, width: 1920, height: 1080, isPrimary: false, isInternal: false }
    ];

    (window as any).getScreenDetails = vi.fn().mockResolvedValue({
      screens: mockScreens
    });

    const displays = await DisplayManager.getDisplays();
    expect(displays).toHaveLength(2);
    expect(displays[0].name).toBe('Monitor 1');
    expect(displays[1].bounds.x).toBe(1920);

    delete (window as any).getScreenDetails;
  });
});

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

  it('Operator = Monitor 1, Projector target = Monitor 1 -> BLOCK -> Output Monitor Conflict -> Operator remains usable (Electron)', async () => {
    const conflictResult = {
      success: false,
      status: 'DISCONNECTED' as const,
      conflict: 'SAME_DISPLAY_CONFLICT',
      error: 'The selected Live Output monitor is currently being used by the SimpleWorship operator console.'
    };

    (window as any).electronAPI = {
      isElectron: true,
      openProjector: vi.fn().mockResolvedValue(conflictResult)
    };

    const res = await DisplayManager.openProjector('main-group', 'Monitor 1');
    expect(res.success).toBe(false);
    expect(res.status).toBe('DISCONNECTED');
    expect(res.conflict).toBe('SAME_DISPLAY_CONFLICT');
    expect(res.error).toContain('SimpleWorship operator console');

    // Operator console is NOT disrupted: window status is unaffected and localStatuses does not report connected
    expect(DisplayManager.getLocalStatus('main-group')).toBe('DISCONNECTED');

    delete (window as any).electronAPI;
  });

  it('Operator = Monitor 1, Projector target = Monitor 1 -> Standalone Live Display connects smoothly', async () => {
    // Single display / primary display = Monitor 1
    const res = await DisplayManager.openProjector('main-group', 'primary-display');
    expect(res.success).toBe(true);
    expect(res.status).toBe('CONNECTED');

    expect(DisplayManager.getLocalStatus('main-group')).toBe('CONNECTED');
  });

  it('detects no operator blocking conflicts in detectConflicts', () => {
    const mockDisplays = [
      { id: 'disp-1', name: 'Monitor 1', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, isPrimary: true, isInternal: true, workArea: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, connectionState: 'connected' as const },
      { id: 'disp-2', name: 'Monitor 2', bounds: { x: 1920, y: 0, width: 1920, height: 1080 }, isPrimary: false, isInternal: false, workArea: { x: 1920, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, connectionState: 'connected' as const }
    ];

    const outputGroups = [
      { id: 'group-main', name: 'Main Congregation', displayIds: ['Monitor 1'] },
      { id: 'group-stage', name: 'Stage Display', displayIds: ['disp-2'] }
    ];

    const conflicts = DisplayManager.detectConflicts(outputGroups, mockDisplays);
    expect(conflicts.length).toBe(0);
  });
});

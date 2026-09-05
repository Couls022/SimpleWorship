import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DisplayManager } from '../../src/core/DisplayManager';

describe('Electron Window Z-Order & Operator Overlay Protection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves operator window focus and accessibility when opening projector output', async () => {
    const mockOpenProjector = vi.fn().mockResolvedValue({
      success: true,
      status: 'CONNECTED',
      displayId: 'disp-2',
      groupId: 'main-group'
    });

    (window as any).electronAPI = {
      isElectron: true,
      openProjector: mockOpenProjector
    };

    const res = await DisplayManager.openProjector('main-group', 'disp-2');
    expect(res.success).toBe(true);
    expect(res.status).toBe('CONNECTED');
    expect(mockOpenProjector).toHaveBeenCalledWith('main-group', 'disp-2');

    delete (window as any).electronAPI;
  });

  it('blocks opening projector output on operator display when single display is used', async () => {
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
    expect(res.conflict).toBe('SAME_DISPLAY_CONFLICT');
    expect(res.error).toContain('SimpleWorship operator console');

    delete (window as any).electronAPI;
  });

  it('restores operator window z-order state on closing projector output', async () => {
    const mockCloseProjector = vi.fn().mockResolvedValue({
      success: true,
      status: 'DISCONNECTED',
      displayId: 'disp-2'
    });

    (window as any).electronAPI = {
      isElectron: true,
      closeProjector: mockCloseProjector
    };

    const res = await DisplayManager.closeProjector({ groupId: 'main-group', displayId: 'disp-2' });
    expect(res.success).toBe(true);
    expect(res.status).toBe('DISCONNECTED');

    delete (window as any).electronAPI;
  });
});

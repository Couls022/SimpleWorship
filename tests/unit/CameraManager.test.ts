import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cameraManager } from '../../src/core/CameraManager';

describe('CameraManager', () => {
  beforeEach(() => {
    // Reset singleton if necessary or mock navigator.mediaDevices safely in jsdom
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([
          { kind: 'videoinput', deviceId: 'cam1', label: 'Test Camera 1' },
          { kind: 'audioinput', deviceId: 'mic1', label: 'Test Mic 1' }
        ]),
        getUserMedia: vi.fn().mockResolvedValue({})
      },
      configurable: true,
      writable: true
    });
  });

  it('should only enumerate videoinput devices', async () => {
    const devices = await cameraManager.enumerateCameras();
    expect(devices.length).toBe(1);
    expect(devices[0].deviceId).toBe('cam1');
    expect(devices[0].kind).toBe('videoinput');
  });

  it('should request getUserMedia with correct exact deviceId', async () => {
    await cameraManager.getPreviewStream('cam1');
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: { deviceId: { exact: 'cam1' } },
      audio: false
    });
  });
  
  it('should request live stream with correct exact deviceId independently', async () => {
    await cameraManager.getLiveStream('cam1');
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: { deviceId: { exact: 'cam1' } },
      audio: false
    });
  });
});

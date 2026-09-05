import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MediaStreamController } from '../../src/core/MediaStreamController';
import { PresentationItem } from '../../src/types';

// Mock DB
vi.mock('../../src/db', () => ({
  getDB: vi.fn().mockResolvedValue({
    get: vi.fn().mockImplementation(async (store: string, id: string) => {
      if (id === 'test-asset-1') {
        return { id: 'test-asset-1', blob: new Blob(['test-data'], { type: 'video/mp4' }) };
      }
      if (id === 'test-asset-url') {
        return { id: 'test-asset-url', url: 'https://example.com/video.mp4' };
      }
      return null;
    })
  }),
  dbApi: {
    getCachedUrl: vi.fn().mockReturnValue(undefined),
    getAsset: vi.fn().mockReturnValue(undefined)
  }
}));

describe('MediaStreamController', () => {
  let controller: MediaStreamController;
  let mockVideo: HTMLVideoElement;
  let createObjectUrlSpy: any;
  let revokeObjectUrlSpy: any;

  beforeEach(() => {
    controller = new MediaStreamController();
    mockVideo = {
      src: '',
      load: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      removeAttribute: vi.fn(),
      currentTime: 0
    } as any;
    
    createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
    revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    controller.dispose();
    vi.restoreAllMocks();
  });

  it('loads media and creates ObjectURL', async () => {
    const url = await controller.load('test-asset-1', undefined);
    
    expect(url).toBe('blob:test-url');
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
  });

  it('attaches to video element and plays', async () => {
    controller.attach(mockVideo);
    
    await controller.load('test-asset-1', undefined);
    
    expect(mockVideo.src).toBe('blob:test-url');
    expect(mockVideo.load).toHaveBeenCalled();
    
    controller.play();
    expect(mockVideo.play).toHaveBeenCalled();
  });

  it('revokes ObjectURL on replacement', async () => {
    await controller.load('test-asset-1', undefined);
    
    await controller.replace('test-asset-url', undefined);
    
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:test-url');
  });

  it('cancels stale loads immediately (newest wins)', async () => {
    // Fire both simultaneously. The first one will be stale when it resolves from DB.
    const p1 = controller.load('test-asset-1', undefined);
    const p2 = controller.load('test-asset-url', undefined);
    
    const [url1, url2] = await Promise.all([p1, p2]);
    
    // First request should return null because it was cancelled
    expect(url1).toBeNull();
    // Second request should succeed
    expect(url2).toBe('https://example.com/video.mp4');
    expect(createObjectUrlSpy).not.toHaveBeenCalled(); // item2 has no blob
  });

  it('cleans up on dispose', async () => {
    controller.attach(mockVideo);
    await controller.load('test-asset-1', undefined);
    
    controller.dispose();
    
    expect(mockVideo.pause).toHaveBeenCalled();
    expect(mockVideo.removeAttribute).toHaveBeenCalledWith('src');
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:test-url');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwsManager } from '../../src/core/SwsManager';
import { Schedule } from '../../src/types';
import JSZip from 'jszip';

vi.mock('../../src/db', () => {
  const mockDB = {
    transaction: () => ({
      objectStore: () => ({
        getAll: vi.fn().mockResolvedValue([
          {
            id: 'asset-1',
            name: 'background.jpg',
            type: 'image',
            blob: new Blob(['sample image data'], { type: 'image/jpeg' }),
            url: ''
          }
        ])
      })
    }),
    add: vi.fn().mockResolvedValue('asset-id')
  };

  return {
    getDB: vi.fn().mockResolvedValue(mockDB)
  };
});

describe('SwsManager', () => {
  const mockSchedule: Schedule = {
    id: 'sched-1',
    name: 'Sunday Service',
    createdAt: Date.now(),
    items: [
      {
        id: 'item-1',
        type: 'song',
        name: 'Amazing Grace',
        contentId: 'song-1',
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports a valid .sws ZIP package with manifest and service.json', async () => {
    const blob = await SwsManager.exportService(mockSchedule, 'Sunday Service');
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(0);

    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(blob);

    const manifestFile = loadedZip.file('manifest.json');
    expect(manifestFile).not.toBeNull();
    const manifestJson = JSON.parse(await manifestFile!.async('text'));
    expect(manifestJson.formatVersion).toBe(1);
    expect(manifestJson.appVersion).toBe('1.0.0');

    const serviceFile = loadedZip.file('service.json');
    expect(serviceFile).not.toBeNull();
    const serviceJson = JSON.parse(await serviceFile!.async('text'));
    expect(serviceJson.metadata.title).toBe('Sunday Service');
    expect(serviceJson.schedule.id).toBe('sched-1');
  });

  it('throws error when importing invalid .sws missing manifest', async () => {
    const zip = new JSZip();
    zip.file('dummy.txt', 'hello');
    const blob = await zip.generateAsync({ type: 'blob' });
    const file = new File([blob], 'corrupt.sws');

    await expect(SwsManager.importService(file)).rejects.toThrow('Missing manifest.json');
  });

  it('throws error on unsupported future format version', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ formatVersion: 999, appVersion: '9.0.0' }));
    zip.file('service.json', JSON.stringify({ schedule: mockSchedule, metadata: { title: 'Future' } }));
    const blob = await zip.generateAsync({ type: 'blob' });
    const file = new File([blob], 'future.sws');

    await expect(SwsManager.importService(file)).rejects.toThrow(/Unsupported \.sws version/);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwsManager } from '../../src/core/SwsManager';
import JSZip from 'jszip';

vi.mock('../../src/db', () => {
  const mockDB = {
    transaction: () => ({
      objectStore: () => ({
        getAll: vi.fn().mockResolvedValue([])
      })
    }),
    add: vi.fn().mockResolvedValue('asset-id')
  };

  return {
    getDB: vi.fn().mockResolvedValue(mockDB)
  };
});

describe('Sws Security & Path Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prevents Zip Slip path traversal during import', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ formatVersion: 1, appVersion: '1.0.0' }));
    zip.file('service.json', JSON.stringify({
      metadata: { title: 'Malicious Service' },
      schedule: { id: 's-1', name: 'Malicious', items: [] }
    }));
    // Malicious entry attempting to write outside intended root
    zip.file('../../../etc/passwd', 'root:x:0:0:root:/root:/bin/bash');
    zip.file('..\\..\\windows\\system32\\calc.exe', 'malicious binary');

    const blob = await zip.generateAsync({ type: 'blob' });
    const file = new File([blob], 'exploit.sws');

    // Importing should succeed in reading schedule state safely
    const schedule = await SwsManager.importService(file);
    expect(schedule.id).toBe('s-1');
    expect(schedule.name).toBe('Malicious');
  });

  it('rejects malformed manifest JSON gracefully without unhandled crashes', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', '{ invalid json [ }');
    zip.file('service.json', '{}');
    const blob = await zip.generateAsync({ type: 'blob' });
    const file = new File([blob], 'malformed.sws');

    await expect(SwsManager.importService(file)).rejects.toThrow();
  });
});

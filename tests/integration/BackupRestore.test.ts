import { describe, it, expect, vi } from 'vitest';
import { exportDatabaseBackup, importDatabaseBackup } from '../../src/db/backup';

vi.mock('../../src/db', () => {
  const mockStore = {
    getAll: vi.fn().mockResolvedValue([
      { id: '1', title: 'Amazing Grace', sections: [] }
    ]),
    clear: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue('1')
  };

  const mockDB = {
    transaction: () => ({
      objectStore: () => mockStore,
      done: Promise.resolve()
    })
  };

  return {
    getDB: vi.fn().mockResolvedValue(mockDB),
    dbApi: {}
  };
});

describe('Local Database Backup & Restore Engine', () => {
  it('generates a complete valid backup payload structure', async () => {
    const backupBlob = await exportDatabaseBackup(true);
    const backupText = await backupBlob.text();
    const backup = JSON.parse(backupText);

    expect(backup.version).toBe(1);
    expect(backup.metadata).toBeDefined();
    expect(backup.metadata.songsCount).toBe(1);
    expect(backup.data).toBeDefined();
    expect(backup.data.songs).toHaveLength(1);
  });

  it('restores backup without crashing when valid structure provided', async () => {
    const backupPayload = {
      version: 1,
      timestamp: new Date().toISOString(),
      metadata: { songsCount: 1 },
      data: {
        songs: [{ id: '1', title: 'Restored Song', sections: [] }]
      }
    };

    const file = new File([JSON.stringify(backupPayload)], 'backup.json', { type: 'application/json' });
    await expect(importDatabaseBackup(file)).resolves.toBeUndefined();
  });
});

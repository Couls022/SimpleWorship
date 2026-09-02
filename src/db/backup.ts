import { getDB, dbApi } from './index';
import { Asset, Theme, Song, Schedule, OutputGroup, ScriptureVerse } from '../types';

export interface SimpleWorshipBackup {
  version: number;
  timestamp: string;
  metadata: {
    songsCount: number;
    themesCount: number;
    assetsCount: number;
    schedulesCount: number;
    scripturesCount: number;
    outputGroupsCount: number;
  };
  data: {
    songs: Song[];
    themes: Theme[];
    assets: Asset[];
    schedules: Schedule[];
    scriptures: ScriptureVerse[];
    outputGroups: OutputGroup[];
    settings: any[];
  }
}

export async function exportDatabaseBackup(includeAssets: boolean = false): Promise<Blob> {
  const db = await getDB();
  const tx = db.transaction(
    ['songs', 'themes', 'assets', 'schedules', 'scriptures', 'outputGroups', 'settings'], 
    'readonly'
  );

  const songs = await tx.objectStore('songs').getAll();
  const themes = await tx.objectStore('themes').getAll();
  const rawAssets = await tx.objectStore('assets').getAll();
  const schedules = await tx.objectStore('schedules').getAll();
  const scriptures = await tx.objectStore('scriptures').getAll();
  const outputGroups = await tx.objectStore('outputGroups').getAll();
  const settings = await tx.objectStore('settings').getAll();
  await tx.done;

  // Filter out heavy asset binary data if we just want a portable metadata backup
  const processedAssets = includeAssets ? rawAssets : rawAssets.map(a => ({
    ...a,
    data: a.type === 'image' || a.type === 'video' ? undefined : a.data
  }));

  const backup: SimpleWorshipBackup = {
    version: 1,
    timestamp: new Date().toISOString(),
    metadata: {
      songsCount: songs.length,
      themesCount: themes.length,
      assetsCount: processedAssets.length,
      schedulesCount: schedules.length,
      scripturesCount: scriptures.length,
      outputGroupsCount: outputGroups.length
    },
    data: {
      songs,
      themes,
      assets: processedAssets,
      schedules,
      scriptures,
      outputGroups,
      settings
    }
  };

  const jsonString = JSON.stringify(backup);
  return new Blob([jsonString], { type: 'application/json' });
}

export async function importDatabaseBackup(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const backup = JSON.parse(text) as SimpleWorshipBackup;
        
        if (!backup.data || !backup.version) {
          throw new Error('Invalid backup file format');
        }

        const db = await getDB();
        const tx = db.transaction(
          ['songs', 'themes', 'assets', 'schedules', 'scriptures', 'outputGroups', 'settings'], 
          'readwrite'
        );

        if (backup.data.songs) {
          for (const s of backup.data.songs) await tx.objectStore('songs').put(s);
        }
        if (backup.data.themes) {
          for (const t of backup.data.themes) await tx.objectStore('themes').put(t);
        }
        if (backup.data.assets) {
          for (const a of backup.data.assets) await tx.objectStore('assets').put(a);
        }
        if (backup.data.schedules) {
          for (const s of backup.data.schedules) await tx.objectStore('schedules').put(s);
        }
        if (backup.data.scriptures) {
          for (const sc of backup.data.scriptures) await tx.objectStore('scriptures').put(sc);
        }
        if (backup.data.outputGroups) {
          for (const og of backup.data.outputGroups) await tx.objectStore('outputGroups').put(og);
        }
        if (backup.data.settings) {
          for (const set of backup.data.settings) await tx.objectStore('settings').put(set);
        }

        await tx.done;
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read backup file'));
    reader.readAsText(file);
  });
}

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Asset, Theme, Song, Schedule, OutputGroup, ScriptureVerse, SystemOptions } from '../types';
import { defaultAssets, defaultOutputGroups, defaultSchedule, defaultSongs, defaultThemes, defaultScriptures } from './seedData';
import { runDatabaseSeeder } from '../utils/seedDatabase';

const objectUrlCache = new Map<string, string>();
const assetUrlMap = new Map<string, string>();

export function resolveAssetUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return assetUrlMap.get(url) || url;
}

export function unresolveAssetUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  for (const [id, cachedUrl] of objectUrlCache.entries()) {
    if (cachedUrl === url) return id;
  }
  return url;
}

interface SimpleWorshipDB extends DBSchema {
  assets: {
    key: string;
    value: Asset;
    indexes: { 'by-hash': string; 'by-type': string };
  };
  themes: {
    key: string;
    value: Theme;
    indexes: { 'by-type': string };
  };
  songs: {
    key: string;
    value: Song;
  };
  scriptures: {
    key: string;
    value: ScriptureVerse;
    indexes: { 'by-translation': string; 'by-book': string };
  };
  schedules: {
    key: string;
    value: Schedule;
  };
  outputGroups: {
    key: string;
    value: OutputGroup;
  };
  settings: {
    key: string;
    value: any;
  };
}

let dbPromise: Promise<IDBPDatabase<SimpleWorshipDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<SimpleWorshipDB>('simple-worship-db', 2, {
      async upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains('assets')) {
          const store = db.createObjectStore('assets', { keyPath: 'id' });
          store.createIndex('by-hash', 'hash');
          store.createIndex('by-type', 'type');
        }
        if (!db.objectStoreNames.contains('themes')) {
          const store = db.createObjectStore('themes', { keyPath: 'id' });
          store.createIndex('by-type', 'type');
        }
        if (!db.objectStoreNames.contains('songs')) {
          db.createObjectStore('songs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('scriptures')) {
          const scriptureStore = db.createObjectStore('scriptures', { keyPath: 'id' });
          scriptureStore.createIndex('by-translation', 'translation');
          scriptureStore.createIndex('by-book', 'book');
        }
        if (!db.objectStoreNames.contains('schedules')) {
          db.createObjectStore('schedules', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('outputGroups')) {
          db.createObjectStore('outputGroups', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      },
    }).then(async (db) => {
      // Seed initial data if tables are empty
      const songCount = await db.count('songs');
      if (songCount === 0) {
        const tx = db.transaction(['songs', 'themes', 'assets', 'outputGroups', 'schedules', 'scriptures'], 'readwrite');
        for (const s of defaultSongs) await tx.objectStore('songs').put(s);
        for (const t of defaultThemes) await tx.objectStore('themes').put(t);
        for (const a of defaultAssets) await tx.objectStore('assets').put(a);
        for (const g of defaultOutputGroups) await tx.objectStore('outputGroups').put(g);
        for (const sc of defaultScriptures) await tx.objectStore('scriptures').put(sc);
        await tx.objectStore('schedules').put(defaultSchedule);
        await tx.done;
      }

      // Run full Bible and Baptist Hymnal data seeder asynchronously
      setTimeout(() => {
        runDatabaseSeeder(false).catch(err => console.warn('Background db seeding error:', err));
      }, 500);

      return db;
    });
  }
  return dbPromise;
}

// Helper methods
export const dbApi = {
  // Seeding
  async reseedDatabase(force: boolean = true, onProgress?: (msg: string) => void) {
    return runDatabaseSeeder(force, onProgress);
  },
  async getSeedingStatus() {
    const db = await getDB();
    const songCount = await db.count('songs');
    const scriptureCount = await db.count('scriptures');
    const meta = await db.get('settings', 'library_seeded_v2');
    return {
      songCount,
      scriptureCount,
      isSeeded: !!meta,
      seededMeta: meta
    };
  },
  // Assets
  async addAsset(asset: Asset) {
    if (asset.url && asset.url.startsWith('blob:')) {
      objectUrlCache.set(asset.id, asset.url);
    }
    const db = await getDB();
    await db.put('assets', asset);
  },
  async getAsset(id: string) {
    const db = await getDB();
    const asset = await db.get('assets', id);
    if (asset && asset.blob && asset.url && asset.url.startsWith('blob:')) {
      if (!objectUrlCache.has(asset.id)) {
        objectUrlCache.set(asset.id, URL.createObjectURL(asset.blob));
      }
      asset.url = objectUrlCache.get(asset.id)!;
      if (asset.thumbnailUrl && asset.thumbnailUrl.startsWith('blob:')) {
        asset.thumbnailUrl = asset.url;
      }
    }
    return asset;
  },
  getCachedUrl(id: string): string | undefined {
    return objectUrlCache.get(id);
  },
  async getAllAssets() {
    const db = await getDB();
    // Getting all assets can be slow if there are massive blobs.
    // However, IndexedDB mostly returns references.
    const assets = await db.getAll('assets');
    return assets.map(a => {
      if (a.blob && a.url && a.url.startsWith('blob:')) {
        if (!objectUrlCache.has(a.id)) {
          objectUrlCache.set(a.id, URL.createObjectURL(a.blob));
        }
        (a as any)._oldUrl = a.url;
        a.url = objectUrlCache.get(a.id)!;
        assetUrlMap.set((a as any)._oldUrl, a.url);
        assetUrlMap.set(a.id, a.url);
        if (a.thumbnailUrl && a.thumbnailUrl.startsWith('blob:')) {
          a.thumbnailUrl = a.url;
        }
      }
      return a;
    });
  },
  async deleteAsset(id: string) {
    if (objectUrlCache.has(id)) {
      URL.revokeObjectURL(objectUrlCache.get(id)!);
      objectUrlCache.delete(id);
    }
    const db = await getDB();
    await db.delete('assets', id);
  },

  // Themes
  async addTheme(theme: Theme) {
    const db = await getDB();
    const cloned = JSON.parse(JSON.stringify(theme)) as Theme;
    if (cloned.styles) {
      cloned.styles.backgroundImageUrl = unresolveAssetUrl(cloned.styles.backgroundImageUrl);
      cloned.styles.backgroundVideoUrl = unresolveAssetUrl(cloned.styles.backgroundVideoUrl);
      cloned.styles.logoUrl = unresolveAssetUrl(cloned.styles.logoUrl);
    }
    await db.put('themes', cloned);
  },
  async getTheme(id: string) {
    const db = await getDB();
    return db.get('themes', id);
  },
  async deleteTheme(id: string) {
    const db = await getDB();
    await db.delete('themes', id);
  },

  async getAllThemes() {
    const db = await getDB();
    return db.getAll('themes');
  },

  // Songs
  async addSong(song: Song) {
    const db = await getDB();
    const cloned = JSON.parse(JSON.stringify(song)) as Song;
    cloned.defaultBackgroundUrl = unresolveAssetUrl(cloned.defaultBackgroundUrl);
    if (cloned.themeOverride) {
      cloned.themeOverride.backgroundImageUrl = unresolveAssetUrl(cloned.themeOverride.backgroundImageUrl);
      cloned.themeOverride.backgroundVideoUrl = unresolveAssetUrl(cloned.themeOverride.backgroundVideoUrl);
      cloned.themeOverride.logoUrl = unresolveAssetUrl(cloned.themeOverride.logoUrl);
    }
    await db.put('songs', cloned);
  },
  async getSong(id: string) {
    const db = await getDB();
    return db.get('songs', id);
  },
  async getAllSongs() {
    const db = await getDB();
    return db.getAll('songs');
  },
  async deleteSong(id: string) {
    const db = await getDB();
    await db.delete('songs', id);
  },
  
  // Scriptures
  async addScripture(scripture: ScriptureVerse) {
    const db = await getDB();
    await db.put('scriptures', scripture);
  },
  async getAllScriptures() {
    const db = await getDB();
    return db.getAll('scriptures');
  },
  async searchScriptures(query: string, translation?: string) {
    const db = await getDB();
    const all = await db.getAll('scriptures');
    const q = query.toLowerCase().trim();
    return all.filter(s => {
      const matchesTranslation = !translation || translation === 'ALL' || s.translation.toUpperCase() === translation.toUpperCase();
      const matchesQuery = !q || s.reference.toLowerCase().includes(q) || s.text.toLowerCase().includes(q) || s.book.toLowerCase().includes(q);
      return matchesTranslation && matchesQuery;
    });
  },

  // Schedules
  async addSchedule(schedule: Schedule) {
    const db = await getDB();
    const cloned = JSON.parse(JSON.stringify(schedule)) as Schedule;
    cloned.items = cloned.items.map(item => ({
      ...item,
      customBackgroundUrl: unresolveAssetUrl(item.customBackgroundUrl) || item.customBackgroundUrl,
      themeOverride: item.themeOverride ? {
        ...item.themeOverride,
        backgroundImageUrl: unresolveAssetUrl(item.themeOverride.backgroundImageUrl) || item.themeOverride.backgroundImageUrl,
        backgroundVideoUrl: unresolveAssetUrl(item.themeOverride.backgroundVideoUrl) || item.themeOverride.backgroundVideoUrl,
        logoUrl: unresolveAssetUrl(item.themeOverride.logoUrl) || item.themeOverride.logoUrl
      } : undefined
    }));
    await db.put('schedules', cloned);
  },
  async saveSchedule(schedule: Schedule) {
    const db = await getDB();
    const cloned = JSON.parse(JSON.stringify(schedule)) as Schedule;
    cloned.items = cloned.items.map(item => ({
      ...item,
      customBackgroundUrl: unresolveAssetUrl(item.customBackgroundUrl) || item.customBackgroundUrl,
      themeOverride: item.themeOverride ? {
        ...item.themeOverride,
        backgroundImageUrl: unresolveAssetUrl(item.themeOverride.backgroundImageUrl) || item.themeOverride.backgroundImageUrl,
        backgroundVideoUrl: unresolveAssetUrl(item.themeOverride.backgroundVideoUrl) || item.themeOverride.backgroundVideoUrl,
        logoUrl: unresolveAssetUrl(item.themeOverride.logoUrl) || item.themeOverride.logoUrl
      } : undefined
    }));
    await db.put('schedules', cloned);
  },
  async getSchedule(id: string) {
    const db = await getDB();
    const sched = await db.get('schedules', id);
    if (sched) {
      sched.items = sched.items.map(item => ({
        ...item,
        customBackgroundUrl: resolveAssetUrl(item.customBackgroundUrl) || item.customBackgroundUrl,
        themeOverride: item.themeOverride ? {
          ...item.themeOverride,
          backgroundImageUrl: resolveAssetUrl(item.themeOverride.backgroundImageUrl) || item.themeOverride.backgroundImageUrl,
          backgroundVideoUrl: resolveAssetUrl(item.themeOverride.backgroundVideoUrl) || item.themeOverride.backgroundVideoUrl,
          logoUrl: resolveAssetUrl(item.themeOverride.logoUrl) || item.themeOverride.logoUrl
        } : undefined
      }));
    }
    return sched;
  },
  async getAllSchedules() {
    const db = await getDB();
    const schedules = await db.getAll('schedules');
    return schedules.map(sched => {
      sched.items = sched.items.map(item => ({
        ...item,
        customBackgroundUrl: resolveAssetUrl(item.customBackgroundUrl) || item.customBackgroundUrl,
        themeOverride: item.themeOverride ? {
          ...item.themeOverride,
          backgroundImageUrl: resolveAssetUrl(item.themeOverride.backgroundImageUrl) || item.themeOverride.backgroundImageUrl,
          backgroundVideoUrl: resolveAssetUrl(item.themeOverride.backgroundVideoUrl) || item.themeOverride.backgroundVideoUrl,
          logoUrl: resolveAssetUrl(item.themeOverride.logoUrl) || item.themeOverride.logoUrl
        } : undefined
      }));
      return sched;
    });
  },

  // Output Groups
  async getOutputGroups() {
    const db = await getDB();
    return db.getAll('outputGroups');
  },
  async deleteOutputGroup(id: string) {
    const db = await getDB();
    await db.delete('outputGroups', id);
  },
  async saveOutputGroup(group: OutputGroup) {
    const db = await getDB();
    await db.put('outputGroups', group);
  },
  async saveSystemOptions(options: SystemOptions) {
    const db = await getDB();
    const cloned = JSON.parse(JSON.stringify(options)) as SystemOptions;
    if (cloned.general?.defaultLogoUrl) cloned.general.defaultLogoUrl = unresolveAssetUrl(cloned.general.defaultLogoUrl);
    if (cloned.mainOutput?.general?.defaultLogoUrl) cloned.mainOutput.general.defaultLogoUrl = unresolveAssetUrl(cloned.mainOutput.general.defaultLogoUrl);
    if (cloned.mainOutput?.general?.logoUrl) cloned.mainOutput.general.logoUrl = unresolveAssetUrl(cloned.mainOutput.general.logoUrl);
    await db.put('settings', { id: 'system_options', options: cloned });
  },
  async getSystemOptions() {
    const db = await getDB();
    const item = await db.get('settings', 'system_options');
    return item?.options || null;
  }
};


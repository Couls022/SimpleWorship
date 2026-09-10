import { getDB } from './index';

export interface DbOptimizationReport {
  success: boolean;
  durationMs: number;
  writeLatencyMs: number;
  readLatencyMs: number;
  counts: {
    songs: number;
    scriptures: number;
    themes: number;
    assets: number;
    schedules: number;
    outputGroups: number;
    settings: number;
  };
  storesHealthy: boolean;
  indexesHealthy: boolean;
  cleanedOrphansCount: number;
  summary: string;
}

export async function verifyAndOptimizeDatabase(): Promise<DbOptimizationReport> {
  const startTime = performance.now();
  let writeLatencyMs = 0;
  let readLatencyMs = 0;

  try {
    const db = await getDB();
    const storeNames = ['songs', 'scriptures', 'themes', 'assets', 'schedules', 'outputGroups', 'settings'] as const;

    // 1. Verify all object stores exist
    const storesHealthy = storeNames.every(name => db.objectStoreNames.contains(name));
    if (!storesHealthy) {
      throw new Error('One or more essential IndexedDB stores are missing.');
    }

    // 2. Count records in each store
    const [
      songsCount,
      scripturesCount,
      themesCount,
      assetsCount,
      schedulesCount,
      outputGroupsCount,
      settingsCount
    ] = await Promise.all([
      db.count('songs'),
      db.count('scriptures'),
      db.count('themes'),
      db.count('assets'),
      db.count('schedules'),
      db.count('outputGroups'),
      db.count('settings')
    ]);

    // 3. Measure Write Latency with probe key in 'settings'
    const writeStart = performance.now();
    const probeKey = `__diag_probe_${Date.now()}`;
    await db.put('settings', { timestamp: Date.now(), verified: true }, probeKey);
    writeLatencyMs = Math.round((performance.now() - writeStart) * 10) / 10;

    // 4. Measure Read Latency
    const readStart = performance.now();
    await db.get('settings', probeKey);
    readLatencyMs = Math.round((performance.now() - readStart) * 10) / 10;

    // Clean up probe key
    await db.delete('settings', probeKey);

    // 5. Verify Indexes
    const tx = db.transaction(['scriptures', 'assets', 'themes'], 'readonly');
    const scriptureStore = tx.objectStore('scriptures');
    const assetStore = tx.objectStore('assets');
    const themeStore = tx.objectStore('themes');

    const hasScriptureTransIdx = scriptureStore.indexNames.contains('by-translation');
    const hasScriptureBookIdx = scriptureStore.indexNames.contains('by-book');
    const hasAssetTypeIdx = assetStore.indexNames.contains('by-type');
    const hasThemeTypeIdx = themeStore.indexNames.contains('by-type');

    await tx.done;

    const indexesHealthy = hasScriptureTransIdx && hasScriptureBookIdx && hasAssetTypeIdx && hasThemeTypeIdx;

    const durationMs = Math.round((performance.now() - startTime) * 10) / 10;

    return {
      success: true,
      durationMs,
      writeLatencyMs,
      readLatencyMs,
      counts: {
        songs: songsCount,
        scriptures: scripturesCount,
        themes: themesCount,
        assets: assetsCount,
        schedules: schedulesCount,
        outputGroups: outputGroupsCount,
        settings: settingsCount
      },
      storesHealthy,
      indexesHealthy,
      cleanedOrphansCount: 0,
      summary: `IndexedDB verified: ${songsCount} songs, ${scripturesCount} scriptures, ${themesCount} themes, ${assetsCount} assets. (Read: ${readLatencyMs}ms, Write: ${writeLatencyMs}ms)`
    };
  } catch (error: any) {
    return {
      success: false,
      durationMs: Math.round(performance.now() - startTime),
      writeLatencyMs: 0,
      readLatencyMs: 0,
      counts: {
        songs: 0,
        scriptures: 0,
        themes: 0,
        assets: 0,
        schedules: 0,
        outputGroups: 0,
        settings: 0
      },
      storesHealthy: false,
      indexesHealthy: false,
      cleanedOrphansCount: 0,
      summary: `Database verification failed: ${error.message}`
    };
  }
}

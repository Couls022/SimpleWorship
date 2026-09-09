import { getDB } from '../db';
import { BAPTIST_HYMNAL_SONGS } from '../data/baptistHymnal';
import { HYMNS_OF_PRAISES } from '../data/hymnsOfPraises';
import { BAPTIST_SPECIAL_NUMBERS } from '../data/specialNumbers';
import { loadAllAuthenticBibleVerses } from '../data/fullBibleData';
import { Song, ScriptureVerse } from '../types';

export interface SeedResult {
  success: boolean;
  songsSeeded: number;
  scripturesSeeded: number;
  message: string;
}

/**
 * Executes full data seeding for the Baptist Hymnal collection and 
 * complete authentic KJV and Tagalog Bible text corpus into IndexedDB.
 */
export async function runDatabaseSeeder(
  force: boolean = false,
  onProgress?: (progressText: string) => void
): Promise<SeedResult> {
  try {
    const db = await getDB();

    // Check if already seeded unless force === true
    if (!force) {
      const isAlreadySeeded = await db.get('settings', 'library_seeded_v7');
      if (isAlreadySeeded) {
        const songCount = await db.count('songs');
        const scCount = await db.count('scriptures');
        return {
          success: true,
          songsSeeded: songCount,
          scripturesSeeded: scCount,
          message: `Library is already fully seeded (${songCount} songs, ${scCount} scripture verses loaded).`
        };
      }
    }

    onProgress?.('Loading authentic KJV and Tagalog 66 Books Bible text corpus...');
    const fullBibleVerses = await loadAllAuthenticBibleVerses();

    onProgress?.('Preparing Hymnals and Special Numbers collection...');
    const hymnalSongs = [...BAPTIST_HYMNAL_SONGS, ...HYMNS_OF_PRAISES, ...BAPTIST_SPECIAL_NUMBERS];

    // 1. Seed Songs in Batch Transaction
    onProgress?.(`Seeding ${hymnalSongs.length} built-in songs into IndexedDB...`);
    const songTx = db.transaction('songs', 'readwrite');
    const songStore = songTx.objectStore('songs');
    for (const song of hymnalSongs) {
      await songStore.put(song);
    }
    await songTx.done;

    // 2. Seed Scriptures in Chunked Batch Transactions for Optimal Performance
    onProgress?.(`Seeding ${fullBibleVerses.length} authentic KJV & Tagalog scripture verses into IndexedDB...`);
    const CHUNK_SIZE = 2500;
    for (let i = 0; i < fullBibleVerses.length; i += CHUNK_SIZE) {
      const chunk = fullBibleVerses.slice(i, i + CHUNK_SIZE);
      const scTx = db.transaction('scriptures', 'readwrite');
      const scStore = scTx.objectStore('scriptures');
      for (const verse of chunk) {
        await scStore.put(verse);
      }
      await scTx.done;
      const pct = Math.min(100, Math.round(((i + chunk.length) / fullBibleVerses.length) * 100));
      onProgress?.(`Seeding Bible verses... ${pct}% complete`);
    }

    // Mark as seeded
    await db.put('settings', {
      id: 'library_seeded_v7',
      key: 'library_seeded_v7',
      value: true,
      timestamp: Date.now(),
      songsCount: hymnalSongs.length,
      scripturesCount: fullBibleVerses.length
    });

    return {
      success: true,
      songsSeeded: hymnalSongs.length,
      scripturesSeeded: fullBibleVerses.length,
      message: `Database successfully seeded with ${hymnalSongs.length} built-in Hymns and ${fullBibleVerses.length} KJV & Tagalog Scripture verses!`
    };
  } catch (error: any) {
    console.error('Failed to seed database:', error);
    return {
      success: false,
      songsSeeded: 0,
      scripturesSeeded: 0,
      message: `Seeding failed: ${error?.message || String(error)}`
    };
  }
}


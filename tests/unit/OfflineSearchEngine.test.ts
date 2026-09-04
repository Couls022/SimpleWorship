import { describe, it, expect, beforeEach } from 'vitest';
import { OfflineSearchEngine } from '../../src/core/OfflineSearchEngine';
import { BibleEngine, BIBLE_BOOKS } from '../../src/data/bibleEngine';
import { BAPTIST_HYMNAL_SONGS } from '../../src/data/baptistHymnal';
import { Song, ScriptureVerse, PresentationItem } from '../../src/types';
import { useStore } from '../../src/store/useStore';
import { DisplayManager } from '../../src/core/DisplayManager';

describe('Offline Search Engine - Songs & Scriptures & Live Isolation', () => {
  const sampleSongs: Song[] = [
    ...BAPTIST_HYMNAL_SONGS,
    {
      id: 'custom-special-1',
      title: 'Amazing Grace (My Chains Are Gone)',
      author: 'Chris Tomlin / John Newton',
      category: 'Special Number',
      key: 'E',
      lyrics: 'Amazing grace how sweet the sound\nMy chains are gone I have been set free\nMy God my Savior has ransomed me',
      sections: [
        { id: 'cs-v1', name: 'Verse 1', text: 'Amazing grace how sweet the sound' },
        { id: 'cs-ch', name: 'Chorus', text: 'My chains are gone I have been set free\nMy God my Savior has ransomed me' }
      ],
      ccli: '4768151'
    }
  ];

  beforeEach(async () => {
    await BibleEngine.preload();
  });

  // ==========================================
  // SONGS SEARCH TESTS
  // ==========================================
  describe('Songs Search Engine', () => {
    it('1. Searches by exact title', () => {
      const results = OfflineSearchEngine.searchSongs(sampleSongs, 'Holy, Holy, Holy! Lord God Almighty');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].song.title).toContain('Holy, Holy, Holy');
      expect(results[0].matchReasons).toContain('Exact title match');
    });

    it('2. Searches by partial title', () => {
      const results = OfflineSearchEngine.filterSongs(sampleSongs, 'Amaz');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title.toLowerCase()).toContain('amaz');
    });

    it('3. Searches by song number (#1, 31, #31, etc.)', () => {
      const res1 = OfflineSearchEngine.searchSongs(sampleSongs, '1');
      expect(res1.length).toBeGreaterThan(0);
      expect(res1[0].song.id).toBe('hymn-1');
      expect(res1[0].matchReasons.some(r => r.includes('Song #1'))).toBe(true);

      const res31 = OfflineSearchEngine.searchSongs(sampleSongs, '31');
      expect(res31.length).toBeGreaterThan(0);
      expect(res31[0].song.title).toContain('31');
    });

    it('4. Searches by single lyric word (e.g. "blood", "fountain")', () => {
      const results = OfflineSearchEngine.filterSongs(sampleSongs, 'blood');
      expect(results.length).toBeGreaterThan(0);
      const hasBlood = results.some(s => (s.lyrics || s.sections?.map(sec => sec.text).join(' ') || '').toLowerCase().includes('blood'));
      expect(hasBlood).toBe(true);
    });

    it('5. Searches by lyric phrase (e.g. "chains are gone", "ransomed me")', () => {
      const results = OfflineSearchEngine.filterSongs(sampleSongs, 'chains are gone');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toBe('Amazing Grace (My Chains Are Gone)');
    });

    it('6. Searches by multiple words regardless of order', () => {
      const results = OfflineSearchEngine.filterSongs(sampleSongs, 'sweet sound grace');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Amazing Grace');
    });

    it('7. Handles case-insensitivity seamlessly', () => {
      const upper = OfflineSearchEngine.filterSongs(sampleSongs, 'HOLY HOLY');
      const lower = OfflineSearchEngine.filterSongs(sampleSongs, 'holy holy');
      const mixed = OfflineSearchEngine.filterSongs(sampleSongs, 'HoLy HoLy');

      expect(upper.length).toBe(lower.length);
      expect(upper[0].id).toBe(lower[0].id);
      expect(upper[0].id).toBe(mixed[0].id);
    });

    it('8. Handles punctuation normalization (Holy, Holy, Holy! vs holy holy holy)', () => {
      const withPunct = OfflineSearchEngine.filterSongs(sampleSongs, 'Holy, Holy, Holy!');
      const withoutPunct = OfflineSearchEngine.filterSongs(sampleSongs, 'holy holy holy');

      expect(withPunct.length).toBeGreaterThan(0);
      expect(withoutPunct.length).toBeGreaterThan(0);
      expect(withPunct[0].id).toBe(withoutPunct[0].id);
    });

    it('9. Handles empty search query by returning all candidates', () => {
      const results = OfflineSearchEngine.filterSongs(sampleSongs, '   ');
      expect(results.length).toBe(sampleSongs.length);
    });

    it('10. Handles no-result queries gracefully without error', () => {
      const results = OfflineSearchEngine.filterSongs(sampleSongs, 'xyznonexistentword98765');
      expect(results).toEqual([]);
    });

    it('11. Searches by Author/Composer and CCLI metadata', () => {
      const authorResults = OfflineSearchEngine.filterSongs(sampleSongs, 'Reginald Heber');
      expect(authorResults.length).toBeGreaterThan(0);
      expect(authorResults[0].author).toContain('Reginald Heber');

      const ccliResults = OfflineSearchEngine.filterSongs(sampleSongs, '4768151');
      expect(ccliResults.length).toBeGreaterThan(0);
      expect(ccliResults[0].ccli).toBe('4768151');
    });

    it('12. Respects category filtering (Hymns vs Special Number)', () => {
      const hymnsOnly = OfflineSearchEngine.filterSongs(sampleSongs, 'grace', 'Hymns');
      expect(hymnsOnly.every(s => OfflineSearchEngine.getNormalizedCategory(s) === 'Hymns')).toBe(true);

      const specialOnly = OfflineSearchEngine.filterSongs(sampleSongs, 'grace', 'Special Number');
      expect(specialOnly.every(s => OfflineSearchEngine.getNormalizedCategory(s) === 'Special Number')).toBe(true);
    });
  });

  // ==========================================
  // SCRIPTURES SEARCH TESTS
  // ==========================================
  describe('Scripture Search Engine', () => {
    it('13. Searches by book name (e.g. "John", "Genesis")', async () => {
      const results = await BibleEngine.search('John', 'KJV');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].book).toBe('John');
      expect(results[0].chapter).toBe(1);
    });

    it('14. Searches by book + chapter (e.g. "John 3", "Genesis 1")', async () => {
      const results = await BibleEngine.search('John 3', 'KJV');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].book).toBe('John');
      expect(results[0].chapter).toBe(3);
    });

    it('15. Searches by exact full reference (e.g. "John 3:16")', async () => {
      const results = await BibleEngine.search('John 3:16', 'KJV');
      expect(results.length).toBe(1);
      expect(results[0].reference).toBe('John 3:16');
      expect(results[0].text.toLowerCase()).toContain('for god so loved the world');
    });

    it('16. Searches by reference range (e.g. "John 3:16-18")', async () => {
      const results = await BibleEngine.search('John 3:16-18', 'KJV');
      expect(results.length).toBe(3);
      expect(results[0].verse).toBe(16);
      expect(results[2].verse).toBe(18);
    });

    it('17. Searches by Chapter:Verse cross-bible (e.g. "3:16")', async () => {
      const results = await BibleEngine.search('3:16', 'KJV');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(v => v.chapter === 3 && v.verse === 16)).toBe(true);
      expect(results[0].book).toBe('John'); // John 3:16 prioritized
    });

    it('18. Searches by passage text / phrase (e.g. "for god so loved", "born again")', async () => {
      const results = await BibleEngine.search('for god so loved', 'KJV');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(v => v.reference === 'John 3:16')).toBe(true);
    });

    it('19. Searches by multiple words inside verse', async () => {
      const results = await BibleEngine.search('light darkness beginning', 'KJV');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(v => v.book === 'Genesis' || v.book === 'John')).toBe(true);
    });

    it('20. Searches Tagalog / Ang Dating Biblia correctly', async () => {
      const results = await BibleEngine.search('Juan 3:16', 'Tagalog');
      expect(results.length).toBe(1);
      expect(results[0].translation).toBe('Tagalog');
      expect(results[0].reference).toBe('Juan 3:16');
      expect(results[0].text).toContain('Sapagka\'t gayon na lamang ang pagsinta ng Dios');
    });

    it('21. Searches in "Both" mode returning both KJV and Tagalog tagged verses', async () => {
      const results = await BibleEngine.search('John 3:16', 'Both');
      expect(results.length).toBe(2);
      expect(results.some(v => v.translation === 'KJV')).toBe(true);
      expect(results.some(v => v.translation === 'Tagalog')).toBe(true);
    });

    it('22. Handles scripture search case-insensitivity and punctuation', async () => {
      const res1 = await BibleEngine.search('FOR GOD SO LOVED THE WORLD', 'KJV');
      const res2 = await BibleEngine.search('for god so loved the world', 'KJV');
      expect(res1.length).toBe(res2.length);
      expect(res1[0]?.reference).toBe(res2[0]?.reference);
    });

    it('23. Handles scripture no-result searches gracefully', async () => {
      const results = await BibleEngine.search('nonexistentversephrase12345', 'KJV');
      expect(results).toEqual([]);
    });
  });

  // ==========================================
  // LIVE ISOLATION & PERSISTENCE TESTS
  // ==========================================
  describe('Search + Live Output Isolation & Persistence', () => {
    it('24. Operator searching in Songs or Scriptures does NOT terminate or alter LIVE output', async () => {
      const store = useStore.getState();
      const activeGroup = store.activeControlGroupId;
      
      // Step A: Set initial live output (Scripture John 3:16)
      const liveItem: PresentationItem = {
        id: 'live-scripture-1',
        type: 'bible' as const,
        name: 'John 3:16',
        data: {
          verse: {
            id: 'jhn-3-16-kjv',
            book: 'John',
            chapter: 3,
            verse: 16,
            reference: 'John 3:16 (KJV)',
            translation: 'KJV',
            text: 'For God so loved the world, that he gave his only begotten Son...'
          }
        }
      };

      store.goLiveItem('live-scripture-1', 0, activeGroup, liveItem);
      expect(useStore.getState().groupStates[activeGroup]?.directLiveItem?.name).toBe('John 3:16');

      // Step B: Operator executes active searches in Songs
      const songResults = OfflineSearchEngine.searchSongs(sampleSongs, 'Holy');
      expect(songResults.length).toBeGreaterThan(0);

      // Verify LIVE output is completely unchanged
      expect(useStore.getState().groupStates[activeGroup]?.directLiveItem?.name).toBe('John 3:16');

      // Step C: Operator searches in Scriptures
      const scriptureResults = await BibleEngine.search('Genesis 1:1', 'KJV');
      expect(scriptureResults.length).toBeGreaterThan(0);

      // Verify LIVE output remains undisturbed
      expect(useStore.getState().groupStates[activeGroup]?.directLiveItem?.name).toBe('John 3:16');
    });

    it('25. Selecting a search result and explicitly sending LIVE updates live content persistently', () => {
      const store = useStore.getState();
      const activeGroup = store.activeControlGroupId;

      const searchResults = OfflineSearchEngine.filterSongs(sampleSongs, 'Amazing Grace');
      expect(searchResults.length).toBeGreaterThan(0);
      const chosenSong = searchResults[0];

      // Send to Live
      const newLiveSongItem: PresentationItem = {
        id: `song-${chosenSong.id}`,
        type: 'song',
        contentId: chosenSong.id,
        name: chosenSong.title,
        data: {
          songId: chosenSong.id,
          title: chosenSong.title,
          lyrics: chosenSong.lyrics
        }
      };

      store.goLiveItem(newLiveSongItem.id, 0, activeGroup, newLiveSongItem);

      expect(useStore.getState().groupStates[activeGroup]?.directLiveItem?.name).toBe(chosenSong.title);

      // Operator searches again for another query "blood"
      OfflineSearchEngine.filterSongs(sampleSongs, 'blood');

      // Live item remains the Amazing Grace song
      expect(useStore.getState().groupStates[activeGroup]?.directLiveItem?.name).toBe(chosenSong.title);
    });

    it('26. Generic search engine safely filters arbitrary items like presentations/media', () => {
      const mediaList = [
        { id: 'm1', name: 'Sunday Worship Background 1080p.mp4', category: 'Motion Background' },
        { id: 'm2', name: 'Cross Silhouette Sunset.jpg', category: 'Still Background' },
        { id: 'm3', name: 'Baptism Service Countdown.mp4', category: 'Countdown' }
      ];

      const res = OfflineSearchEngine.searchGeneric(mediaList, 'sunset', m => [m.name, m.category]);
      expect(res.length).toBe(1);
      expect(res[0].id).toBe('m2');

      const resCountdown = OfflineSearchEngine.searchGeneric(mediaList, 'countdown', m => [m.name, m.category]);
      expect(resCountdown.length).toBe(1);
      expect(resCountdown[0].id).toBe('m3');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { BAPTIST_HYMNAL } from '../data/baptistHymnal';
import { HYMNS_OF_PRAISES } from '../data/hymnsOfPraises';
import { SPECIAL_NUMBERS } from '../data/specialNumbers';
import { PresentationCore } from '../core/PresentationCore';
import { OfflineSearchEngine } from '../core/OfflineSearchEngine';
import { Song, SystemOptions } from '../types';

describe('Song Database Data Integrity Tests', () => {
  const allSongs = [...BAPTIST_HYMNAL, ...HYMNS_OF_PRAISES, ...SPECIAL_NUMBERS];

  it('should have a substantial library of songs loaded', () => {
    expect(allSongs.length).toBeGreaterThan(20);
  });

  it('should ensure all songs have valid IDs and non-empty titles', () => {
    const ids = new Set<string>();
    for (const song of allSongs) {
      expect(song.id).toBeDefined();
      expect(song.id.length).toBeGreaterThan(0);
      expect(ids.has(song.id), `Duplicate song ID: ${song.id} in "${song.title}"`).toBe(false);
      ids.add(song.id);

      expect(song.title).toBeDefined();
      expect(song.title.trim().length).toBeGreaterThan(0);
    }
  });

  it('should ensure song sections and lyrics are populated properly', () => {
    for (const song of allSongs) {
      expect(song.lyrics).toBeDefined();
      expect(song.lyrics.length).toBeGreaterThan(0);
      expect(song.sections).toBeDefined();
      expect(song.sections.length).toBeGreaterThan(0);

      // Verify each section has an id, name, and text
      for (const sec of song.sections) {
        expect(sec.id).toBeDefined();
        expect(sec.name).toBeDefined();
        expect(typeof sec.text).toBe('string');
      }
    }
  });

  it('should ensure title section in songs does NOT include the author name', () => {
    for (const song of allSongs) {
      const titleSec = song.sections.find(s => s.name === 'Title');
      if (titleSec && song.author) {
        // The title section text should be exactly the title or trimmed title, NOT containing author
        const lines = titleSec.text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length > 1) {
          // If there are multiple lines, verify the author is not appended
          expect(lines).not.toContain(song.author.trim());
        }
      }
    }
  });
});

describe('PresentationCore Slide Generation Tests', () => {
  const sampleSong: Song = {
    id: 'test-song-1',
    title: 'Amazing Grace',
    author: 'John Newton',
    category: 'Hymns',
    lyrics: '[Title]\nAmazing Grace\n\n[Verse 1]\nAmazing grace how sweet the sound\nThat saved a wretch like me\nI once was lost but now am found\nWas blind but now I see',
    sections: [
      { id: 'sec-title', name: 'Title', text: 'Amazing Grace' },
      { id: 'sec-v1', name: 'Verse 1', text: 'Amazing grace how sweet the sound\nThat saved a wretch like me\nI once was lost but now am found\nWas blind but now I see' },
    ]
  };

  const defaultSysOptions: any = {
    mainOutput: {
      general: {
        outputMonitor: 'Primary',
        displayMode: 'fullscreen',
        aspectRatio: '16:9',
        resolution: '1920x1080',
        enableDisplay: true,
        defaultLogoUrl: '',
        position: { left: 0, top: 0, width: 1920, height: 1080 }
      },
      song: {
        fontFamily: 'Inter',
        fontSize: 48,
        fontColor: '#ffffff',
        bold: true,
        italic: false,
        alignment: 'center',
        verticalAlignment: 'middle',
        lineSpacing: 1.2,
        maxLines: 4,
        autoWrap: true,
        showTitleSlide: true,
        showSongInfo: true,
        splitLongSections: true,
        maxLinesPerSlide: 4,
        splitLabelStyle: 'part',
        transitionEffect: 'fade',
        transitionDuration: 300,
        textShadow: true,
        shadowColor: 'rgba(0,0,0,0.8)',
        shadowBlur: 4,
        textOutline: true,
        outlineColor: '#000000',
        outlineWidth: 2,
        allCaps: false,
        smartQuotes: true,
        preservePunctuation: true
      },
      scripture: {
        fontFamily: 'Inter',
        fontSize: 44,
        fontColor: '#ffffff',
        bold: false,
        italic: false,
        alignment: 'center',
        verticalAlignment: 'middle',
        lineSpacing: 1.2,
        showVerseNumbers: true,
        showReference: true,
        referencePosition: 'bottom',
        referenceFormat: 'full',
        transitionEffect: 'fade',
        transitionDuration: 300,
        translation: 'KJV',
        textShadow: true,
        shadowColor: 'rgba(0,0,0,0.8)',
        shadowBlur: 4,
        textOutline: true,
        outlineColor: '#000000',
        outlineWidth: 2,
        allCaps: false,
        smartQuotes: true,
        preservePunctuation: true
      },
      presentation: {
        transitionEffect: 'fade',
        transitionDuration: 300,
        slideLayout: 'contain',
        loopSlideshow: false,
        advanceDelay: 3000
      }
    } as any,
    advanced: {
      showLiveOnStartup: false,
      advanceScheduleOnGoLive: true,
      enableRemoteControl: true,
      preventDvdSpinDown: false,
      alwaysSaveStandalone: false,
      remoteName: 'SimpleWorship Remote'
    }
  };

  it('should generate slides with Title as first slide when matched song provided', () => {
    const scheduleItem = {
      id: 'item-1',
      name: 'Amazing Grace',
      type: 'song' as const,
      contentId: 'test-song-1',
    };

    const slides = PresentationCore.generateSlides(
      scheduleItem,
      [sampleSong],
      defaultSysOptions
    );

    expect(slides.length).toBeGreaterThanOrEqual(2);
    expect(slides[0].title).toBe('Title');
    // Critical: Title slide text MUST NOT include the author name
    expect(slides[0].text.trim()).toBe('Amazing Grace');
    expect(slides[0].text).not.toContain('John Newton');
  });

  it('should split long sections correctly when splitLongSections is enabled', () => {
    const longText = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8';
    const splitSlides = PresentationCore.splitSongSection(
      'Verse 1',
      longText,
      'song-1',
      undefined,
      {
        splitLongSections: true,
        maxLinesPerSlide: 4,
        splitLabelStyle: 'part',
      } as any
    );
    expect(splitSlides.length).toBe(2);
    expect(splitSlides[0].title).toBe('Verse 1 (Part 1)');
    expect(splitSlides[1].title).toBe('Verse 1 (Part 2)');
    expect(splitSlides[0].text).toBe('Line 1\nLine 2\nLine 3\nLine 4');
    expect(splitSlides[1].text).toBe('Line 5\nLine 6\nLine 7\nLine 8');
  });

  it('should support numeric split label style', () => {
    const longText = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6';
    const splitSlides = PresentationCore.splitSongSection(
      'Chorus',
      longText,
      'song-1',
      undefined,
      {
        splitLongSections: true,
        maxLinesPerSlide: 3,
        splitLabelStyle: 'numeric',
      } as any
    );

    expect(splitSlides.length).toBe(2);
    expect(splitSlides[0].title).toBe('Chorus.1');
    expect(splitSlides[1].title).toBe('Chorus.2');
  });
});

describe('OfflineSearchEngine Tests', () => {
  const songs = [...BAPTIST_HYMNAL, ...HYMNS_OF_PRAISES, ...SPECIAL_NUMBERS];

  it('should successfully match songs by exact title', () => {
    const results = OfflineSearchEngine.searchSongs(songs, 'Amazing Grace');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].song.title).toBe('Amazing Grace');
  });

  it('should search songs with case insensitivity and partial query', () => {
    const results = OfflineSearchEngine.filterSongs(songs, 'katapatan');
    expect(results.length).toBeGreaterThan(0);
    const found = results.some(s => s.title.toLowerCase().includes('katapatan'));
    expect(found).toBe(true);
  });

  it('should match song by hymn number or title phrase', () => {
    const results = OfflineSearchEngine.searchSongs(songs, '10,000');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].song.title).toContain('10,000 Reasons');
  });

  it('should return all songs when search query is empty', () => {
    const results = OfflineSearchEngine.searchSongs(songs, '');
    expect(results.length).toBe(songs.length);
  });
});

describe('Scripture & Reference Parsing Tests', () => {
  it('should parse book, chapter, and verse correctly', () => {
    const parsed = OfflineSearchEngine.parseScriptureReference('John 3:16');
    expect(parsed.type).toBe('full_reference');
    if (parsed.type === 'full_reference') {
      expect(parsed.book.name).toBe('John');
      expect(parsed.chapter).toBe(3);
      expect(parsed.startVerse).toBe(16);
      expect(parsed.endVerse).toBe(16);
    }
  });

  it('should parse verse range correctly (e.g. John 3:16-18)', () => {
    const parsed = OfflineSearchEngine.parseScriptureReference('John 3:16-18');
    expect(parsed.type).toBe('full_reference');
    if (parsed.type === 'full_reference') {
      expect(parsed.chapter).toBe(3);
      expect(parsed.startVerse).toBe(16);
      expect(parsed.endVerse).toBe(18);
    }
  });

  it('should parse Tagalog book names (e.g. Awit 23:1)', () => {
    const parsed = OfflineSearchEngine.parseScriptureReference('Awit 23:1');
    expect(parsed.type).toBe('full_reference');
    if (parsed.type === 'full_reference') {
      expect(parsed.chapter).toBe(23);
      expect(parsed.startVerse).toBe(1);
    }
  });

  it('should parse numbered books (e.g. 1 Cor 13:4)', () => {
    const parsed = OfflineSearchEngine.parseScriptureReference('1 Corinthians 13:4');
    expect(parsed.type).toBe('full_reference');
    if (parsed.type === 'full_reference') {
      expect(parsed.book.name).toBe('1 Corinthians');
      expect(parsed.chapter).toBe(13);
      expect(parsed.startVerse).toBe(4);
    }
  });

  it('should parse chapter-only queries (e.g. Genesis 1)', () => {
    const parsed = OfflineSearchEngine.parseScriptureReference('Genesis 1');
    expect(parsed.type).toBe('chapter');
    if (parsed.type === 'chapter') {
      expect(parsed.book.name).toBe('Genesis');
      expect(parsed.chapter).toBe(1);
    }
  });

  it('should handle general text queries gracefully without crashing', () => {
    const parsed = OfflineSearchEngine.parseScriptureReference('for God so loved the world');
    expect(parsed.type).toBe('text_query');
    expect(parsed.cleanedQuery).toBe('for God so loved the world');
  });

  it('should handle null or empty inputs safely', () => {
    const parsedEmpty = OfflineSearchEngine.parseScriptureReference('');
    expect(parsedEmpty.type).toBe('text_query');

    const parsedNull = OfflineSearchEngine.parseScriptureReference(null as any);
    expect(parsedNull.type).toBe('text_query');
  });
});

describe('PresentationCore Scripture Slide Generation Tests', () => {
  const bibleItem = {
    id: 'sched-bible-1',
    name: 'John 3:16',
    type: 'bible' as const,
    contentId: 'jhn-3-16',
    data: {
      verses: [
        {
          id: 'jhn-3-16',
          book: 'John',
          chapter: 3,
          verse: 16,
          text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
          translation: 'KJV'
        }
      ]
    }
  };

  it('should generate properly formatted slides for scripture items', () => {
    const slides = PresentationCore.generateSlides(bibleItem, [], {} as any);
    expect(slides.length).toBe(1);
    expect(slides[0].title).toContain('John 3:16');
    expect(slides[0].text).toContain('For God so loved the world');
  });
});

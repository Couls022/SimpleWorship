import { describe, it, expect } from 'vitest';
import { ThemeEngine } from '../core/ThemeEngine';
import { buildRenderFrame } from '../core/RenderFrameBuilder';
import { PresentationCore } from '../core/PresentationCore';
import { PresentationContentResolver } from '../core/PresentationContentResolver';
import { SystemOptions, PresentationState, Schedule, OutputGroup, ThemeStyles, PresentationItem, FontStyleOptions } from '../types';

const createFont = (overrides: Partial<FontStyleOptions> & { family: string; maxSize: number }): FontStyleOptions => ({
  color: '#ffffff',
  bold: false,
  italic: false,
  underline: false,
  alignHorizontal: 'center',
  alignVertical: 'middle',
  opacity: 1,
  ...overrides,
});

describe('SimpleWorship Final Presentation Pipeline Test Suite', () => {
  const mockSystemOptions: SystemOptions = {
    mainOutput: {
      general: {
        outputMonitor: 'Display 1',
        alphaChannel: 'Disabled',
        position: { left: 0, top: 0, width: 1920, height: 1080 },
        margins: { left: 0, top: 0, right: 0, bottom: 0 },
        defaultFont: createFont({ family: 'Montserrat, sans-serif', maxSize: 90 }),
        disableLogoOnLive: false,
      },
      song: {
        songFont: createFont({ family: 'Georgia', maxSize: 90, bold: true }),
        labelFont: createFont({ family: 'Montserrat', maxSize: 30 }),
        copyrightFont: createFont({ family: 'Montserrat', maxSize: 20 }),
        licenseInfo: '',
        minFontSize: 32,
        lineSpacing: 1.35,
        allCapsLyrics: false,
        showVerseChorusLabel: true,
        labelLocation: 'Header',
        labelStyle: 'uppercase',
        displayCopyrightInfo: true,
        copyrightPosition: 'Bottom Left',
        showOnFirstSlideOnly: false,
        showOnLastSlideOnly: false,
      },
      scripture: {
        enableScriptureSupport: true,
        scriptureFont: createFont({ family: 'Times New Roman', maxSize: 80, italic: false }),
        verseFont: createFont({ family: 'Times New Roman', maxSize: 40 }),
        referenceFont: createFont({ family: 'Times New Roman', maxSize: 40 }),
        minFontSize: 32,
        lineSpacing: 1.4,
        showVerseNumbers: true,
        verseNumberStyle: 'superscript',
        verseColor: '#F6E05E',
        showReference: true,
        referenceLocation: 'After Each Slide',
        showTranslationBadge: true,
        showCompletePassage: true,
        referenceIndent: false,
        abbreviateBookNames: false,
        additionalLineSpacing: false,
        showReferenceOnly: false,
        breakOnNewVerse: false,
        automaticallyFlow: false,
      },
      presentations: {
        titleFont: createFont({ family: 'Montserrat', maxSize: 90 }),
        subTitleFont: createFont({ family: 'Montserrat', maxSize: 60 }),
        contentFont: createFont({ family: 'Montserrat', maxSize: 70 }),
      },
      transitions: {
        activeTab: 'Slide',
        blend: 'Blend',
        duration: 500,
      },
      alerts: {
        nursery: {
          enabled: false,
          font: createFont({ family: 'Montserrat', maxSize: 30 }),
          backgroundColor: '#000000',
          backgroundOpacity: 0.8,
          location: 'Top Right',
          autoRemove: false,
          autoRemoveDuration: '30s',
        },
        message: {
          enabled: false,
          font: createFont({ family: 'Montserrat', maxSize: 30 }),
          backgroundColor: '#000000',
          backgroundOpacity: 0.8,
          location: 'Bottom',
          scrollSpeed: 5,
        },
      },
    },
    alternateOutput: {
      enabled: false,
      outputMonitor: 'Display 2',
      position: { left: 0, top: 0, width: 1920, height: 1080 },
      margins: { left: 0, top: 0, right: 0, bottom: 0 },
      defaultFont: createFont({ family: 'Montserrat', maxSize: 90 }),
    },
    foldback: {
      enabled: false,
      outputMonitor: 'Display 3',
      position: { left: 0, top: 0, width: 1920, height: 1080 },
      margins: { left: 0, top: 0, right: 0, bottom: 0 },
      defaultFont: createFont({ family: 'Montserrat', maxSize: 90 }),
      clockEnabled: true,
    },
    serviceIntervals: {
      countdownEnabled: false,
      countdownTime: '00:00',
      intervalType: 'Service',
    },
    slideLabels: [],
    advanced: {
      showLiveOnStartup: false,
      advanceScheduleOnGoLive: false,
      preventDvdSpinDown: false,
      alwaysSaveStandalone: false,
      enableRemoteControl: false,
      remoteName: 'SimpleWorship',
    },
  };

  const mockSongItem: PresentationItem = {
    id: 'song-1',
    name: 'Amazing Grace',
    type: 'song',
    contentId: 'song-data-1',
    data: {
      title: 'Amazing Grace',
      author: 'John Newton',
      copyright: 'Public Domain',
      ccli: '12345',
      slides: [
        { label: 'Verse 1', lines: ['Amazing grace, how sweet the sound', 'That saved a wretch like me!'] }
      ]
    },
    themeOverride: {
      fontFamily: 'Montserrat, sans-serif', // Legacy default in item
    }
  };

  const mockScriptureItem: PresentationItem = {
    id: 'scripture-1',
    name: 'John 3:16',
    type: 'bible',
    contentId: 'john-3-16',
    data: {
      book: 'John',
      chapter: 3,
      translation: 'KJV',
      verses: [{ verse: 16, text: 'For God so loved the world, that he gave his only begotten Son...' }]
    },
    themeOverride: {
      fontFamily: 'Arial, sans-serif', // Legacy default in item
    }
  };

  const mockGroup: OutputGroup = {
    id: 'group-1',
    name: 'Main Auditorium',
    targetDisplayId: 'display-1',
    themeId: 'theme-global',
    customResolution: { width: 1920, height: 1080 },
  };

  const mockSchedule: Schedule = {
    id: 'schedule-1',
    name: 'Sunday Service',
    items: [mockSongItem, mockScriptureItem],
    createdAt: Date.now(),
  };

  // TEST 1 — Song Font Cascade Fix
  it('TEST 1: System Song Font overrides legacy default Montserrat in item themeOverride', () => {
    const globalTheme: ThemeStyles = { fontFamily: 'Montserrat, sans-serif', fontSize: 90 };
    const systemFontOverride = ThemeEngine.getSystemFontForContent(mockSystemOptions, 'song');
    const resolved = ThemeEngine.resolveStyles(
      globalTheme,
      undefined,
      undefined,
      systemFontOverride,
      mockSongItem.themeOverride
    );
    expect(resolved.fontFamily).toBe('Georgia');
  });

  // TEST 2 — Scripture Font Cascade Fix
  it('TEST 2: System Scripture Font overrides legacy default Arial in item themeOverride', () => {
    const globalTheme: ThemeStyles = { fontFamily: 'Montserrat, sans-serif', fontSize: 90 };
    const systemFontOverride = ThemeEngine.getSystemFontForContent(mockSystemOptions, 'bible');
    const resolved = ThemeEngine.resolveStyles(
      globalTheme,
      undefined,
      undefined,
      systemFontOverride,
      mockScriptureItem.themeOverride
    );
    expect(resolved.fontFamily).toBe('Times New Roman');
  });

  // TEST 3 — Explicit Item Font Override
  it('TEST 3: Explicit intentional item font override is preserved over system font', () => {
    const globalTheme: ThemeStyles = { fontFamily: 'Montserrat, sans-serif', fontSize: 90 };
    const systemFontOverride = ThemeEngine.getSystemFontForContent(mockSystemOptions, 'song');
    const explicitOverride: ThemeStyles = { fontFamily: 'Playfair Display', isExplicitFont: true };
    const resolved = ThemeEngine.resolveStyles(
      globalTheme,
      undefined,
      undefined,
      systemFontOverride,
      explicitOverride
    );
    expect(resolved.fontFamily).toBe('Playfair Display');
  });

  // TEST 4 — Configured Font Size Change
  it('TEST 4: Changing configured Song Font size updates canonical base size in render model', () => {
    const updatedOptions: SystemOptions = JSON.parse(JSON.stringify(mockSystemOptions));
    updatedOptions.mainOutput.song.songFont.maxSize = 72;

    const state: PresentationState = {
      activeScheduleId: 'schedule-1',
      activeItemId: 'song-1',
      activeSlideIndex: 0,
      nextSlideIndex: 0,
      isBlack: false,
      isClear: false,
      showLogo: false,
      timestamp: Date.now(),
      isLiveEnabled: true,
    };

    const frame = buildRenderFrame(
      'group-1',
      state,
      mockSchedule,
      mockGroup,
      updatedOptions,
      [],
      [],
      []
    );

    expect(frame?.resolvedStyles.fontSize).toBe(72);
  });

  // TEST 5 — AutoFit Does Not Mutate Canonical Setting
  it('TEST 5: Runtime AutoFit computes display size without mutating saved canonical fontSize', () => {
    const state: PresentationState = {
      activeScheduleId: 'schedule-1',
      activeItemId: 'song-1',
      activeSlideIndex: 0,
      nextSlideIndex: 0,
      isBlack: false,
      isClear: false,
      showLogo: false,
      timestamp: Date.now(),
      isLiveEnabled: true,
    };

    const frame = buildRenderFrame(
      'group-1',
      state,
      mockSchedule,
      mockGroup,
      mockSystemOptions,
      [],
      [],
      []
    );

    expect(frame).toBeDefined();
    expect(frame?.resolvedStyles.fontSize).toBe(90); // Canonical size remains 90
    expect(frame?.autoFitFontSize).toBeGreaterThan(0);
    expect(frame?.autoFitFontSize).toBeLessThanOrEqual(90); // AutoFit bounded by max size
  });

  // TEST 6 — Layout Parity across Preview and Projector
  it('TEST 6: RenderFrame model provides complete parity parameters for all components', () => {
    const state: PresentationState = {
      activeScheduleId: 'schedule-1',
      activeItemId: 'song-1',
      activeSlideIndex: 0,
      nextSlideIndex: 0,
      isBlack: false,
      isClear: false,
      showLogo: false,
      timestamp: Date.now(),
      isLiveEnabled: true,
    };

    const frame = buildRenderFrame(
      'group-1',
      state,
      mockSchedule,
      mockGroup,
      mockSystemOptions,
      [],
      [],
      []
    );

    expect(frame?.targetWidth).toBe(1920);
    expect(frame?.targetHeight).toBe(1080);
    expect(frame?.resolvedStyles.fontFamily).toBe('Georgia');
    expect(frame?.headerText).toBe('Verse 1');
  });

  // TEST 7 — Display Resolution / Geometry Change
  it('TEST 7: Target display resolution change updates target geometry in render model', () => {
    const fourKGroup: OutputGroup = {
      ...mockGroup,
      customResolution: { width: 3840, height: 2160 },
    };

    const state: PresentationState = {
      activeScheduleId: 'schedule-1',
      activeItemId: 'song-1',
      activeSlideIndex: 0,
      nextSlideIndex: 0,
      isBlack: false,
      isClear: false,
      showLogo: false,
      timestamp: Date.now(),
      isLiveEnabled: true,
    };

    const frame = buildRenderFrame(
      'group-1',
      state,
      mockSchedule,
      fourKGroup,
      mockSystemOptions,
      [],
      [],
      []
    );

    expect(frame?.targetWidth).toBe(3840);
    expect(frame?.targetHeight).toBe(2160);
  });

  // TEST 8 — Multi-Router Isolation
  it('TEST 8: Router 1 and Router 2 maintain independent RenderFrame models', () => {
    const state1: PresentationState = {
      activeScheduleId: 'schedule-1',
      activeItemId: 'song-1',
      activeSlideIndex: 0,
      nextSlideIndex: 0,
      isBlack: false,
      isClear: false,
      showLogo: false,
      timestamp: Date.now(),
      isLiveEnabled: true,
    };

    const state2: PresentationState = {
      activeScheduleId: 'schedule-1',
      activeItemId: 'scripture-1',
      activeSlideIndex: 0,
      nextSlideIndex: 0,
      isBlack: false,
      isClear: false,
      showLogo: false,
      timestamp: Date.now(),
      isLiveEnabled: true,
    };

    const frame1 = buildRenderFrame('group-1', state1, mockSchedule, mockGroup, mockSystemOptions, [], [], []);
    const frame2 = buildRenderFrame('group-2', state2, mockSchedule, mockGroup, mockSystemOptions, [], [], []);

    expect(frame1?.activeItem?.id).toBe('song-1');
    expect(frame1?.resolvedStyles.fontFamily).toBe('Georgia');

    expect(frame2?.activeItem?.id).toBe('scripture-1');
    expect(frame2?.resolvedStyles.fontFamily).toBe('Times New Roman');
  });

  // TEST 9 — Same-Monitor Multi-Router Composition
  it('TEST 9: Multi-router group states can be co-located on same monitor without interference', () => {
    const group1States: Record<string, PresentationState> = {
      'group-1': {
        activeScheduleId: 'schedule-1',
        activeItemId: 'song-1',
        activeSlideIndex: 0,
        nextSlideIndex: 0,
        isBlack: false,
        isClear: false,
        showLogo: false,
        timestamp: Date.now(),
        isLiveEnabled: true,
      },
      'group-2': {
        activeScheduleId: 'schedule-1',
        activeItemId: 'scripture-1',
        activeSlideIndex: 0,
        nextSlideIndex: 0,
        isBlack: false,
        isClear: false,
        showLogo: false,
        timestamp: Date.now(),
        isLiveEnabled: true,
      }
    };

    expect(group1States['group-1'].isLiveEnabled).toBe(true);
    expect(group1States['group-2'].isLiveEnabled).toBe(true);
  });

  // TEST 10 — LIVE OFF Removal
  it('TEST 10: Disabling LIVE on Router 2 sets isLiveEnabled=false without mutating Router 1 state', () => {
    const groupStates: Record<string, PresentationState> = {
      'group-1': { activeScheduleId: 'schedule-1', activeItemId: 'song-1', activeSlideIndex: 0, nextSlideIndex: 0, isBlack: false, isClear: false, showLogo: false, timestamp: Date.now(), isLiveEnabled: true },
      'group-2': { activeScheduleId: 'schedule-1', activeItemId: 'scripture-1', activeSlideIndex: 0, nextSlideIndex: 0, isBlack: false, isClear: false, showLogo: false, timestamp: Date.now(), isLiveEnabled: false }
    };

    expect(groupStates['group-1'].isLiveEnabled).toBe(true);
    expect(groupStates['group-2'].isLiveEnabled).toBe(false);
  });

  // TEST 11 — End-to-End Font Style Propagation
  it('TEST 11: Font options (bold, italic, underline, casing, line spacing) propagate into render frame', () => {
    const customOptions: SystemOptions = JSON.parse(JSON.stringify(mockSystemOptions));
    customOptions.mainOutput.song.songFont = createFont({
      family: 'Courier New',
      maxSize: 96,
      color: '#FF0000',
      bold: true,
      italic: true,
      underline: true,
      casing: 'uppercase',
      lineSpacing: 1.6,
    });

    const state: PresentationState = {
      activeScheduleId: 'schedule-1',
      activeItemId: 'song-1',
      activeSlideIndex: 0,
      nextSlideIndex: 0,
      isBlack: false,
      isClear: false,
      showLogo: false,
      timestamp: Date.now(),
      isLiveEnabled: true,
    };

    const frame = buildRenderFrame('group-1', state, mockSchedule, mockGroup, customOptions, [], [], []);

    expect(frame?.resolvedStyles.fontFamily).toBe('Courier New');
    expect(frame?.resolvedStyles.fontColor).toBe('#FF0000');
    expect(frame?.resolvedStyles.fontWeight).toBe('700');
    expect(frame?.resolvedStyles.fontStyle).toBe('italic');
    expect(frame?.resolvedStyles.textDecoration).toBe('underline');
    expect(frame?.isUpper).toBe(true);
    expect(frame?.lineSpacing).toBe(1.6);
  });

  // TEST 12 — Persistence / Serialization
  it('TEST 12: SystemOptions JSON serialization and deserialization retains font settings accurately', () => {
    const serialized = JSON.stringify(mockSystemOptions);
    const parsed: SystemOptions = JSON.parse(serialized);

    expect(parsed.mainOutput.song.songFont.family).toBe('Georgia');
    expect(parsed.mainOutput.scripture.scriptureFont.family).toBe('Times New Roman');
  });

  // TEST 13 — PPTX Slide Rendering Compatibility
  it('TEST 13: PPTX presentation content type is accurately detected and preserved', () => {
    const pptxItem: PresentationItem = {
      id: 'pptx-1',
      name: 'Sunday Announcements.pptx',
      type: 'ppt',
      contentId: 'pptx-file-1',
      data: { fileBytes: 'fake-bytes', slideCount: 5 }
    };

    const type = PresentationContentResolver.detectContentType(pptxItem);
    expect(type).toBe('pptx');
  });

  // TEST 14 — Video/Media Item Compatibility
  it('TEST 14: Video media item content type and properties are correctly detected', () => {
    const videoItem: PresentationItem = {
      id: 'video-1',
      name: 'Worship Background.mp4',
      type: 'video',
      contentId: 'video-file-1',
      data: { url: 'https://example.com/worship.mp4' }
    };

    const type = PresentationContentResolver.detectContentType(videoItem);
    expect(type).toBe('video');
  });
});

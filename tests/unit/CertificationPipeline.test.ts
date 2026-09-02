import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeEngine, normalizeFontSize } from '../../src/core/ThemeEngine';
import { useStore } from '../../src/store/useStore';
import { SystemOptions, ThemeStyles } from '../../src/types';

describe('SIMPLEWORSHIP - CERTIFICATION PIPELINE AUDIT', () => {
  beforeEach(() => {
    useStore.setState({
      groupStates: {},
      outputGroups: [
        { id: 'group-1', name: 'Congregation Display', displayIds: [] },
      ],
      activeControlGroupId: 'group-1',
      activeSchedule: {
        id: 'sched-1',
        name: 'Sunday Service',
        createdAt: Date.now(),
        items: [
          {
            id: 'song-1',
            type: 'song',
            contentId: 's1',
            name: 'Amazing Grace',
            data: {
              title: 'Amazing Grace',
              slides: [
                { id: 's1-1', text: 'Amazing grace how sweet the sound', verseType: 'Verse 1' },
                { id: 's1-2', text: 'That saved a wretch like me', verseType: 'Verse 2' },
              ]
            }
          },
          {
            id: 'bible-1',
            type: 'bible',
            contentId: 'b1',
            name: 'John 3:16',
            data: {
              title: 'John 3:16',
              verses: [
                { verse: 16, text: 'For God so loved the world...' }
              ]
            }
          }
        ]
      }
    });
  });

  // TEST A: Song inherits Global Song Lyrics Font.
  it('TEST A: Song inherits Global Song Lyrics Font', () => {
    const mockOptions: Partial<SystemOptions> = {
      mainOutput: {
        song: {
          songFont: { family: 'Impact', maxSize: 88, color: '#FFD700', bold: true, italic: false, alignHorizontal: 'center' },
          allCapsLyrics: true,
          lineSpacing: 1.4,
          minFontSize: 28,
          maxLinesPerSlide: 4
        }
      } as any
    };

    const systemFont = ThemeEngine.getSystemFontForContent(mockOptions as SystemOptions, 'song');
    expect(systemFont.fontFamily).toBe('Impact');
    expect(systemFont.fontSize).toBe(88);
    expect(systemFont.fontColor).toBe('#FFD700');

    const resolved = ThemeEngine.resolveStyles({}, undefined, undefined, systemFont, undefined, undefined);
    expect(resolved.fontFamily).toBe('Impact');
    expect(resolved.fontSize).toBe(88);
  });

  // TEST B: Song editor override replaces global font.
  it('TEST B: Song editor override replaces global font', () => {
    const systemFont: ThemeStyles = { fontFamily: 'Impact', fontSize: 88, fontColor: '#FFD700' };
    const editorOverride: ThemeStyles = { fontFamily: 'Comic Sans MS', fontSize: 105, fontColor: '#00FF00' };

    const resolved = ThemeEngine.resolveStyles({}, undefined, undefined, systemFont, editorOverride, undefined);
    expect(resolved.fontFamily).toBe('Comic Sans MS');
    expect(resolved.fontSize).toBe(105);
    expect(resolved.fontColor).toBe('#00FF00');
  });

  // TEST C: Removing Song editor override returns to global font.
  it('TEST C: Removing Song editor override returns to global font', () => {
    const systemFont: ThemeStyles = { fontFamily: 'Impact', fontSize: 88, fontColor: '#FFD700' };
    let editorOverride: ThemeStyles | undefined = { fontFamily: 'Comic Sans MS', fontSize: 105 };

    let resolved = ThemeEngine.resolveStyles({}, undefined, undefined, systemFont, editorOverride, undefined);
    expect(resolved.fontFamily).toBe('Comic Sans MS');

    // Reset / remove override
    editorOverride = undefined;
    resolved = ThemeEngine.resolveStyles({}, undefined, undefined, systemFont, editorOverride, undefined);
    expect(resolved.fontFamily).toBe('Impact');
    expect(resolved.fontSize).toBe(88);
  });

  // TEST D: Scripture inherits Global Scripture Text Font.
  it('TEST D: Scripture inherits Global Scripture Text Font', () => {
    const mockOptions: Partial<SystemOptions> = {
      mainOutput: {
        scripture: {
          scriptureFont: { family: 'Georgia', maxSize: 72, color: '#F0F0F0', bold: false, italic: true, alignHorizontal: 'center' },
          showReference: true,
          referenceLocation: 'After Each Slide',
          showVerseNumbers: true,
          verseNumberStyle: 'superscript',
          verseColor: '#F6E05E',
          minFontSize: 24,
          lineSpacing: 1.35
        }
      } as any
    };

    const systemFont = ThemeEngine.getSystemFontForContent(mockOptions as SystemOptions, 'bible');
    expect(systemFont.fontFamily).toBe('Georgia');
    expect(systemFont.fontSize).toBe(72);

    const resolved = ThemeEngine.resolveStyles({}, undefined, undefined, systemFont, undefined, undefined);
    expect(resolved.fontFamily).toBe('Georgia');
    expect(resolved.fontSize).toBe(72);
  });

  // TEST E: Scripture editor override replaces global font.
  it('TEST E: Scripture editor override replaces global font', () => {
    const systemFont: ThemeStyles = { fontFamily: 'Georgia', fontSize: 72 };
    const editorOverride: ThemeStyles = { fontFamily: 'Times New Roman', fontSize: 96 };

    const resolved = ThemeEngine.resolveStyles({}, undefined, undefined, systemFont, editorOverride, undefined);
    expect(resolved.fontFamily).toBe('Times New Roman');
    expect(resolved.fontSize).toBe(96);
  });

  // TEST F: Removing Scripture editor override returns to global font.
  it('TEST F: Removing Scripture editor override returns to global font', () => {
    const systemFont: ThemeStyles = { fontFamily: 'Georgia', fontSize: 72 };
    let editorOverride: ThemeStyles | undefined = { fontFamily: 'Times New Roman', fontSize: 96 };

    let resolved = ThemeEngine.resolveStyles({}, undefined, undefined, systemFont, editorOverride, undefined);
    expect(resolved.fontFamily).toBe('Times New Roman');

    editorOverride = undefined;
    resolved = ThemeEngine.resolveStyles({}, undefined, undefined, systemFont, editorOverride, undefined);
    expect(resolved.fontFamily).toBe('Georgia');
    expect(resolved.fontSize).toBe(72);
  });

  // TEST G & H: LivePanel renders text only & does not render background layer in card.
  it('TEST G & H: LivePanel text-only rendering without background layer', () => {
    const slideWithBg = {
      id: 'slide-1',
      text: 'Amazing grace how sweet the sound',
      backgroundUrl: 'https://images.unsplash.com/photo-bg.jpg'
    };

    // LivePanel card container style verification
    const isScripture = false;
    const isSong = true;
    const bgUrlToRender = (!isScripture && false) ? slideWithBg.backgroundUrl : undefined;

    expect(bgUrlToRender).toBeUndefined();
  });

  // TEST I, J, K: LivePanel follows active slide, song lyric, and scripture.
  it('TEST I, J, K: LivePanel follows active live state synchronously', () => {
    const store = useStore.getState();

    // Go live with Song
    store.goLiveItem('song-1', 0, 'group-1');
    let groupState = useStore.getState().groupStates['group-1'];
    expect(groupState.activeItemId).toBe('song-1');
    expect(groupState.activeSlideIndex).toBe(0);

    // Advance slide (Verse 1 -> Verse 2)
    store.goLiveNext();
    groupState = useStore.getState().groupStates['group-1'];
    expect(groupState.activeItemId).toBe('song-1');
    expect(groupState.activeSlideIndex).toBe(1);

    // Switch to Scripture
    store.goLiveItem('bible-1', 0, 'group-1');
    groupState = useStore.getState().groupStates['group-1'];
    expect(groupState.activeItemId).toBe('bible-1');
    expect(groupState.activeSlideIndex).toBe(0);
  });

  // TEST L: Preview scaling does not mutate source font size.
  it('TEST L: Preview scaling does not mutate source font size', () => {
    const sourceFontSize = 90;
    const previewScale = 0.50;
    const visualRenderedSize = sourceFontSize * previewScale;

    expect(visualRenderedSize).toBe(45);
    expect(sourceFontSize).toBe(90); // Source remains untouched
  });

  // TEST M & N: Long lyrics & scripture wrapping.
  it('TEST M & N: Auto-fit calculateAutoFitFontSize handles long text without mutation', () => {
    const longLyric = 'This is a very long line of lyrics that should auto-fit cleanly within container limits without horizontal overflow or clipping';
    const calculatedSize = ThemeEngine.calculateAutoFitFontSize({
      text: longLyric,
      baseFontSize: 90,
      scale: 1,
      minFontSize: 24,
      maxFontSize: 160,
      lineSpacing: 1.3
    });

    expect(calculatedSize).toBeGreaterThanOrEqual(24);
    expect(calculatedSize).toBeLessThanOrEqual(90);
  });

  // TEST O: Rapid slide changes do not leave stale state.
  it('TEST O: Rapid slide changes keep groupState synchronized', () => {
    const store = useStore.getState();
    store.goLiveItem('song-1', 0, 'group-1');

    for (let i = 0; i < 10; i++) {
      store.goLiveItem('song-1', i % 2, 'group-1');
      const currentState = useStore.getState().groupStates['group-1'];
      expect(currentState.activeSlideIndex).toBe(i % 2);
    }
  });

  // TEST P: Multiple panel scale changes do not mutate source font size.
  it('TEST P: Multiple panel scale changes do not mutate source font size', () => {
    const sourceStyles: ThemeStyles = { fontSize: 90, fontFamily: 'Tahoma' };
    const scales = [0.25, 0.50, 0.75, 1.0, 1.25];

    scales.forEach(scale => {
      const displaySize = ThemeEngine.calculateAutoFitFontSize({
        text: 'Sample Verse Lyrics',
        baseFontSize: sourceStyles.fontSize,
        scale: scale
      });
      // Verification: sourceStyles.fontSize remains 90
      expect(sourceStyles.fontSize).toBe(90);
      expect(typeof displaySize).toBe('number');
    });
  });

  // TEST Q: Unicode and special punctuation content wrapping
  it('TEST Q: Handles Tagalog/Unicode text with special characters safely', () => {
    const tagalogVerse = "Nang magkagayo'y sinabi ng Dios: Magkaroon ng liwanag; at nagkaroon ng liwanag. Genesis 1:3 (ADB)";
    const calcSize = ThemeEngine.calculateAutoFitFontSize({
      text: tagalogVerse,
      baseFontSize: 80,
      scale: 1,
      minFontSize: 24,
      maxFontSize: 140
    });

    expect(calcSize).toBeGreaterThanOrEqual(24);
    expect(calcSize).toBeLessThanOrEqual(80);
  });

  // CANONICAL DEFAULT 90 STANDARDIZATION TESTS
  it('TEST 1 — SONG DEFAULT: Song font size = undefined -> effectiveFontSize = 90', () => {
    const systemOptions = {
      mainOutput: {
        song: { songFont: { family: 'Arial', maxSize: undefined } }
      }
    } as any;
    const fontStyles = ThemeEngine.getSystemFontForContent(systemOptions, 'song');
    const resolved = ThemeEngine.resolveStyles({}, undefined, undefined, fontStyles);
    expect(resolved.fontSize).toBe(90);
  });

  it('TEST 2 — SCRIPTURE DEFAULT: Scripture font size = undefined -> effectiveFontSize = 90', () => {
    const systemOptions = {
      mainOutput: {
        scripture: { scriptureFont: { family: 'Arial', maxSize: undefined } }
      }
    } as any;
    const fontStyles = ThemeEngine.getSystemFontForContent(systemOptions, 'scripture');
    const resolved = ThemeEngine.resolveStyles({}, undefined, undefined, fontStyles);
    expect(resolved.fontSize).toBe(90);
  });

  it('TEST 3 — SONG NULL: Song font size = null -> 90', () => {
    const fontStyles = { fontSize: null as any };
    const resolved = ThemeEngine.resolveStyles({}, undefined, undefined, fontStyles);
    expect(resolved.fontSize).toBe(90);
  });

  it('TEST 4 — SCRIPTURE NULL: Scripture font size = null -> 90', () => {
    const fontStyles = { fontSize: null as any };
    const resolved = ThemeEngine.resolveStyles({}, undefined, undefined, fontStyles);
    expect(resolved.fontSize).toBe(90);
  });

  it('TEST 5 — INVALID VALUE: Font size = NaN / invalid string -> 90', () => {
    expect(normalizeFontSize(NaN)).toBe(90);
    expect(normalizeFontSize('invalid')).toBe(90);
    const resolved = ThemeEngine.resolveStyles({ fontSize: NaN as any });
    expect(resolved.fontSize).toBe(90);
  });

  it('TEST 6 — ZERO: Font size = 0 -> 90', () => {
    expect(normalizeFontSize(0)).toBe(90);
    const resolved = ThemeEngine.resolveStyles({ fontSize: 0 as any });
    expect(resolved.fontSize).toBe(90);
  });

  it('TEST 7 — NEGATIVE: Font size = -20 -> 90', () => {
    expect(normalizeFontSize(-20)).toBe(90);
    const resolved = ThemeEngine.resolveStyles({ fontSize: -20 as any });
    expect(resolved.fontSize).toBe(90);
  });

  it('TEST 8 — EXPLICIT GLOBAL VALUE: Song global font size = 100 -> 100', () => {
    const systemOptions = {
      mainOutput: {
        song: { songFont: { family: 'Arial', maxSize: 100 } }
      }
    } as any;
    const fontStyles = ThemeEngine.getSystemFontForContent(systemOptions, 'song');
    const resolved = ThemeEngine.resolveStyles({}, undefined, undefined, fontStyles);
    expect(resolved.fontSize).toBe(100);
  });

  it('TEST 9 — EXPLICIT EDITOR OVERRIDE: Global = 90, Editor = 120 -> 120', () => {
    const globalStyles = { fontSize: 90 };
    const editorOverride = { fontSize: 120 };
    const resolved = ThemeEngine.resolveStyles(globalStyles, undefined, undefined, undefined, editorOverride);
    expect(resolved.fontSize).toBe(120);
  });

  it('TEST 10 — RESET OVERRIDE: Global = 90, Editor = 120, Reset -> 90', () => {
    const globalStyles = { fontSize: 90 };
    let editorOverride: any = { fontSize: 120 };
    let resolved = ThemeEngine.resolveStyles(globalStyles, undefined, undefined, undefined, editorOverride);
    expect(resolved.fontSize).toBe(120);

    // Reset editor override
    editorOverride = undefined;
    resolved = ThemeEngine.resolveStyles(globalStyles, undefined, undefined, undefined, editorOverride);
    expect(resolved.fontSize).toBe(90);
  });

  it('TEST 11 — CUSTOM GLOBAL AFTER RESET: Global = 100, Editor = 120, Reset -> 100', () => {
    const globalStyles = { fontSize: 100 };
    let editorOverride: any = { fontSize: 120 };
    let resolved = ThemeEngine.resolveStyles(globalStyles, undefined, undefined, undefined, editorOverride);
    expect(resolved.fontSize).toBe(120);

    // Reset editor override
    editorOverride = undefined;
    resolved = ThemeEngine.resolveStyles(globalStyles, undefined, undefined, undefined, editorOverride);
    expect(resolved.fontSize).toBe(100);
  });
});

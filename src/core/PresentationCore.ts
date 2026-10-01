import { PresentationState, Schedule, PresentationItem, Slide, Song, ScriptureVerse, SystemOptions } from '../types';
import { defaultSongs } from '../db/seedData';
import { formatScriptureReference, formatScriptureText } from '../utils/scriptureFormatter';
import { PresentationContentResolver } from './PresentationContentResolver';
import { getCachedPptxSlides, getOrParsePptxSlides, cacheParsedPptxSlides } from '../utils/pptxParser';
import { PptxRenderCacheManager } from '../utils/pptxBackend';
import { pptxDeckSharedCache } from '../components/PptxRenderOverlay';

export class PresentationCore {
  private static presentationSlidesRegistry = new Map<string, any[]>();
  private static pendingSlideFetches = new Set<string>();

  public static registerPresentationSlides(idOrContentId: string, slides: any[]): void {
    if (!idOrContentId || !Array.isArray(slides) || slides.length === 0) return;
    const cleanId = idOrContentId.replace(/^(sched-item-|live-item-|pres-drag-)/, '');
    this.presentationSlidesRegistry.set(idOrContentId, slides);
    this.presentationSlidesRegistry.set(cleanId, slides);
    this.presentationSlidesRegistry.set(`pres-${cleanId}`, slides);
    this.presentationSlidesRegistry.set(`asset-${cleanId}`, slides);
    try {
      cacheParsedPptxSlides(idOrContentId, slides);
      cacheParsedPptxSlides(cleanId, slides);
    } catch {}
  }

  public static getRegisteredPresentationSlides(idOrContentId: string): any[] | undefined {
    if (!idOrContentId) return undefined;
    const cleanId = idOrContentId.replace(/^(sched-item-|live-item-|pres-drag-)/, '');
    return (
      this.presentationSlidesRegistry.get(idOrContentId) ||
      this.presentationSlidesRegistry.get(cleanId) ||
      this.presentationSlidesRegistry.get(`pres-${cleanId}`) ||
      this.presentationSlidesRegistry.get(`asset-${cleanId}`) ||
      this.presentationSlidesRegistry.get(idOrContentId.replace(/^asset-/, '')) ||
      this.presentationSlidesRegistry.get(idOrContentId.replace(/^pres-/, ''))
    );
  }

  private static triggerBackgroundPresentationLoad(contentIdOrId: string): void {
    if (!contentIdOrId || this.pendingSlideFetches.has(contentIdOrId)) return;
    this.pendingSlideFetches.add(contentIdOrId);

    setTimeout(async () => {
      try {
        const { getPresentationById, getPptxFileBytes } = await import('../db/presentations');
        const asset = await getPresentationById(contentIdOrId);
        if (asset?.data?.slides && Array.isArray(asset.data.slides) && asset.data.slides.length > 0) {
          PresentationCore.registerPresentationSlides(contentIdOrId, asset.data.slides);
          if (asset.id) PresentationCore.registerPresentationSlides(asset.id, asset.data.slides);
          window.dispatchEvent(new CustomEvent('simpleworship:slides-loaded', { detail: { contentId: contentIdOrId } }));
          return;
        }

        const bytes = await getPptxFileBytes(contentIdOrId);
        if (bytes) {
          const parsed = await getOrParsePptxSlides(contentIdOrId, bytes);
          if (parsed && parsed.length > 0) {
            PresentationCore.registerPresentationSlides(contentIdOrId, parsed);
            window.dispatchEvent(new CustomEvent('simpleworship:slides-loaded', { detail: { contentId: contentIdOrId } }));
          }
        }
      } catch (err) {
        console.warn('[PresentationCore] Background presentation load warning:', err);
      } finally {
        PresentationCore.pendingSlideFetches.delete(contentIdOrId);
      }
    }, 10);
  }
  static getActiveContent(
    schedule: Schedule | null, 
    state: PresentationState | null | undefined,
    directItemFallback?: PresentationItem | null
  ): PresentationItem | null {
    if (!state) return null;

    // 1. If activeItemId matches an item in the active schedule, return it
    if (state.activeItemId && schedule && schedule.items && schedule.items.length > 0) {
      const found = schedule.items.find(i => i.id === state.activeItemId);
      if (found) return found;
    }

    // 2. Return direct explicit live item attached to presentation state (persists across navigation and slide clicks)
    if (state.directLiveItem) {
      return state.directLiveItem;
    }

    // 3. Return direct fallback item supplied as parameter
    if (directItemFallback) {
      return directItemFallback;
    }

    // 4. Fallback: If activeItemId is set, check default songs library
    if (state.activeItemId) {
      const matched = defaultSongs.find(s => s.id === state.activeItemId);
      if (matched) {
        return {
          id: matched.id,
          type: 'song',
          name: matched.title,
          contentId: matched.id,
          notes: matched.author || '',
          isExpanded: false,
          customBackgroundUrl: matched.defaultBackgroundUrl,
        };
      }
    }

    return null;
  }

  private static slideCache = new Map<string, { cacheKey: string; slides: Slide[] }>();

  public static getSlideCacheSize(): number {
    return PresentationCore.slideCache.size;
  }

  public static clearSlideCache(): number {
    const count = PresentationCore.slideCache.size;
    PresentationCore.slideCache.clear();
    return count;
  }

  /**
   * Intelligently splits a song section (verse, chorus, bridge, etc.) into separate slides
   * if it exceeds maxLinesPerSlide or character capacity, preventing text cramping/overflow ("hindi nag sasagat").
   */
  public static splitSongSection(
    rawTitle: string,
    rawText: string,
    slideIdPrefix: string,
    backgroundUrl: string | undefined,
    songOpts?: SystemOptions['mainOutput']['song']
  ): Slide[] {
    const breakOnNewVerse = songOpts?.breakOnNewVerse ?? true;
    const automaticallyFlow = songOpts?.automaticallyFlow ?? true;
    const maxLines = Math.max(1, songOpts?.maxLinesPerSlide ?? 4);
    const splitLongSections = songOpts?.splitLongSections ?? true;
    const splitLabelStyle = songOpts?.splitLabelStyle ?? 'part';

    // If it's a Title slide, never split it by stanzas regardless of settings
    const isTitleSlide = rawTitle === 'Title';

    // If breakOnNewVerse is true and the section has multiple stanzas separated by blank lines
    // e.g. "Line 1\nLine 2\n\nLine 3\nLine 4"
    const stanzas = (breakOnNewVerse && !isTitleSlide)
      ? (rawText || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean)
      : [(rawText || '').trim()];

    const resultSlides: Slide[] = [];

    stanzas.forEach((stanzaText, stanzaIdx) => {
      let stanzaTitle = rawTitle || 'Verse 1';
      if (stanzas.length > 1) {
        const numMatch = (rawTitle || '').match(/^(.*?)\s*(\d+)$/);
        if (numMatch) {
          const baseName = numMatch[1].trim();
          const startNum = parseInt(numMatch[2], 10);
          stanzaTitle = `${baseName} ${startNum + stanzaIdx}`;
        } else {
          stanzaTitle = `${rawTitle || 'Verse'} ${stanzaIdx + 1}`;
        }
      }

      // Split stanza into lines
      const rawLines = stanzaText.split('\n').map(l => l.trim()).filter(Boolean);

      if (!automaticallyFlow || rawLines.length <= maxLines) {
        // Keep stanza intact on a single slide; Dynamic Auto-Fit Font Scaling scales to fit
        resultSlides.push({
          id: `${slideIdPrefix}-${resultSlides.length}`,
          title: stanzaTitle,
          text: rawLines.join('\n'),
          backgroundUrl,
          isVideo: PresentationContentResolver.isVideoUrl(backgroundUrl) || undefined,
        });
        return;
      }

      // If lines genuinely exceed maxLines and automaticallyFlow is enabled,
      // partition lines evenly across slides so text stays legible without cramping
      const totalLines = rawLines.length;
      const numSlides = Math.ceil(totalLines / maxLines);
      const baseSize = Math.floor(totalLines / numSlides);
      const remainder = totalLines % numSlides;

      const lineChunks: string[][] = [];
      let startIndex = 0;

      for (let i = 0; i < numSlides; i++) {
        const chunkSize = baseSize + (i < remainder ? 1 : 0);
        lineChunks.push(rawLines.slice(startIndex, startIndex + chunkSize));
        startIndex += chunkSize;
      }

      // Generate slides from balanced chunks
      lineChunks.forEach((chunk, chunkIdx) => {
        let slideTitle = stanzaTitle;
        if (splitLongSections && lineChunks.length > 1) {
          if (splitLabelStyle === 'alpha') {
            const letter = String.fromCharCode(97 + chunkIdx); // a, b, c...
            slideTitle = `${stanzaTitle}${letter}`;
          } else if (splitLabelStyle === 'numeric') {
            slideTitle = `${stanzaTitle}.${chunkIdx + 1}`;
          } else if (splitLabelStyle === 'same') {
            slideTitle = stanzaTitle;
          } else {
            // 'part' default
            slideTitle = `${stanzaTitle} (Part ${chunkIdx + 1})`;
          }
        }

        resultSlides.push({
          id: `${slideIdPrefix}-${resultSlides.length}`,
          title: slideTitle,
          text: chunk.join('\n'),
          backgroundUrl,
          isVideo: PresentationContentResolver.isVideoUrl(backgroundUrl) || undefined,
        });
      });
    });

    return resultSlides.length > 0
      ? resultSlides
      : [{
          id: `${slideIdPrefix}-0`,
          title: rawTitle || 'Verse 1',
          text: rawText,
          backgroundUrl,
          isVideo: PresentationContentResolver.isVideoUrl(backgroundUrl) || undefined,
        }];
  }

  // Generates slides for a presentation item
  static generateSlides(
    item: PresentationItem, 
    availableSongs: Song[] = defaultSongs,
    systemOptions?: SystemOptions
  ): Slide[] {
    if (!item) return [];

    const so = systemOptions?.mainOutput?.song;
    const sc = systemOptions?.mainOutput?.scripture;
    const songOptsSig = so ? `${so.maxLinesPerSlide}_${so.breakOnNewVerse}_${so.splitLongSections}_${so.splitLabelStyle}_${so.showVerseChorusLabel}_${so.labelLocation}_${so.backdropAssetUrl || ''}` : '';
    const scriptureOptsSig = sc ? `${sc.breakOnNewVerse}_${sc.showVerseNumbers}_${sc.backdropAssetUrl || ''}` : '';
    const cacheKey = `${item.id}_${item.contentId || ''}_${item.customBackgroundUrl || ''}_${item.data?.verses?.length || 0}_${item.data?.sections?.length || 0}_${item.data?.slides?.length || 0}_${availableSongs.length}_${songOptsSig}_${scriptureOptsSig}`;
    const cached = PresentationCore.slideCache.get(item.id);
    if (cached && cached.cacheKey === cacheKey) {
      return cached.slides;
    }

    let generated: Slide[] = [];

    if (item.type === 'song') {
      const songOpts = systemOptions?.mainOutput?.song;
      const matchedSong = availableSongs.find(s => s.id === item.contentId || s.id === item.data?.songId || s.title?.toLowerCase() === item.name?.toLowerCase());
      const effectiveSongBg = item.customBackgroundUrl || songOpts?.backdropAssetUrl || matchedSong?.defaultBackgroundUrl;

      // Check if inline data exists
      if (item.data && item.data.sections && item.data.sections.length > 0) {
        generated = item.data.sections.flatMap((sec: any, idx: number) =>
          PresentationCore.splitSongSection(
            sec.name || sec.title || `Verse ${idx + 1}`,
            sec.text || sec.lyrics || sec.content || '',
            sec.id || `slide-${idx}`,
            effectiveSongBg,
            songOpts
          )
        );
      } else {
        // Check if we can find song in library
        if (matchedSong) {
          if (matchedSong.sections && matchedSong.sections.length > 0) {
            generated = matchedSong.sections.flatMap((sec: any, idx) =>
              PresentationCore.splitSongSection(
                sec.name || sec.title || `Verse ${idx + 1}`,
                sec.text || sec.lyrics || sec.content || '',
                sec.id || `s-${idx}`,
                effectiveSongBg,
                songOpts
              )
            );
          } else if (matchedSong.lyrics) {
            const blocks = matchedSong.lyrics.split(/\n\s*\n/).filter(b => b.trim().length > 0);
            generated = blocks.flatMap((block, idx) => {
              const match = block.match(/^\[(.*?)\]\n?([\s\S]*)$/);
              const title = match ? match[1] : `Verse ${idx + 1}`;
              const text = match ? match[2].trim() : block.trim();
              return PresentationCore.splitSongSection(
                title,
                text,
                `s-${idx}`,
                effectiveSongBg,
                songOpts
              );
            });
          } else {
            generated = PresentationCore.splitSongSection(
              'Verse 1',
              item.name,
              's1',
              effectiveSongBg,
              songOpts
            );
          }
        } else {
          generated = PresentationCore.splitSongSection(
            'Verse 1',
            item.name,
            's1',
            effectiveSongBg,
            songOpts
          );
        }
      }

      // Add a title slide automatically if it doesn't exist
      const hasTitleSlide = generated.length > 0 && generated[0].title === 'Title';
      if (!hasTitleSlide) {
        const songTitle = matchedSong?.title || item.name || 'Song';
        const titleSlide = PresentationCore.splitSongSection(
          'Title',
          `${songTitle}`,
          'title-slide',
          effectiveSongBg,
          songOpts
        )[0];
        generated = [titleSlide, ...generated];
      }
    } else if (item.type === 'bible') {
      const verses: ScriptureVerse[] = (item.data && Array.isArray(item.data.verses)) ? item.data.verses : [];
      const scriptureOpts = systemOptions?.mainOutput?.scripture;

      if (verses.length > 0) {
        // Sort verses to ensure proper sequential ordering
        const sortedVerses = [...verses].sort((a, b) => {
          if (a.book !== b.book) return a.book.localeCompare(b.book);
          if (a.chapter !== b.chapter) return a.chapter - b.chapter;
          return a.verse - b.verse;
        });

        const breakOnNewVerse = scriptureOpts?.breakOnNewVerse ?? false;
        const effectiveScriptureBg = item.customBackgroundUrl || scriptureOpts?.backdropAssetUrl;
        const slides: Slide[] = [];

        if (breakOnNewVerse) {
          // Break on new verse: each verse on its own slide
          sortedVerses.forEach((v, idx) => {
            const title = formatScriptureReference({
              book: v.book,
              chapter: v.chapter,
              verses: [v],
              translation: v.translation,
              options: scriptureOpts
            }) || `${v.book} ${v.chapter}:${v.verse}`;

            const text = formatScriptureText([{ verse: v.verse, text: v.text }], scriptureOpts);

            slides.push({
              id: `b-slide-${idx}`,
              title,
              text,
              backgroundUrl: effectiveScriptureBg,
              isVideo: PresentationContentResolver.isVideoUrl(effectiveScriptureBg) || undefined,
              verses: [{ verse: v.verse, text: v.text }],
            });
          });
        } else {
          // EasyWorship standard: comfortable slide character threshold (~260 to 300 chars)
          // Groups short consecutive verses onto the same slide, or creates extra slide templates if text exceeds capacity
          const automaticallyFlow = scriptureOpts?.automaticallyFlow ?? true;
          const MAX_SLIDE_CHARS = automaticallyFlow ? 270 : Infinity;

          let currentGroup: ScriptureVerse[] = [];
          let currentLen = 0;

          const flushGroup = () => {
            if (currentGroup.length === 0) return;
            const first = currentGroup[0];

            const title = formatScriptureReference({
              book: first.book,
              chapter: first.chapter,
              verses: currentGroup,
              translation: first.translation,
              options: scriptureOpts
            }) || item.name || `${first.book} ${first.chapter}`;

            const text = formatScriptureText(
              currentGroup.map(v => ({ verse: v.verse, text: v.text })),
              scriptureOpts
            );

            slides.push({
              id: `b-slide-${slides.length}`,
              title,
              text,
              backgroundUrl: effectiveScriptureBg,
              isVideo: PresentationContentResolver.isVideoUrl(effectiveScriptureBg) || undefined,
              verses: currentGroup.map(v => ({ verse: v.verse, text: v.text })),
            });

            currentGroup = [];
            currentLen = 0;
          };

          for (const v of sortedVerses) {
            const verseTextLen = (v.text || '').length;

            // If adding this verse would overflow the template, flush current group and create a new slide template
            if (currentGroup.length > 0 && (currentLen + verseTextLen > MAX_SLIDE_CHARS)) {
              flushGroup();
            }

            // If an individual verse is extremely long (> 380 chars), break it cleanly across slides
            if (automaticallyFlow && verseTextLen > 380 && currentGroup.length === 0) {
              const sentences = v.text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [v.text];
              let subText = '';
              let part = 1;
              for (const s of sentences) {
                if (subText.length + s.length > MAX_SLIDE_CHARS && subText.length > 0) {
                  const title = formatScriptureReference({
                    book: v.book,
                    chapter: v.chapter,
                    verses: [v],
                    translation: v.translation,
                    options: scriptureOpts
                  });
                  slides.push({
                    id: `b-slide-${slides.length}`,
                    title: `${title} (Part ${part})`,
                    text: formatScriptureText([{ verse: v.verse, text: subText.trim() }], scriptureOpts),
                    backgroundUrl: item.customBackgroundUrl,
                    verses: [{ verse: v.verse, text: subText.trim() }],
                  });
                  part++;
                  subText = s;
                } else {
                  subText += (subText ? ' ' : '') + s.trim();
                }
              }
              if (subText.trim()) {
                const title = formatScriptureReference({
                  book: v.book,
                  chapter: v.chapter,
                  verses: [v],
                  translation: v.translation,
                  options: scriptureOpts
                });
                slides.push({
                  id: `b-slide-${slides.length}`,
                  title: part > 1 ? `${title} (Part ${part})` : title,
                  text: formatScriptureText([{ verse: v.verse, text: subText.trim() }], scriptureOpts),
                  backgroundUrl: item.customBackgroundUrl,
                  verses: [{ verse: v.verse, text: subText.trim() }],
                });
              }
              continue;
            }

            currentGroup.push(v);
            currentLen += verseTextLen;
          }

          flushGroup();
        }

        generated = slides;
      } else if (item.data && item.data.text) {
        // Fallback if item only has raw text
        const parts = item.data.text.split('\n\n').filter((p: string) => p.trim().length > 0);
        if (parts.length > 1) {
          generated = parts.map((part: string, i: number) => ({
            id: `b-slide-${i}`,
            title: `${item.name} (${i + 1}/${parts.length})`,
            text: part.trim(),
            backgroundUrl: item.customBackgroundUrl,
          }));
        } else {
          generated = [
            { id: 'b1', title: item.data.reference || item.name, text: item.data.text, backgroundUrl: item.customBackgroundUrl }
          ];
        }
      } else {
        generated = [
          { id: 'b1', title: item.name, text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.', backgroundUrl: item.customBackgroundUrl }
        ];
      }
    } else if (item.type === 'ppt' || item.type === 'presentation' || (item.type as any) === 'pptx') {
      const contentId = item.contentId || item.id;
      
      // 1. Direct item.data.slides
      let rawSlides = (item.data && Array.isArray(item.data.slides) && item.data.slides.length > 0)
        ? item.data.slides
        : undefined;

      // 2. In-memory registered presentation slides
      if (!rawSlides && contentId) {
        rawSlides = PresentationCore.getRegisteredPresentationSlides(contentId);
      }

      // 3. Parser resolved cache
      if (!rawSlides && contentId) {
        rawSlides = getCachedPptxSlides(contentId);
      }

      // 4. PowerPoint / Native backend canonical session
      if (!rawSlides && contentId) {
        const canonicalSession = PptxRenderCacheManager.getCanonicalSession(contentId);
        if (canonicalSession?.slides && canonicalSession.slides.length > 0) {
          rawSlides = canonicalSession.slides;
        }
      }

      // 5. Shared deck cache from PPTX React Viewer
      if (!rawSlides && contentId) {
        const sharedDeck = pptxDeckSharedCache.get(contentId);
        if (sharedDeck?.slides && sharedDeck.slides.length > 0) {
          rawSlides = sharedDeck.slides;
        }
      }

      if (rawSlides && Array.isArray(rawSlides) && rawSlides.length > 0) {
        PresentationCore.registerPresentationSlides(contentId, rawSlides);
        generated = rawSlides.map((s: any, idx: number) => ({
          id: s.id || `p-slide-${idx}`,
          title: s.title || `Slide ${idx + 1}`,
          text: s.text || '',
          subtitle: s.subtitle,
          bullets: Array.isArray(s.bullets) && s.bullets.length > 0 ? s.bullets : (s.text ? s.text.split('\n').filter((l: string) => l.trim().length > 0) : undefined),
          backgroundUrl: s.backgroundUrl || item.customBackgroundUrl,
          backgroundColor: s.backgroundColor,
          fontColor: s.fontColor,
          fontFamily: s.fontFamily,
          fontSize: s.fontSize,
          textAlign: s.textAlign,
          titleColor: s.titleColor,
          titleFontFamily: s.titleFontFamily,
          titleFontSize: s.titleFontSize,
          accentColor: s.accentColor,
          headerBarColor: s.headerBarColor,
          isTitleSlide: s.isTitleSlide !== undefined ? s.isTitleSlide : (idx === 0),
          elements: s.elements,
          objects: s.objects,
          aspectRatio: s.aspectRatio,
          aspectRatioLabel: s.aspectRatioLabel,
          widthEmu: s.widthEmu,
          heightEmu: s.heightEmu,
          transition: s.transition,
          nativeAnimations: s.nativeAnimations,
          animations: s.animations,
          animationSteps: s.animationSteps,
          notes: s.notes,
          isPptx: true,
        }));
      } else {
        // Trigger background hydration from IndexedDB if not cached yet
        if (contentId) {
          PresentationCore.triggerBackgroundPresentationLoad(contentId);
        }

        // Return a clean authentic template slide for the presentation
        generated = [
          {
            id: `${item.id || 'pres'}-slide-1`,
            title: item.name || 'PowerPoint Presentation',
            text: item.notes || 'Presentation Slide',
            backgroundUrl: item.customBackgroundUrl,
            isTitleSlide: true,
            isPptx: true,
          }
        ];
      }
    } else if (
      item.type === 'audio' ||
      item.data?.isAudio === true ||
      item.data?.type === 'audio' ||
      (typeof item.data?.type === 'string' && item.data.type.startsWith('audio/')) ||
      PresentationContentResolver.isAudioUrl(item.data?.url || item.customBackgroundUrl) ||
      PresentationContentResolver.isAudioName(item.name || '')
    ) {
      generated = [
        {
          id: 'a1',
          title: item.name || 'Audio Track',
          text: '',
          backgroundUrl: item.customBackgroundUrl || (item.data && item.data.url) || '',
          isAudio: true,
          isVideo: false,
        }
      ];
    } else if (
      item.type === 'video' ||
      item.data?.isVideo === true ||
      item.data?.type === 'video' ||
      item.data?.type === 'motion' ||
      (typeof item.data?.type === 'string' && item.data.type.startsWith('video/')) ||
      PresentationContentResolver.isVideoUrl(item.data?.url || item.customBackgroundUrl) ||
      PresentationContentResolver.isVideoName(item.name || '')
    ) {
      generated = [
        {
          id: 'v1',
          title: item.name || 'Video Track',
          text: '',
          backgroundUrl: item.customBackgroundUrl || (item.data && item.data.url) || '',
          isVideo: true,
          isAudio: false,
        }
      ];
    } else if (item.type === 'media' || item.type === 'image') {
      generated = [
        {
          id: 'm1',
          title: item.name || 'Image Asset',
          text: '',
          backgroundUrl: item.customBackgroundUrl || (item.data && item.data.url) || '',
          isVideo: false,
          isAudio: false,
        }
      ];
    } else if (item.type === 'camera') {
      generated = [
        {
          id: 'c1',
          title: item.name || 'Camera Live',
          text: '',
          backgroundUrl: '',
        }
      ];
    } else if (item.type === 'announcement' || item.type === 'countdown') {
      generated = [
        {
          id: 'a1',
          title: item.name,
          text: item.data?.text || 'Welcome to our service! Please take your seats.',
          backgroundUrl: item.customBackgroundUrl,
        }
      ];
    }

    // Fallback: If an item exists but no slides were generated, produce a slide so it never appears blank
    if (generated.length === 0 && item) {
      generated = [
        {
          id: `item-slide-1`,
          title: item.name || 'Live Content',
          text: (item.data && typeof item.data.text === 'string') ? item.data.text : '',
          backgroundUrl: item.customBackgroundUrl || (item.data && item.data.url) || '',
        }
      ];
    }

    let finalSlides = generated;
    // Apply specific slide backgrounds overriding defaults
    if (item.data && (item.data.slideBackgrounds || item.data.slideMedia) && generated.length > 0) {
      finalSlides = generated.map((slide, idx) => {
        const slideMedia = item.data.slideMedia?.[idx];
        const slideBg = item.data.slideBackgrounds?.[idx];
        
        if (slideMedia) {
          return { ...slide, backgroundUrl: slideMedia.url, isVideo: slideMedia.isVideo };
        }
        if (slideBg) {
          return { ...slide, backgroundUrl: slideBg };
        }
        return slide;
      });
    }

    // LRU eviction cap: prevent unbounded memory consumption during marathon worship services
    if (PresentationCore.slideCache.size >= 250) {
      const oldestKey = PresentationCore.slideCache.keys().next().value;
      if (oldestKey) PresentationCore.slideCache.delete(oldestKey);
    }

    PresentationCore.slideCache.set(item.id, { cacheKey, slides: finalSlides });
    return finalSlides;
  }
}

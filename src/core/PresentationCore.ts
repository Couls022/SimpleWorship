import { PresentationState, Schedule, PresentationItem, Slide, Song, ScriptureVerse, SystemOptions } from '../types';
import { defaultSongs } from '../db/seedData';
import { formatScriptureReference, formatScriptureText } from '../utils/scriptureFormatter';
import { PresentationContentResolver } from './PresentationContentResolver';

export class PresentationCore {
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

  // Generates slides for a presentation item
  static generateSlides(
    item: PresentationItem, 
    availableSongs: Song[] = defaultSongs,
    systemOptions?: SystemOptions
  ): Slide[] {
    if (!item) return [];

    const songOptsStr = JSON.stringify(systemOptions?.mainOutput?.song || {});
    const scriptureOptsStr = JSON.stringify(systemOptions?.mainOutput?.scripture || {});
    const cacheKey = `${item.id}_${item.contentId || ''}_${item.customBackgroundUrl || ''}_${item.data?.verses?.length || 0}_${item.data?.sections?.length || 0}_${item.data?.slides?.length || 0}_${availableSongs.length}_${songOptsStr}_${scriptureOptsStr}`;
    const cached = PresentationCore.slideCache.get(item.id);
    if (cached && cached.cacheKey === cacheKey) {
      return cached.slides;
    }

    let generated: Slide[] = [];

    if (item.type === 'song') {
      // Check if inline data exists
      if (item.data && item.data.sections && item.data.sections.length > 0) {
        generated = item.data.sections.map((sec: any, idx: number) => ({
          id: sec.id || `slide-${idx}`,
          title: sec.name,
          text: sec.text,
          backgroundUrl: item.customBackgroundUrl,
        }));
      } else {
        // Check if we can find song in library
        const matchedSong = availableSongs.find(s => s.id === item.contentId || s.title.toLowerCase() === item.name.toLowerCase());
        if (matchedSong) {
          if (matchedSong.sections && matchedSong.sections.length > 0) {
            generated = matchedSong.sections.map((sec, idx) => ({
              id: sec.id || `s-${idx}`,
              title: sec.name,
              text: sec.text,
              backgroundUrl: item.customBackgroundUrl || matchedSong.defaultBackgroundUrl,
            }));
          } else if (matchedSong.lyrics) {
            const blocks = matchedSong.lyrics.split(/\n\s*\n/).filter(b => b.trim().length > 0);
            generated = blocks.map((block, idx) => {
              const match = block.match(/^\[(.*?)\]\n?([\s\S]*)$/);
              if (match) {
                return {
                  id: `s-${idx}`,
                  title: match[1],
                  text: match[2].trim(),
                  backgroundUrl: item.customBackgroundUrl || matchedSong.defaultBackgroundUrl,
                };
              }
              return {
                id: `s-${idx}`,
                title: `Verse ${idx + 1}`,
                text: block.trim(),
                backgroundUrl: item.customBackgroundUrl || matchedSong.defaultBackgroundUrl,
              };
            });
          } else {
            generated = [
              { id: 's1', title: 'Verse 1', text: item.name, backgroundUrl: item.customBackgroundUrl }
            ];
          }
        } else {
          generated = [
            { id: 's1', title: 'Verse 1', text: item.name, backgroundUrl: item.customBackgroundUrl }
          ];
        }
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
              backgroundUrl: item.customBackgroundUrl,
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
              backgroundUrl: item.customBackgroundUrl,
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
    } else if (item.type === 'ppt' || item.type === 'presentation') {
      if (item.data && Array.isArray(item.data.slides) && item.data.slides.length > 0) {
        generated = item.data.slides.map((s: any, idx: number) => ({
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
          isTitleSlide: s.isTitleSlide,
          elements: s.elements,
          objects: s.objects,
          aspectRatio: s.aspectRatio,
          aspectRatioLabel: s.aspectRatioLabel,
          widthEmu: s.widthEmu,
          heightEmu: s.heightEmu,
          transition: s.transition,
        }));
      } else {
        generated = [
          { id: 'p1', title: 'Slide 1', text: item.name, backgroundUrl: item.customBackgroundUrl },
          { id: 'p2', title: 'Slide 2', text: 'Key Scripture Points', backgroundUrl: item.customBackgroundUrl },
          { id: 'p3', title: 'Slide 3', text: 'Closing Prayer & Blessing', backgroundUrl: item.customBackgroundUrl }
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

    PresentationCore.slideCache.set(item.id, { cacheKey, slides: finalSlides });
    return finalSlides;
  }
}

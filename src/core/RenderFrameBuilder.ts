import { PresentationState, Schedule, OutputGroup, SystemOptions, RenderFrame, PresentationItem, Slide } from '../types';
import { PresentationCore } from './PresentationCore';
import { ThemeEngine } from './ThemeEngine';
import { matchSlideLabel } from '../utils/slideLabelHelper';

export function resolveGroupResolution(
  group: OutputGroup | undefined,
  systemOptions: SystemOptions | undefined,
  availableDisplays?: any[]
): { width: number; height: number; aspectRatio: number; aspectLabel: string; margins: { left: number; top: number; right: number; bottom: number } } {
  const defaultMargins = { left: 0, top: 0, right: 0, bottom: 0 };
  
  if (group?.customResolution && group.customResolution.width > 0 && group.customResolution.height > 0) {
    const w = group.customResolution.width;
    const h = group.customResolution.height;
    const ratio = w / h;
    const label = Math.abs(ratio - 16 / 9) < 0.05 ? '16:9' : Math.abs(ratio - 4 / 3) < 0.05 ? '4:3' : `${w}×${h}`;
    return { width: w, height: h, aspectRatio: ratio, aspectLabel: label, margins: defaultMargins };
  }

  const defaultRes = { width: 1920, height: 1080, aspectRatio: 16 / 9, aspectLabel: '16:9', margins: defaultMargins };
  if (!systemOptions) return defaultRes;

  let physicalWidth = systemOptions?.mainOutput?.general?.position?.width || 1920;
  let physicalHeight = systemOptions?.mainOutput?.general?.position?.height || 1080;
  let baseMargins = {
    left: systemOptions.mainOutput?.general?.margins?.left || 0,
    top: systemOptions.mainOutput?.general?.margins?.top || 0,
    right: systemOptions.mainOutput?.general?.margins?.right || 0,
    bottom: systemOptions.mainOutput?.general?.margins?.bottom || 0,
  };

  if (group?.id === 'group-alternate' || group?.role === 'lobby') {
    if (systemOptions.alternateOutput?.position) {
      physicalWidth = systemOptions.alternateOutput.position.width || 1920;
      physicalHeight = systemOptions.alternateOutput.position.height || 1080;
    }
    if (systemOptions.alternateOutput?.margins) {
      baseMargins = { ...systemOptions.alternateOutput.margins };
    }
  } else if (group?.id === 'group-stage' || group?.role === 'confidence') {
    if (systemOptions.foldback?.position) {
      physicalWidth = systemOptions.foldback.position.width || 1920;
      physicalHeight = systemOptions.foldback.position.height || 1080;
    }
    if (systemOptions.foldback?.margins) {
      baseMargins = { ...systemOptions.foldback.margins };
    }
  }

  if (availableDisplays && availableDisplays.length > 0 && group?.targetDisplayId && group.targetDisplayId !== 'window') {
    const d = availableDisplays.find(x => x.id?.toString() === group.targetDisplayId || x.label === group.targetDisplayId || x.name === group.targetDisplayId);
    if (d?.bounds) {
      physicalWidth = d.bounds.width;
      physicalHeight = d.bounds.height;
    }
  }

  const ratio = physicalWidth / physicalHeight;
  const label = Math.abs(ratio - 16 / 9) < 0.05 ? '16:9' : Math.abs(ratio - 4 / 3) < 0.05 ? '4:3' : `${physicalWidth}×${physicalHeight}`;

  return { width: physicalWidth, height: physicalHeight, aspectRatio: ratio, aspectLabel: label, margins: baseMargins };
}

const frameCache = new Map<string, { key: string; frame: RenderFrame }>();
const MAX_FRAME_CACHE_SIZE = 64;

export function buildRenderFrame(
  groupId: string,
  state: PresentationState,
  schedule: Schedule | null,
  group: OutputGroup | undefined,
  systemOptions: SystemOptions,
  songsList: any[],
  themesList: any[],
  availableDisplays: any[]
): RenderFrame | undefined {
  if (state.isBlack || state.isClear || state.showLogo) return undefined;

  const activeItem = PresentationCore.getActiveContent(schedule, state, state.directLiveItem);
  if (!activeItem) return undefined;

  // Fast bypass for non-text items
  const isPptx = activeItem.type === 'presentation' || activeItem.type === 'ppt';
  if (isPptx) return undefined;

  const isMedia = activeItem.type === 'image' || activeItem.type === 'video' || activeItem.type === 'audio';
  if (isMedia) return undefined;

  const so = systemOptions?.mainOutput?.song;
  const sc = systemOptions?.mainOutput?.scripture;
  const ao = systemOptions?.alternateOutput;
  const songFontSig = so ? `${so.labelFont?.family}_${so.labelFont?.maxSize}_${so.backdropAssetUrl || ''}` : '';
  const scriptureFontSig = sc ? `${sc.referenceFont?.family}_${sc.verseFont?.family}_${sc.backdropAssetUrl || ''}` : '';
  const altOutputSig = ao ? `${ao.feedMode}_${ao.defaultFont?.family}` : '';
  const cacheKey = `${groupId}_${activeItem.id}_${state.activeSlideIndex || 0}_${group?.themeId || ''}_${activeItem.themeId || ''}_${group?.customResolution?.width || 0}_${availableDisplays?.length || 0}_${songFontSig}_${scriptureFontSig}_${altOutputSig}`;
  const cached = frameCache.get(cacheKey);
  if (cached) {
    return { ...cached.frame, timestamp: state.timestamp };
  }

  const slides = PresentationCore.generateSlides(activeItem, songsList, systemOptions);
  if (!slides || slides.length === 0) return undefined;

  const currentSlideIndex = Math.min(state.activeSlideIndex || 0, slides.length - 1);
  const currentSlide = slides[currentSlideIndex];
  if (!currentSlide) return undefined; 

  const res = resolveGroupResolution(group, systemOptions, availableDisplays);
  
  const globalTheme = themesList.find((t: any) => t.id === 'theme-global')?.styles || ThemeEngine.getDefaultGlobalTheme();
  const groupTheme = group?.themeId ? themesList.find((t: any) => t.id === group.themeId)?.styles : undefined;
  
  let typeThemeId = 'theme-global';
  let systemFontOverride = undefined;
  
  if (activeItem.type === 'song') {
    typeThemeId = 'theme-song';
    systemFontOverride = ThemeEngine.getSystemFontForContent(systemOptions, 'song');
  } else if (activeItem.type === 'bible') {
    typeThemeId = 'theme-scripture';
    systemFontOverride = ThemeEngine.getSystemFontForContent(systemOptions, 'scripture');
  } else {
    typeThemeId = 'theme-presentation';
    systemFontOverride = ThemeEngine.getSystemFontForContent(systemOptions, 'presentation');
  }

  const isAltGroup = groupId === 'group-alternate' || group?.id === 'group-alternate' || group?.role === 'lobby';
  if (isAltGroup && systemOptions?.alternateOutput?.defaultFont) {
    const altFontStyles = ThemeEngine.fontStyleToThemeStyles(systemOptions.alternateOutput.defaultFont);
    if (altFontStyles) {
      systemFontOverride = {
        ...systemFontOverride,
        ...altFontStyles
      };
    }
  }
  
  const typeTheme = themesList.find((t: any) => t.id === typeThemeId)?.styles;
  const itemTheme = activeItem.themeId ? themesList.find((t: any) => t.id === activeItem.themeId)?.styles : undefined;
  
  // Base song logic for items referencing base items
  let baseSong = null;
  if (activeItem.type === 'song' && activeItem.contentId) {
    baseSong = songsList.find(s => s.id === activeItem.contentId);
  }
  const elementOverride = activeItem.themeOverride || baseSong?.themeOverride;

  const resolvedStyles = ThemeEngine.resolveStyles(
    globalTheme,
    groupTheme,
    typeTheme,
    systemFontOverride,
    itemTheme,
    elementOverride
  );

  const songOpts = systemOptions?.mainOutput?.song;
  const scriptureOpts = systemOptions?.mainOutput?.scripture;

  const isSongContent = activeItem.type === 'song';
  const isBibleContent = activeItem.type === 'bible';

  let effectiveMargins = isAltGroup && systemOptions?.alternateOutput?.margins
    ? systemOptions.alternateOutput.margins
    : isSongContent && songOpts?.margins
    ? songOpts.margins
    : isBibleContent && scriptureOpts?.margins
    ? scriptureOpts.margins
    : res.margins;

  // Handle broadcast lower third mode for alternate output
  if (isAltGroup && systemOptions?.alternateOutput?.feedMode === 'lower_third') {
    resolvedStyles.alignVertical = 'bottom';
    resolvedStyles.widthPercent = 92;
    effectiveMargins = {
      ...effectiveMargins,
      top: Math.round(res.height * 0.65),
      bottom: Math.max(effectiveMargins.bottom || 0, Math.round(res.height * 0.05)),
    };
  }
  
  const showVerseChorusLabel = songOpts?.showVerseChorusLabel ?? true;
  const songLabelLoc = songOpts?.labelLocation || 'Header';
  const showReference = scriptureOpts?.showReference ?? true;
  const refLocation = scriptureOpts?.referenceLocation || 'Before Each Slide';

  const hasHeader = Boolean(currentSlide.title && (
    (activeItem.type === 'song' && showVerseChorusLabel && songLabelLoc === 'Header') ||
    (activeItem.type === 'bible' && showReference && refLocation === 'Before Each Slide')
  ));

  let headerText = '';
  if (activeItem.type === 'song') {
    if (hasHeader) {
      headerText = currentSlide.title.replace(/:(.*)/, '') || currentSlide.title;
    }
  } else if (activeItem.type === 'bible') {
    if (showReference) {
      headerText = currentSlide.title || '';
    }
  }

  const hasFooter = Boolean(
    (activeItem.type === 'song' && songOpts?.displayCopyrightInfo && currentSlideIndex === slides.length - 1) ||
    (activeItem.type === 'song' && showVerseChorusLabel && (songLabelLoc === 'Bottom Left' || songLabelLoc === 'Bottom Right')) ||
    (activeItem.type === 'bible' && showReference && refLocation === 'Bottom Right') ||
    (activeItem.type === 'bible' && scriptureOpts?.showTranslationBadge)
  );

  const isUpper = activeItem.type === 'song'
    ? (songOpts?.allCapsLyrics || songOpts?.songFont?.casing === 'uppercase')
    : (activeItem.type === 'bible' && scriptureOpts?.scriptureFont?.casing === 'uppercase');

  const spacing = activeItem.type === 'song'
    ? (songOpts?.songFont?.lineSpacing ?? songOpts?.lineSpacing ?? 1.35)
    : (activeItem.type === 'bible' ? (scriptureOpts?.scriptureFont?.lineSpacing ?? scriptureOpts?.lineSpacing ?? 1.35) : 1.35);

  const baseSize = ThemeEngine.normalizeFontSize(resolvedStyles.fontSize);

  const shouldAutoAdjust = isSongContent 
    ? (songOpts?.autoAdjust ?? true)
    : (isBibleContent ? (scriptureOpts?.autoAdjust ?? true) : true);

  const autoFitSize = shouldAutoAdjust
    ? ThemeEngine.calculateAutoFitFontSize({
        text: currentSlide.text,
        baseFontSize: baseSize,
        fontFamily: resolvedStyles.fontFamily,
        fontWeight: resolvedStyles.fontWeight,
        fontStyle: resolvedStyles.fontStyle,
        hasHeader,
        hasFooter,
        scale: 1,
        minFontSize: activeItem.type === 'song' ? (songOpts?.minFontSize ?? 24) : (activeItem.type === 'bible' ? (scriptureOpts?.minFontSize ?? 24) : 24),
        maxFontSize: baseSize,
        containerWidth: res.width,
        containerHeight: res.height,
        isUppercase: isUpper,
        lineSpacing: spacing,
        widthPercent: resolvedStyles.widthPercent || 100,
        margins: effectiveMargins,
      })
    : baseSize;

  const frameResult: RenderFrame = {
    groupId,
    targetWidth: res.width,
    targetHeight: res.height,
    aspectRatio: res.aspectRatio,
    aspectLabel: res.aspectLabel,
    margins: effectiveMargins,
    activeItem,
    activeSlide: currentSlide,
    resolvedStyles,
    autoFitFontSize: autoFitSize,
    baseFontSize: baseSize,
    hasHeader,
    headerText,
    headerStyles: (() => {
      const matched = matchSlideLabel(currentSlide?.title, systemOptions?.slideLabels);
      if (matched && matched.textColor) {
        return {
          color: matched.textColor,
        };
      }
      return {};
    })(),
    hasFooter,
    footerText: '',
    footerStyles: {},
    isUpper,
    lineSpacing: spacing,
    widthPercent: resolvedStyles.widthPercent || 100,
    timestamp: state.timestamp
  };

  if (frameCache.size > MAX_FRAME_CACHE_SIZE) {
    const firstKey = frameCache.keys().next().value;
    if (firstKey) frameCache.delete(firstKey);
  }
  frameCache.set(cacheKey, { key: cacheKey, frame: frameResult });

  return frameResult;
}

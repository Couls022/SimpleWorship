import { PresentationState, Schedule, OutputGroup, SystemOptions, RenderFrame, PresentationItem, Slide } from '../types';
import { PresentationCore } from './PresentationCore';
import { ThemeEngine } from './ThemeEngine';
import { matchSlideLabel } from '../utils/slideLabelHelper';

export function resolveGroupResolution(
  group: OutputGroup | undefined,
  systemOptions: SystemOptions | undefined,
  availableDisplays?: any[],
  overrideRes?: { width: number; height: number }
): { 
  width: number; 
  height: number; 
  aspectRatio: number; 
  aspectLabel: string; 
  margins: { left: number; top: number; right: number; bottom: number };
  scaleMode: 'fit' | 'fill' | 'crop';
} {
  const defaultMargins = { left: 0, top: 0, right: 0, bottom: 0 };
  const effectiveScaleMode: 'fit' | 'fill' | 'crop' = 
    group?.scaleMode || systemOptions?.mainOutput?.general?.scaleMode || 'fill';
  
  // Helper to format ratio label
  const formatRatioLabel = (w: number, h: number): { ratio: number; label: string } => {
    const r = w / h;
    if (Math.abs(r - 4 / 3) < 0.04) return { ratio: 4 / 3, label: '4:3 (12ft×9ft LED Wall / Standard)' };
    if (Math.abs(r - 3 / 4) < 0.04) return { ratio: 3 / 4, label: '3:4 (9ft×12ft Vertical LED Wall)' };
    if (Math.abs(r - 16 / 9) < 0.05) return { ratio: 16 / 9, label: '16:9 Widescreen' };
    if (Math.abs(r - 16 / 10) < 0.04) return { ratio: 1.6, label: '16:10 WUXGA' };
    if (Math.abs(r - 1) < 0.04) return { ratio: 1, label: '1:1 Square LED Cube' };
    if (Math.abs(r - 21 / 9) < 0.05) return { ratio: 21 / 9, label: '21:9 Ultrawide' };
    return { ratio: r, label: `${w}×${h}` };
  };

  if (overrideRes && overrideRes.width > 0 && overrideRes.height > 0) {
    const { ratio, label } = formatRatioLabel(overrideRes.width, overrideRes.height);
    let baseMargins = { left: 0, top: 0, right: 0, bottom: 0 };
    if (systemOptions) {
      if (group?.id === 'group-alternate' || group?.role === 'lobby') {
        if (systemOptions.alternateOutput?.margins) baseMargins = { ...systemOptions.alternateOutput.margins };
      } else if (group?.id === 'group-stage' || group?.role === 'confidence') {
        if (systemOptions.foldback?.margins) baseMargins = { ...systemOptions.foldback.margins };
      } else {
        if (systemOptions.mainOutput?.general?.margins) baseMargins = { ...systemOptions.mainOutput.general.margins };
      }
    }
    return { width: overrideRes.width, height: overrideRes.height, aspectRatio: ratio, aspectLabel: label, margins: baseMargins, scaleMode: effectiveScaleMode };
  }

  // 1. Group custom resolution
  if (group?.customResolution && group.customResolution.width > 0 && group.customResolution.height > 0) {
    const w = group.customResolution.width;
    const h = group.customResolution.height;
    const { ratio, label } = formatRatioLabel(w, h);
    return { width: w, height: h, aspectRatio: ratio, aspectLabel: label, margins: defaultMargins, scaleMode: effectiveScaleMode };
  }

  // 2. Group explicit aspect ratio string (e.g. "4:3", "1440x1080", "12ftx9ft", "16:9")
  if (group?.aspectRatio) {
    const cleanAspect = group.aspectRatio.trim().toLowerCase();
    if (cleanAspect.includes('x')) {
      const parts = cleanAspect.split('x').map(n => parseInt(n.trim(), 10));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] > 0 && parts[1] > 0) {
        const { ratio, label } = formatRatioLabel(parts[0], parts[1]);
        return { width: parts[0], height: parts[1], aspectRatio: ratio, aspectLabel: label, margins: defaultMargins, scaleMode: effectiveScaleMode };
      }
    }
    if (cleanAspect === '4:3' || cleanAspect.includes('12:9') || cleanAspect.includes('12x9')) {
      return { width: 1440, height: 1080, aspectRatio: 4 / 3, aspectLabel: '4:3 (12ft×9ft LED Wall)', margins: defaultMargins, scaleMode: effectiveScaleMode };
    }
    if (cleanAspect === '3:4' || cleanAspect.includes('9:12') || cleanAspect.includes('9x12')) {
      return { width: 1080, height: 1440, aspectRatio: 3 / 4, aspectLabel: '3:4 (9ft×12ft Vertical LED Wall)', margins: defaultMargins, scaleMode: effectiveScaleMode };
    }
    if (cleanAspect === '16:10') {
      return { width: 1920, height: 1200, aspectRatio: 1.6, aspectLabel: '16:10', margins: defaultMargins, scaleMode: effectiveScaleMode };
    }
    if (cleanAspect === '1:1') {
      return { width: 1080, height: 1080, aspectRatio: 1.0, aspectLabel: '1:1 Square', margins: defaultMargins, scaleMode: effectiveScaleMode };
    }
    if (cleanAspect === '16:9') {
      return { width: 1920, height: 1080, aspectRatio: 16 / 9, aspectLabel: '16:9 Widescreen', margins: defaultMargins, scaleMode: effectiveScaleMode };
    }
  }

  const defaultRes = { width: 1920, height: 1080, aspectRatio: 16 / 9, aspectLabel: '16:9', margins: defaultMargins, scaleMode: effectiveScaleMode };
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

  // Only if no custom resolution was explicitly chosen, fallback to hardware screen bounds
  const isDefault1080p = physicalWidth === 1920 && physicalHeight === 1080;
  if (isDefault1080p && availableDisplays && availableDisplays.length > 0 && group?.targetDisplayId && group.targetDisplayId !== 'window') {
    const d = availableDisplays.find(x => x.id?.toString() === group.targetDisplayId || x.label === group.targetDisplayId || x.name === group.targetDisplayId);
    if (d?.bounds && d.bounds.width > 0 && d.bounds.height > 0) {
      physicalWidth = d.bounds.width;
      physicalHeight = d.bounds.height;
    }
  }

  const { ratio, label } = formatRatioLabel(physicalWidth, physicalHeight);

  return { width: physicalWidth, height: physicalHeight, aspectRatio: ratio, aspectLabel: label, margins: baseMargins, scaleMode: effectiveScaleMode };
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
  availableDisplays: any[],
  overrideRes?: { width: number; height: number }
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
  const cacheKey = `${groupId}_${activeItem.id}_${state.activeSlideIndex || 0}_${group?.themeId || ''}_${activeItem.themeId || ''}_${group?.customResolution?.width || 0}_${overrideRes?.width || 0}_${overrideRes?.height || 0}_${availableDisplays?.length || 0}_${songFontSig}_${scriptureFontSig}_${altOutputSig}`;
  const cached = frameCache.get(cacheKey);
  if (cached) {
    return { ...cached.frame, timestamp: state.timestamp };
  }

  const slides = PresentationCore.generateSlides(activeItem, songsList, systemOptions);
  if (!slides || slides.length === 0) return undefined;

  const currentSlideIndex = Math.min(state.activeSlideIndex || 0, slides.length - 1);
  const currentSlide = slides[currentSlideIndex];
  if (!currentSlide) return undefined; 

  const res = resolveGroupResolution(group, systemOptions, availableDisplays, overrideRes);
  
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

  let hasSongTitle = false;
  let songTitleText = '';
  let songTitleStyles: React.CSSProperties = {};

  if (activeItem.type === 'song') {
    const rawSongTitle = activeItem.data?.title || activeItem.name || '';
    const isTitleEnabled = activeItem.data?.showTitleAboveVerses ?? (activeItem as any).showTitleAboveVerses ?? songOpts?.showSongTitle ?? true;
    const placement = activeItem.data?.titlePlacement ?? (activeItem as any).titlePlacement ?? (songOpts?.songTitleLocation === 'First Slide Only' ? 'first_slide' : (songOpts?.songTitleLocation === 'None' ? 'none' : 'all_slides'));
    
    const shouldShowOnSlide = placement === 'none' ? false : (placement === 'first_slide' ? currentSlideIndex === 0 : true);

    if (isTitleEnabled && shouldShowOnSlide && rawSongTitle.trim()) {
      hasSongTitle = true;
      const isUppercase = activeItem.data?.titleUppercase ?? (songOpts?.songTitleCasing === 'uppercase');
      songTitleText = isUppercase ? rawSongTitle.toUpperCase() : rawSongTitle;
      
      const titleSize = activeItem.data?.titleFontSize ?? songOpts?.songTitleFont?.maxSize ?? 42;
      const titleColor = activeItem.data?.titleFontColor ?? songOpts?.songTitleFont?.color ?? '#FDE047';
      const titleFontFamily = activeItem.data?.titleFontFamily ?? songOpts?.songTitleFont?.family ?? resolvedStyles.fontFamily;
      const titleBold = activeItem.data?.titleBold ?? songOpts?.songTitleFont?.bold ?? true;

      songTitleStyles = {
        fontSize: `${titleSize}px`,
        color: titleColor,
        fontFamily: titleFontFamily,
        fontWeight: titleBold ? 700 : 500,
        textAlign: (songOpts?.songTitleFont?.alignHorizontal || 'center') as any,
      };
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
        hasHeader: hasHeader || hasSongTitle,
        hasFooter,
        scale: 1,
        minFontSize: activeItem.type === 'song' ? (songOpts?.minFontSize ?? 24) : (activeItem.type === 'bible' ? (scriptureOpts?.minFontSize ?? 24) : 24),
        maxFontSize: baseSize,
        containerWidth: res.width,
        containerHeight: res.height,
        isUppercase: isUpper,
        lineSpacing: spacing,
        widthPercent: resolvedStyles.widthPercent || 90,
        margins: effectiveMargins,
      })
    : baseSize;

  const frameResult: RenderFrame = {
    groupId,
    targetWidth: res.width,
    targetHeight: res.height,
    aspectRatio: res.aspectRatio,
    aspectLabel: res.aspectLabel,
    scaleMode: res.scaleMode,
    margins: effectiveMargins,
    activeItem,
    activeSlide: currentSlide,
    resolvedStyles,
    autoFitFontSize: autoFitSize,
    baseFontSize: baseSize,
    hasHeader,
    headerText,
    hasSongTitle,
    songTitleText,
    songTitleStyles,
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

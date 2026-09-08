import { PresentationState, Schedule, OutputGroup, SystemOptions, RenderFrame, PresentationItem, Slide } from '../types';
import { PresentationCore } from './PresentationCore';
import { ThemeEngine } from './ThemeEngine';

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

  if (availableDisplays && availableDisplays.length > 0 && group?.targetDisplayId && group.targetDisplayId !== 'window') {
    const d = availableDisplays.find(x => x.id.toString() === group.targetDisplayId);
    if (d) {
      physicalWidth = d.bounds.width;
      physicalHeight = d.bounds.height;
    }
  }

  const isSong = true; // simplifying margins based on system options
  const baseMargins = {
    left: systemOptions.mainOutput.general.margins?.left || 0,
    top: systemOptions.mainOutput.general.margins?.top || 0,
    right: systemOptions.mainOutput.general.margins?.right || 0,
    bottom: systemOptions.mainOutput.general.margins?.bottom || 0,
  };

  const ratio = physicalWidth / physicalHeight;
  const label = Math.abs(ratio - 16 / 9) < 0.05 ? '16:9' : Math.abs(ratio - 4 / 3) < 0.05 ? '4:3' : `${physicalWidth}×${physicalHeight}`;

  return { width: physicalWidth, height: physicalHeight, aspectRatio: ratio, aspectLabel: label, margins: baseMargins };
}

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

  const slides = PresentationCore.generateSlides(activeItem, songsList, systemOptions);
  if (!slides || slides.length === 0) return undefined;

  const currentSlideIndex = Math.min(state.activeSlideIndex || 0, slides.length - 1);
  const currentSlide = slides[currentSlideIndex];
  if (!currentSlide) return undefined;

  // Re-use logic from MonitorPreviewCanvas
  const isPptx = activeItem.type === 'presentation' || activeItem.type === 'ppt';
  if (isPptx) return undefined; // PPTX doesn't use RenderFrame text layout

  const isMedia = activeItem.type === 'image' || activeItem.type === 'video' || activeItem.type === 'audio';
  if (isMedia) return undefined; 

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

  const songOpts = systemOptions.mainOutput.song;
  const scriptureOpts = systemOptions.mainOutput.scripture;
  
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
    ? (songOpts?.songFont?.lineSpacing || songOpts?.lineSpacing || 1.35)
    : (activeItem.type === 'bible' ? (scriptureOpts?.scriptureFont?.lineSpacing || scriptureOpts?.lineSpacing || 1.35) : 1.35);

  const baseSize = ThemeEngine.normalizeFontSize(resolvedStyles.fontSize);

  const autoFitSize = ThemeEngine.calculateAutoFitFontSize({
    text: currentSlide.text,
    baseFontSize: baseSize,
    fontFamily: resolvedStyles.fontFamily,
    fontWeight: resolvedStyles.fontWeight,
    fontStyle: resolvedStyles.fontStyle,
    hasHeader,
    hasFooter,
    scale: 1,
    minFontSize: activeItem.type === 'song' ? (songOpts?.minFontSize || 32) : (activeItem.type === 'bible' ? (scriptureOpts?.minFontSize || 32) : 24),
    maxFontSize: baseSize,
    containerWidth: res.width,
    containerHeight: res.height,
    isUppercase: isUpper,
    lineSpacing: spacing,
    widthPercent: resolvedStyles.widthPercent || 100,
    margins: res.margins,
  });

  return {
    groupId,
    targetWidth: res.width,
    targetHeight: res.height,
    aspectRatio: res.aspectRatio,
    aspectLabel: res.aspectLabel,
    margins: res.margins,
    activeItem,
    activeSlide: currentSlide,
    resolvedStyles,
    autoFitFontSize: autoFitSize,
    baseFontSize: baseSize,
    hasHeader,
    headerText,
    headerStyles: {},
    hasFooter,
    footerText: '',
    footerStyles: {},
    isUpper,
    lineSpacing: spacing,
    widthPercent: resolvedStyles.widthPercent || 100,
    timestamp: state.timestamp
  };
}

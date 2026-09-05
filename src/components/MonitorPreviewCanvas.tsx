import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { PresentationCore } from '../core/PresentationCore';
import { ThemeEngine } from '../core/ThemeEngine';
import { Sparkles, Music, Volume2 } from 'lucide-react';
import SimpleWorshipLogo from './SimpleWorshipLogo';
import { OutputGroup, PresentationState, SystemOptions } from '../types';
import { formatVerseNumber } from '../utils/scriptureFormatter';
import { PresentationContentResolver } from '../core/PresentationContentResolver';
import CameraLiveRenderer from './CameraLiveRenderer';
import { PresentationSlideView } from './PresentationSlideView';
import { PptxRenderOverlay } from './PptxRenderOverlay';
import { isValidPptxBinary } from '../utils/pptxValidator';
import { SlideTransitionManager } from '../core/SlideTransitionManager';
import { SlideAnnotationLayer } from './SlideAnnotationLayer';

interface MonitorPreviewCanvasProps {
  groupId: string;
  customGroup?: OutputGroup;
  customState?: PresentationState;
  showResolutionTag?: boolean;
  className?: string;
}

export function resolveGroupResolution(
  group: OutputGroup | undefined,
  systemOptions: SystemOptions | undefined
): { width: number; height: number; aspectRatio: number; aspectLabel: string; margins: { left: number; top: number; right: number; bottom: number } } {
  const defaultMargins = { left: 0, top: 0, right: 0, bottom: 0 };

  // 1. Check if group has explicit customResolution
  if (group?.customResolution && group.customResolution.width > 0 && group.customResolution.height > 0) {
    const w = group.customResolution.width;
    const h = group.customResolution.height;
    const ratio = w / h;
    const label = Math.abs(ratio - 16 / 9) < 0.05 ? '16:9' : Math.abs(ratio - 4 / 3) < 0.05 ? '4:3' : `${w}×${h}`;
    return { width: w, height: h, aspectRatio: ratio, aspectLabel: label, margins: defaultMargins };
  }

  // 2. Check if group has explicit aspectRatio presets or custom resolution strings (e.g., '1366x768', '1920x1080', '1280x720', '1024x768')
  if (group?.aspectRatio && group.aspectRatio !== 'options' && group.aspectRatio !== 'auto') {
    if (group.aspectRatio.includes('x')) {
      const parts = group.aspectRatio.split('x');
      const w = parseInt(parts[0], 10);
      const h = parseInt(parts[1], 10);
      if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
        const ratio = w / h;
        const label = Math.abs(ratio - 16 / 9) < 0.05 ? '16:9' : Math.abs(ratio - 4 / 3) < 0.05 ? '4:3' : Math.abs(ratio - 16 / 10) < 0.05 ? '16:10' : `${w}×${h}`;
        return { width: w, height: h, aspectRatio: ratio, aspectLabel: label, margins: defaultMargins };
      }
    }
    if (group.aspectRatio === '4:3') {
      return { width: 1024, height: 768, aspectRatio: 4 / 3, aspectLabel: '4:3', margins: defaultMargins };
    }
    if (group.aspectRatio === '16:10') {
      return { width: 1920, height: 1200, aspectRatio: 16 / 10, aspectLabel: '16:10', margins: defaultMargins };
    }
    if (group.aspectRatio === '16:9') {
      return { width: 1920, height: 1080, aspectRatio: 16 / 9, aspectLabel: '16:9', margins: defaultMargins };
    }
  }

  // 3. If group is 'confidence' (Foldback) and foldback options has custom position:
  if (group?.role === 'confidence' && systemOptions?.foldback?.position && systemOptions.foldback.position.width > 0 && systemOptions.foldback.position.height > 0) {
    const w = systemOptions.foldback.position.width;
    const h = systemOptions.foldback.position.height;
    const ratio = w / h;
    const label = Math.abs(ratio - 16 / 9) < 0.05 ? '16:9' : Math.abs(ratio - 4 / 3) < 0.05 ? '4:3' : Math.abs(ratio - 16 / 10) < 0.05 ? '16:10' : `${w}×${h}`;
    return { width: w, height: h, aspectRatio: ratio, aspectLabel: label, margins: systemOptions.foldback.margins || defaultMargins };
  }

  // 4. If group is 'broadcast' or 'lobby' (Alternate Output) and alternateOutput options has custom position:
  if ((group?.role === 'broadcast' || group?.role === 'lobby') && systemOptions?.alternateOutput?.position && systemOptions.alternateOutput.position.width > 0 && systemOptions.alternateOutput.position.height > 0) {
    const w = systemOptions.alternateOutput.position.width;
    const h = systemOptions.alternateOutput.position.height;
    const ratio = w / h;
    const label = Math.abs(ratio - 16 / 9) < 0.05 ? '16:9' : Math.abs(ratio - 4 / 3) < 0.05 ? '4:3' : Math.abs(ratio - 16 / 10) < 0.05 ? '16:10' : `${w}×${h}`;
    return { width: w, height: h, aspectRatio: ratio, aspectLabel: label, margins: systemOptions.alternateOutput.margins || defaultMargins };
  }

  // 5. Default: Main Output General settings
  const sysPos = systemOptions?.mainOutput?.general?.position;
  if (sysPos && sysPos.width > 0 && sysPos.height > 0) {
    const w = sysPos.width;
    const h = sysPos.height;
    const ratio = w / h;
    const label = Math.abs(ratio - 16 / 9) < 0.05 ? '16:9' : Math.abs(ratio - 4 / 3) < 0.05 ? '4:3' : Math.abs(ratio - 16 / 10) < 0.05 ? '16:10' : `${w}×${h}`;
    return { width: w, height: h, aspectRatio: ratio, aspectLabel: label, margins: systemOptions.mainOutput.general.margins || defaultMargins };
  }

  return { width: 1920, height: 1080, aspectRatio: 16 / 9, aspectLabel: '16:9', margins: defaultMargins };
}

export default function MonitorPreviewCanvas({
  groupId,
  customGroup,
  customState,
  showResolutionTag = false,
  className = '',
}: MonitorPreviewCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const store = useStore();
  const { 
    outputGroups, 
    groupStates, 
    activeSchedule, 
    songsList, 
    themesList, 
    alert, 
    systemOptions 
  } = store;

  const group = customGroup || outputGroups.find(g => g.id === groupId) || outputGroups[0];
  const presentationState = customState || groupStates[groupId] || ({
    activeScheduleId: null,
    activeItemId: null,
    activeSlideIndex: 0,
    nextSlideIndex: 1,
    isBlack: false,
    isClear: false,
    showLogo: false,
    timestamp: Date.now(),
    isLiveEnabled: false,
  } as PresentationState);

  const activeItem = PresentationCore.getActiveContent(activeSchedule, presentationState, presentationState.directLiveItem);

  useEffect(() => {
    if (!activeItem || !activeItem.contentId) return;

    const needsPptxHydration = activeItem.type === 'presentation' && !isValidPptxBinary(activeItem.data?.fileBytes);
    const currentUrl = activeItem.data?.url || activeItem.customBackgroundUrl;
    const needsMediaHydration = (activeItem.type === 'media' || activeItem.type === 'video' || activeItem.type === 'audio' || activeItem.type === 'image') && (!currentUrl || currentUrl.startsWith('blob:'));

    if (needsPptxHydration || needsMediaHydration) {
      PresentationContentResolver.hydrateItemBinaryIfNeeded(activeItem).then((hydratedItem) => {
        if (hydratedItem && hydratedItem !== activeItem) {
          useStore.setState((prev) => {
            const currentGroupState = prev.groupStates[groupId];
            if (!currentGroupState) return prev;
            if (currentGroupState.activeItemId !== activeItem.id && currentGroupState.directLiveItem?.id !== activeItem.id) return prev;

            return {
              groupStates: {
                ...prev.groupStates,
                [groupId]: {
                  ...currentGroupState,
                  directLiveItem: currentGroupState.directLiveItem?.id === activeItem.id ? hydratedItem : currentGroupState.directLiveItem
                }
              }
            };
          });
        }
      });
    }
  }, [activeItem?.id, activeItem?.type, activeItem?.contentId, activeItem?.data?.url, activeItem?.customBackgroundUrl, groupId]);

  // Resolve Content & Themes
  const slides = activeItem ? PresentationCore.generateSlides(activeItem, songsList, systemOptions) : [];
  const currentSlide = slides[presentationState.activeSlideIndex] || null;

  // Determine native target resolution & aspect ratio based on Selected Output Monitor & General settings
  const { width: targetWidth, height: targetHeight, aspectRatio: groupAspectRatio, aspectLabel: groupAspectLabel, margins } = resolveGroupResolution(group, systemOptions);

  // If active item is a presentation with template aspect ratio, adapt to the PowerPoint template ratio
  const isPptx = activeItem?.type === 'presentation' || activeItem?.type === 'ppt' || isValidPptxBinary(activeItem?.data?.fileBytes);
  const templateAspectRatio = currentSlide?.aspectRatio || activeItem?.data?.aspectRatio;
  const aspectRatio = (isPptx && templateAspectRatio && templateAspectRatio > 0) ? templateAspectRatio : groupAspectRatio;
  const aspectLabel = (isPptx && currentSlide?.aspectRatioLabel) ? currentSlide.aspectRatioLabel : groupAspectLabel;

  // Track parent container dimensions via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Compute fitted box dimensions with letterbox/pillarbox
  let fittedWidth = containerSize.width || 320;
  let fittedHeight = containerSize.height || 180;

  if (containerSize.width > 0 && containerSize.height > 0) {
    const availWidth = Math.max(containerSize.width - 4, 10);
    const availHeight = Math.max(containerSize.height - 4, 10);
    const containerAspect = availWidth / availHeight;
    if (containerAspect > aspectRatio) {
      // Height is the constraint
      fittedHeight = availHeight;
      fittedWidth = Math.round(fittedHeight * aspectRatio);
    } else {
      // Width is the constraint
      fittedWidth = availWidth;
      fittedHeight = Math.round(fittedWidth / aspectRatio);
    }
  } else {
    fittedHeight = Math.round(fittedWidth / aspectRatio);
  }

  const scale = fittedWidth / targetWidth;

  const globalTheme = themesList.find(t => t.type === 'global') || themesList[0];
  const groupTheme = themesList.find(t => t.id === group?.themeId);
  const typeTheme = themesList.find(t => t.type === activeItem?.type);

  const baseSong = activeItem?.type === 'song' ? songsList.find(s => s.id === activeItem.contentId) : null;
  const itemTheme = themesList.find(t => t.id === (activeItem?.themeId || baseSong?.themeId));
  const elementOverride = activeItem?.themeOverride || baseSong?.themeOverride;

  const systemFontOverride = ThemeEngine.getSystemFontForContent(systemOptions, activeItem?.type);

  const resolvedStyles = ThemeEngine.resolveStyles(
    globalTheme?.styles || ThemeEngine.getDefaultGlobalTheme(),
    groupTheme?.styles,
    typeTheme?.styles,
    systemFontOverride,
    itemTheme?.styles,
    elementOverride
  );

  const songOpts = systemOptions?.mainOutput?.song;
  const showVerseChorusLabel = activeItem?.type === 'song' ? (songOpts?.showVerseChorusLabel ?? true) : true;
  const labelStyles = songOpts?.labelFont ? ThemeEngine.fontStyleToThemeStyles(songOpts.labelFont) : null;
  const songLabelLoc = songOpts?.labelLocation || 'Header';

  const formatSongLabel = (rawTitle: string) => {
    if (!rawTitle) return '';
    let text = rawTitle;
    const style = songOpts?.labelStyle || 'uppercase';
    if (style === 'uppercase') text = text.toUpperCase();
    else if (style === 'badge') text = `[ ${text} ]`;
    else if (style === 'parentheses') text = `(${text})`;
    return `${songOpts?.labelPrefix || ''}${text}`;
  };

  const totalSlides = slides.length || 1;
  const isFirstSlide = presentationState.activeSlideIndex === 0;
  const isLastSlide = presentationState.activeSlideIndex === totalSlides - 1;

  let showCopyright = activeItem?.type === 'song' && (songOpts?.displayCopyrightInfo ?? true);
  if (songOpts?.showOnFirstSlideOnly && !isFirstSlide) showCopyright = false;
  if (songOpts?.showOnLastSlideOnly && !isLastSlide) showCopyright = false;

  const copyrightPos = songOpts?.copyrightPosition || 'Bottom Left';
  const copyrightStyles = songOpts?.copyrightFont ? ThemeEngine.fontStyleToThemeStyles(songOpts.copyrightFont) : null;

  const scriptureOpts = systemOptions?.mainOutput?.scripture;
  const showReference = activeItem?.type === 'bible' && (scriptureOpts?.showReference ?? true);
  const refLocation = scriptureOpts?.referenceLocation || 'After Each Slide';
  const referenceStyles = scriptureOpts?.referenceFont ? ThemeEngine.fontStyleToThemeStyles(scriptureOpts.referenceFont) : null;

  const isLogoMode = Boolean(presentationState.showLogo);
  const logoTheme = themesList.find(t => t.type === 'logo' || t.id === 'theme-logo');
  const logoStyles = logoTheme?.styles || {};

  const contentType = PresentationContentResolver.detectContentType(activeItem);

  const formatVideoTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const isVideoUrl = (url?: string) => {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    return lower.startsWith('data:video/') || lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.m4v') || lower.endsWith('.avi') || lower.endsWith('.ogv');
  };

  const isImageUrl = (url?: string) => {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    return lower.startsWith('data:image/') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp') || lower.endsWith('.gif') || lower.endsWith('.svg');
  };

  // Track slide index for direction-aware transitions (e.g. push-left vs push-right)
  const prevSlideIndexRef = useRef(0);
  const currentSlideIndex = presentationState?.activeSlideIndex || 0;
  const isForward = currentSlideIndex >= prevSlideIndexRef.current;

  useEffect(() => {
    prevSlideIndexRef.current = currentSlideIndex;
  }, [currentSlideIndex]);

  const activeTransition = SlideTransitionManager.resolveTransition(currentSlide, systemOptions);
  const motionConfig = SlideTransitionManager.getMotionConfig(activeTransition, isForward);

  let isVideo = false;
  let videoSrc = '';
  let backgroundUrl = '';
  let audioSrc = '';

  if (isLogoMode) {
    if (logoStyles.backgroundType === 'video' && logoStyles.backgroundVideoUrl) {
      isVideo = true;
      videoSrc = logoStyles.backgroundVideoUrl;
    } else {
      isVideo = false;
      backgroundUrl = logoStyles.backgroundImageUrl || resolvedStyles.backgroundImageUrl || '';
    }
  } else {
    const slideBgUrl = currentSlide?.backgroundUrl;
    const slideIsVideo = currentSlide?.isVideo;

    const isExplicitImageItem = (
      contentType === 'image' ||
      activeItem?.type === 'image' ||
      (activeItem?.type === 'media' && activeItem.data?.isVideo === false) ||
      (activeItem?.type === 'media' && activeItem.data?.type === 'image')
    );

    const isExplicitVideoItem = (
      contentType === 'video' ||
      activeItem?.type === 'video' ||
      (activeItem?.type === 'media' && activeItem.data?.isVideo === true) ||
      (activeItem?.type === 'media' && (activeItem.data?.type === 'video' || activeItem.data?.type === 'motion'))
    );

    if (contentType === 'pptx' || activeItem?.type === 'presentation' || activeItem?.type === 'ppt') {
      isVideo = false;
      videoSrc = '';
      backgroundUrl = '';
    } else if (contentType === 'audio') {
      isVideo = false;
      audioSrc = activeItem?.data?.url || activeItem?.customBackgroundUrl || '';
      backgroundUrl = resolvedStyles.backgroundImageUrl || '';
    } else if (slideBgUrl) {
      if (slideIsVideo === true || isExplicitVideoItem || isVideoUrl(slideBgUrl)) {
        isVideo = true;
        videoSrc = slideBgUrl;
      } else {
        isVideo = false;
        backgroundUrl = slideBgUrl;
      }
    } else {
      if (!isExplicitImageItem && resolvedStyles.backgroundType === 'video' && resolvedStyles.backgroundVideoUrl) {
        isVideo = true;
        videoSrc = resolvedStyles.backgroundVideoUrl;
      } else {
        isVideo = false;
        backgroundUrl = resolvedStyles.backgroundImageUrl || '';
      }
    }
  }

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    videoEl.loop = presentationState.isVideoLooping ?? true;
    videoEl.muted = presentationState.isVideoMuted ?? false;
    videoEl.volume = presentationState.videoVolume ?? 1;

    if (presentationState.isVideoPlaying === false) {
      videoEl.pause();
    } else {
      videoEl.play().catch(() => {});
    }
  }, [
    presentationState.isVideoPlaying,
    presentationState.isVideoMuted,
    presentationState.isVideoLooping,
    presentationState.videoVolume,
    videoSrc
  ]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || presentationState.videoSeekTime === undefined) return;
    videoEl.currentTime = presentationState.videoSeekTime;
  }, [presentationState.videoSeekTime]);

  const handleTimeUpdate = () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    if (store.setGroupState) {
      store.setGroupState(groupId, {
        videoCurrentTime: videoEl.currentTime,
        videoDuration: videoEl.duration || 0,
      });
    }
  };

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    audioEl.loop = presentationState.isVideoLooping ?? true;
    audioEl.muted = presentationState.isVideoMuted ?? false;
    audioEl.volume = presentationState.videoVolume ?? 1;

    if (presentationState.isVideoPlaying === false) {
      audioEl.pause();
    } else {
      audioEl.play().catch(() => {});
    }
  }, [
    presentationState.isVideoPlaying,
    presentationState.isVideoMuted,
    presentationState.isVideoLooping,
    presentationState.videoVolume,
    audioSrc
  ]);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl || presentationState.videoSeekTime === undefined) return;
    audioEl.currentTime = presentationState.videoSeekTime;
  }, [presentationState.videoSeekTime]);

  const handleAudioTimeUpdate = () => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    if (store.setGroupState) {
      store.setGroupState(groupId, {
        videoCurrentTime: audioEl.currentTime,
        videoDuration: audioEl.duration || 0,
      });
    }
  };

  const isGradient = isLogoMode
    ? (logoStyles.backgroundType === 'gradient' && Boolean(logoStyles.backgroundGradient))
    : (resolvedStyles.backgroundType === 'gradient' && Boolean(resolvedStyles.backgroundGradient));

  const gradientVal = isLogoMode
    ? (logoStyles.backgroundGradient || resolvedStyles.backgroundGradient)
    : resolvedStyles.backgroundGradient;

  return (
    <div 
      ref={containerRef}
      className={`w-full h-full flex items-center justify-center relative overflow-hidden bg-[#0a0b0e] select-none ${className}`}
    >
      {/* Aspect-Locked Scaled Monitor Canvas Wrapper */}
      <div 
        className="relative bg-black rounded shadow-2xl overflow-hidden border border-[#2a2c36] shrink-0"
        style={{
          width: `${fittedWidth}px`,
          height: `${fittedHeight}px`,
        }}
      >
        {/* Full Native Virtual Display Canvas (Scaled via CSS Transform) */}
        <div
          data-canvas-preview="true"
          className="absolute top-0 left-0 origin-top-left overflow-hidden bg-black select-none pointer-events-none projector-canvas"
          style={{
            width: `${targetWidth}px`,
            height: `${targetHeight}px`,
            transform: `scale(${scale})`,
            fontFamily: resolvedStyles.fontFamily || 'Montserrat, sans-serif',
            background: isGradient ? gradientVal : (resolvedStyles.backgroundColor || '#000000'),
          }}
        >
          {/* Background Layer */}
          <div className="absolute inset-0 z-0">
            {isVideo && videoSrc ? (
              <video
                ref={videoRef}
                key={videoSrc}
                src={videoSrc}
                autoPlay
                loop={presentationState.isVideoLooping ?? true}
                muted={presentationState.isVideoMuted ?? false}
                playsInline
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleTimeUpdate}
                className={contentType === 'video' ? "w-full h-full object-contain relative z-10" : "w-full h-full object-cover"}
                style={{ 
                  filter: contentType === 'video'
                    ? 'none'
                    : ((isLogoMode ? logoStyles.backgroundBlur : resolvedStyles.backgroundBlur) ? `blur(${(isLogoMode ? logoStyles.backgroundBlur : resolvedStyles.backgroundBlur)}px)` : 'none')
                }}
              />
            ) : backgroundUrl ? (
              <div
                className="w-full h-full bg-cover bg-center transition-all duration-300"
                style={{ 
                  backgroundImage: `url(${backgroundUrl})`,
                  filter: (isLogoMode ? logoStyles.backgroundBlur : resolvedStyles.backgroundBlur || 5) ? `blur(${(isLogoMode ? logoStyles.backgroundBlur : resolvedStyles.backgroundBlur || 5)}px)` : 'none'
                }}
              />
            ) : isGradient ? (
              <div className="w-full h-full" style={{ background: gradientVal }} />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-slate-900 to-black" />
            )}

            {/* Tint Overlay */}
            {contentType !== 'video' && (
              <div 
                className="absolute inset-0"
                style={{
                  backgroundColor: (isLogoMode ? logoStyles.backgroundOverlayColor : resolvedStyles.backgroundOverlayColor) || '#000000',
                  opacity: (isLogoMode ? logoStyles.backgroundOverlayOpacity : resolvedStyles.backgroundOverlayOpacity) ?? 0.35
                }}
              />
            )}
          </div>

          {/* Top Corner Labels (Song Section Corner Badge or Scripture Reference) */}
          {currentSlide?.title && !presentationState.showLogo && (
            <>
              {/* Scripture Top Corner Reference */}
              {showReference && (
                <>
                  {refLocation === 'Top Right' && (
                    <div 
                      className="absolute top-8 right-10 z-20 px-5 py-2 bg-black/40 backdrop-blur-md rounded-md border border-white/10"
                      style={referenceStyles ? ThemeEngine.getTextStyle(referenceStyles, 1) : { color: '#E2E8F0', fontWeight: '700', fontSize: '24px' }}
                    >
                      {currentSlide.title}
                    </div>
                  )}
                  {refLocation === 'Top Left' && (
                    <div 
                      className="absolute top-8 left-10 z-20 px-5 py-2 bg-black/40 backdrop-blur-md rounded-md border border-white/10"
                      style={referenceStyles ? ThemeEngine.getTextStyle(referenceStyles, 1) : { color: '#E2E8F0', fontWeight: '700', fontSize: '24px' }}
                    >
                      {currentSlide.title}
                    </div>
                  )}
                </>
              )}

              {/* Song Top Corner Section Label */}
              {activeItem?.type === 'song' && showVerseChorusLabel && (
                <>
                  {songLabelLoc === 'Top Right' && (
                    <div 
                      className="absolute top-8 right-10 z-20 px-5 py-2 bg-black/50 backdrop-blur-md rounded-lg border border-white/15 drop-shadow-xl"
                      style={{ ...(labelStyles ? ThemeEngine.getTextStyle(labelStyles, 1) : { color: '#67E8F9', fontWeight: '700' }), fontSize: labelStyles?.fontSize ? `${labelStyles.fontSize}px` : '36px' }}
                    >
                      {formatSongLabel(currentSlide.title)}
                    </div>
                  )}
                  {songLabelLoc === 'Top Left' && (
                    <div 
                      className="absolute top-8 left-10 z-20 px-5 py-2 bg-black/50 backdrop-blur-md rounded-lg border border-white/15 drop-shadow-xl"
                      style={{ ...(labelStyles ? ThemeEngine.getTextStyle(labelStyles, 1) : { color: '#67E8F9', fontWeight: '700' }), fontSize: labelStyles?.fontSize ? `${labelStyles.fontSize}px` : '36px' }}
                    >
                      {formatSongLabel(currentSlide.title)}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Foreground Crisp Image Layer */}
          {contentType === 'image' && !presentationState.isClear && !presentationState.isBlack && !presentationState.showLogo && backgroundUrl && (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-0">
              <img 
                className="w-full h-full object-contain" 
                src={backgroundUrl} 
                alt={activeItem?.name || 'Image'}
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          {/* Foreground Audio Presentation Layer */}
          {contentType === 'audio' && !presentationState.isClear && !presentationState.isBlack && !presentationState.showLogo && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8 select-none">
              <audio
                ref={audioRef}
                key={audioSrc}
                src={audioSrc}
                autoPlay
                loop={presentationState.isVideoLooping ?? true}
                muted={presentationState.isVideoMuted ?? false}
                onTimeUpdate={handleAudioTimeUpdate}
                onLoadedMetadata={handleAudioTimeUpdate}
              />
              <div className="p-8 rounded-2xl bg-[#0e111a]/95 backdrop-blur-md border border-cyan-500/20 flex flex-col items-center w-full max-w-xl shadow-2xl relative overflow-hidden">
                {/* Decorative pulsing animated radar rings */}
                {presentationState.isVideoPlaying !== false && (
                  <div className="absolute -inset-10 flex items-center justify-center pointer-events-none opacity-20">
                    <div className="w-[300px] h-[300px] rounded-full border border-cyan-500 animate-ping absolute" style={{ animationDuration: '3s' }} />
                    <div className="w-[450px] h-[450px] rounded-full border border-cyan-400 animate-ping absolute" style={{ animationDuration: '4.5s' }} />
                  </div>
                )}
                
                {/* Music vinyl disk icon or stylized audio waveform */}
                <div className="relative w-32 h-32 flex items-center justify-center mb-6">
                  {/* Glowing ambient ring */}
                  <div className={`absolute inset-0 rounded-full bg-cyan-500/10 blur-xl transition-all duration-1000 ${presentationState.isVideoPlaying !== false ? 'scale-125 opacity-100' : 'scale-90 opacity-50'}`} />
                  
                  {/* Spinning/pulsing vinyl record or music visualizer */}
                  <div className={`w-28 h-28 rounded-full bg-gradient-to-tr from-[#161b26] to-[#0f131c] border-4 border-[#252f44] shadow-2xl flex items-center justify-center relative ${presentationState.isVideoPlaying !== false ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }}>
                    {/* Record grooves */}
                    <div className="absolute inset-2 rounded-full border border-dashed border-gray-700/40" />
                    <div className="absolute inset-4 rounded-full border border-[#1b2333]" />
                    <div className="absolute inset-6 rounded-full border border-dashed border-gray-700/20" />
                    <div className="absolute inset-8 rounded-full border border-[#1b2333]" />
                    {/* Record label */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600 to-cyan-400 border border-cyan-300/30 flex items-center justify-center shadow-inner z-10">
                      <div className="w-3 h-3 rounded-full bg-[#0a0b0e]" />
                    </div>
                  </div>

                  {/* Pulsing visualizer bars overlapping the disc */}
                  <div className="absolute -bottom-2 flex items-end justify-center gap-1.5 h-10 px-4 bg-black/60 backdrop-blur-md border border-[#232d3f] rounded-full z-20">
                    {[1, 2, 3, 4, 5, 6].map((i) => {
                      const delays = ['0s', '0.2s', '0.4s', '0.1s', '0.3s', '0.5s'];
                      const heights = ['h-3', 'h-6', 'h-8', 'h-5', 'h-7', 'h-4'];
                      return (
                        <div
                          key={i}
                          className={`w-1 rounded-t-sm bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] ${heights[i - 1]} ${presentationState.isVideoPlaying !== false ? 'animate-bounce' : 'opacity-60'}`}
                          style={{
                            animationDelay: delays[i - 1],
                            animationDuration: '0.8s',
                            transformOrigin: 'bottom',
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] font-black tracking-widest uppercase mb-3 shadow-xs">
                  SimpleWorship Audio Stream
                </span>
                
                <h2 className="text-xl md:text-2xl font-black text-gray-100 tracking-wide text-center truncate max-w-full px-4 drop-shadow-md">
                  {activeItem?.name || 'Audio Track'}
                </h2>

                <p className="text-xs text-gray-400 font-medium font-sans mt-1.5 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${presentationState.isVideoPlaying !== false ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  <span>{presentationState.isVideoPlaying !== false ? 'STREAMING ACTIVE' : 'STREAM MUTED'}</span>
                </p>

                {/* Progress Indicators */}
                <div className="mt-5 w-full flex items-center justify-between gap-3 text-[11px] font-mono text-cyan-400/80 bg-black/30 px-4 py-2 rounded-lg border border-white/5 shadow-inner">
                  <div className="flex items-center gap-1.5">
                    <span>PROGRESS:</span>
                    <span className="font-bold text-gray-200">{formatVideoTime(presentationState.videoCurrentTime || 0)}</span>
                  </div>
                  <span>/</span>
                  <div className="flex items-center gap-1.5">
                    <span>TOTAL:</span>
                    <span className="font-bold text-gray-200">{formatVideoTime(presentationState.videoDuration || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Presentation (PowerPoint / Deck) Slide Layer */}
          <AnimatePresence>
            {!presentationState.isClear && !presentationState.isBlack && !presentationState.showLogo && currentSlide && (contentType === 'pptx' || activeItem?.type === 'presentation' || activeItem?.type === 'ppt') && (
              <motion.div 
                key={isValidPptxBinary(activeItem?.data?.fileBytes) ? `preview-pptx-deck-${activeItem?.id || activeItem?.contentId || 'deck'}` : `preview-pptx-${currentSlide.id || presentationState.activeSlideIndex}`}
                initial={motionConfig.initial}
                animate={motionConfig.animate}
                exit={motionConfig.exit}
                transition={motionConfig.transition}
                className="absolute inset-0 z-10 w-full h-full overflow-hidden"
              >
                {isValidPptxBinary(activeItem?.data?.fileBytes) ? (
                  <PptxRenderOverlay
                    fileBytes={activeItem?.data?.fileBytes}
                    activeSlideIndex={presentationState.activeSlideIndex || 0}
                    fallbackContent={
                      <PresentationSlideView 
                        slide={currentSlide}
                        slideIndex={presentationState.activeSlideIndex || 0}
                        totalSlides={slides.length}
                        mode="full"
                        themeStyles={resolvedStyles}
                      />
                    }
                  />
                ) : (
                  <PresentationSlideView 
                    slide={currentSlide}
                    slideIndex={presentationState.activeSlideIndex || 0}
                    totalSlides={slides.length}
                    mode="full"
                    themeStyles={resolvedStyles}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Slide Content Layer with Margins for Songs, Scriptures, Announcements */}
          {!presentationState.isClear && !presentationState.isBlack && !presentationState.showLogo && currentSlide && contentType !== 'image' && contentType !== 'video' && contentType !== 'audio' && contentType !== 'pptx' && activeItem?.type !== 'presentation' && activeItem?.type !== 'ppt' && (
            <div 
              className="absolute inset-0 z-10 w-full h-full"
              style={{
                ...ThemeEngine.getContainerAlignmentStyle(resolvedStyles),
                paddingLeft: `${margins?.left || 0}px`,
                paddingTop: `${margins?.top || 0}px`,
                paddingRight: `${margins?.right || 0}px`,
                paddingBottom: `${margins?.bottom || 0}px`,
              }}
            >
              <div 
                className={ThemeEngine.getCardStyle(resolvedStyles).className}
                style={ThemeEngine.getCardStyle(resolvedStyles).style}
              >
                {/* Header: Song Section Label (if Header location) OR Scripture Reference (Before Each Slide) */}
                {currentSlide.title && (
                  (activeItem?.type === 'song' && showVerseChorusLabel && songLabelLoc === 'Header') ||
                  (activeItem?.type === 'bible' && showReference && refLocation === 'Before Each Slide')
                ) && (
                  <h2 
                    className="mb-4 text-cyan-300 font-bold tracking-wider opacity-90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] max-w-full"
                    style={{
                      ...(activeItem?.type === 'bible' && referenceStyles
                        ? ThemeEngine.getTextStyle(referenceStyles, 1)
                        : (labelStyles ? ThemeEngine.getTextStyle(labelStyles, 1) : {})),
                      fontSize: (activeItem?.type === 'bible' && referenceStyles?.fontSize)
                        ? `${referenceStyles.fontSize}px`
                        : (labelStyles?.fontSize ? `${labelStyles.fontSize}px` : '32px'),
                      fontFamily: (activeItem?.type === 'bible' && referenceStyles?.fontFamily)
                        ? referenceStyles.fontFamily
                        : (labelStyles?.fontFamily || resolvedStyles.fontFamily),
                      textAlign: resolvedStyles.textAlign || 'center',
                    }}
                  >
                    {activeItem?.type === 'song' ? formatSongLabel(currentSlide.title) : currentSlide.title}
                  </h2>
                )}

                {/* Main Slide Text */}
                {(() => {
                  const baseSize = ThemeEngine.normalizeFontSize(resolvedStyles.fontSize);

                  const isUpper = activeItem?.type === 'song'
                    ? (songOpts?.allCapsLyrics || songOpts?.songFont?.casing === 'uppercase')
                    : (activeItem?.type === 'bible' && scriptureOpts?.scriptureFont?.casing === 'uppercase');

                  const spacing = activeItem?.type === 'song'
                    ? (songOpts?.lineSpacing || songOpts?.songFont?.lineSpacing || 1.35)
                    : (activeItem?.type === 'bible' ? (scriptureOpts?.lineSpacing || scriptureOpts?.scriptureFont?.lineSpacing || 1.35) : 1.35);

                  const autoFitSize = ThemeEngine.calculateAutoFitFontSize({
                    text: currentSlide.text,
                    baseFontSize: baseSize,
                    hasHeader: Boolean(currentSlide.title && (
                      (activeItem?.type === 'song' && showVerseChorusLabel && songLabelLoc === 'Header') ||
                      (activeItem?.type === 'bible' && showReference && refLocation === 'Before Each Slide')
                    )),
                    hasFooter: Boolean(
                      (activeItem?.type === 'bible' && showReference && refLocation === 'After Each Slide' && currentSlide.title) ||
                      showCopyright
                    ),
                    scale: 1,
                    minFontSize: activeItem?.type === 'bible' ? (scriptureOpts?.minFontSize || 24) : (activeItem?.type === 'song' ? (songOpts?.minFontSize || 24) : 24),
                    maxFontSize: 160,
                    isUppercase: Boolean(isUpper),
                    lineSpacing: spacing,
                    margins: margins,
                  });

                  return (
                    <div 
                      className="whitespace-pre-line font-bold max-w-full leading-snug drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]"
                      style={{
                        ...ThemeEngine.getTextStyle(resolvedStyles, 1),
                        fontSize: `${autoFitSize}px`,
                        textTransform: isUpper ? 'uppercase' : undefined,
                        lineHeight: spacing,
                      }}
                    >
                      {activeItem?.type === 'bible' && currentSlide.verses && currentSlide.verses.length > 0 ? (
                        currentSlide.verses.map((v, idx) => (
                          <span key={v.verse} className="inline">
                            {(scriptureOpts?.showVerseNumbers ?? true) && (
                              <span 
                                className="font-bold inline-block mr-3 select-none transition-colors"
                                style={{ 
                                  color: scriptureOpts?.verseFont?.color || scriptureOpts?.verseColor || '#F6E05E',
                                  fontFamily: scriptureOpts?.verseFont?.family || scriptureOpts?.scriptureFont?.family || resolvedStyles.fontFamily || 'Tahoma, sans-serif',
                                  fontSize: `${Math.max(14, autoFitSize * 0.85)}px`
                                }}
                              >
                                {formatVerseNumber(v.verse, scriptureOpts?.verseNumberStyle)}
                              </span>
                            )}
                            <span>{v.text}</span>
                            {idx < currentSlide.verses!.length - 1 && '  '}
                          </span>
                        ))
                      ) : (
                        currentSlide.text
                      )}
                    </div>
                  );
                })()}

                {/* Footer: Scripture Reference (After Each Slide) */}
                {activeItem?.type === 'bible' && showReference && refLocation === 'After Each Slide' && currentSlide.title && (
                  <div 
                    className="mt-6 pt-2 font-bold max-w-full opacity-90"
                    style={{
                      ...(referenceStyles ? ThemeEngine.getTextStyle(referenceStyles, 1) : { color: '#E2E8F0', fontWeight: '700' }),
                      fontSize: referenceStyles?.fontSize ? `${referenceStyles.fontSize}px` : '26px',
                      fontFamily: referenceStyles?.fontFamily || resolvedStyles.fontFamily,
                      textAlign: (referenceStyles?.textAlign as any) || resolvedStyles.textAlign || 'right',
                    }}
                  >
                    {currentSlide.title}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom Corner Labels (Song Section Corner Badge or Scripture Reference) */}
          {currentSlide?.title && (
            <>
              {/* Scripture Bottom Corner */}
              {showReference && (
                <>
                  {refLocation === 'Bottom Right' && (
                    <div 
                      className="absolute bottom-8 right-10 z-20 px-5 py-2 bg-black/40 backdrop-blur-md rounded-md border border-white/10"
                      style={referenceStyles ? ThemeEngine.getTextStyle(referenceStyles, 1) : { color: '#E2E8F0', fontWeight: '700', fontSize: '24px' }}
                    >
                      {currentSlide.title}
                    </div>
                  )}
                  {refLocation === 'Bottom Left' && (
                    <div 
                      className="absolute bottom-8 left-10 z-20 px-5 py-2 bg-black/40 backdrop-blur-md rounded-md border border-white/10"
                      style={referenceStyles ? ThemeEngine.getTextStyle(referenceStyles, 1) : { color: '#E2E8F0', fontWeight: '700', fontSize: '24px' }}
                    >
                      {currentSlide.title}
                    </div>
                  )}
                </>
              )}

              {/* Song Bottom Corner Section Label */}
              {activeItem?.type === 'song' && showVerseChorusLabel && (
                <>
                  {songLabelLoc === 'Bottom Right' && (
                    <div 
                      className="absolute bottom-8 right-10 z-20 px-5 py-2 bg-black/50 backdrop-blur-md rounded-lg border border-white/15 drop-shadow-xl"
                      style={{ ...(labelStyles ? ThemeEngine.getTextStyle(labelStyles, 1) : { color: '#67E8F9', fontWeight: '700' }), fontSize: labelStyles?.fontSize ? `${labelStyles.fontSize}px` : '36px' }}
                    >
                      {formatSongLabel(currentSlide.title)}
                    </div>
                  )}
                  {songLabelLoc === 'Bottom Left' && (
                    <div 
                      className="absolute bottom-8 left-10 z-20 px-5 py-2 bg-black/50 backdrop-blur-md rounded-lg border border-white/15 drop-shadow-xl"
                      style={{ ...(labelStyles ? ThemeEngine.getTextStyle(labelStyles, 1) : { color: '#67E8F9', fontWeight: '700' }), fontSize: labelStyles?.fontSize ? `${labelStyles.fontSize}px` : '36px' }}
                    >
                      {formatSongLabel(currentSlide.title)}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Standby State (When no content or slide is currently live and not in logo mode) */}
          {!currentSlide && !presentationState.isBlack && !presentationState.isClear && !presentationState.showLogo && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center select-none bg-black">
              <div className="p-8 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 flex flex-col items-center max-w-lg shadow-2xl">
                <SimpleWorshipLogo size={56} showText={true} subtitle={group?.name || "Live Display Screen"} />
                <div className="mt-5 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-sm font-bold tracking-wider">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>STANDBY • LIVE MONITOR READY</span>
                </div>
                <p className="mt-3 text-xs text-gray-400 font-sans leading-relaxed">
                  Double-click any item in Schedule or click "GO LIVE" to project lyrics, scriptures, or media to this screen.
                </p>
                <div className="mt-3 flex items-center gap-2 text-[11px] font-mono text-gray-500 bg-black/40 px-3 py-1 rounded border border-white/5">
                  <span>Target: {group?.displayIds?.join(', ') || 'Monitor Output'}</span>
                  <span>•</span>
                  <span>{targetWidth}×{targetHeight} ({aspectLabel})</span>
                </div>
              </div>
            </div>
          )}

          {/* Copyright Notice (Positioned according to copyrightPosition) */}
          {showCopyright && !presentationState.showLogo && (
            <div 
              className={`absolute z-20 px-4 py-1.5 bg-black/40 backdrop-blur-sm rounded border border-white/5 max-w-xl ${
                copyrightPos === 'Bottom Right' ? 'bottom-6 right-8 text-right' :
                copyrightPos === 'Bottom Center' ? 'bottom-6 left-1/2 -translate-x-1/2 text-center' :
                copyrightPos === 'Top Left' ? 'top-6 left-8 text-left' :
                copyrightPos === 'Top Right' ? 'top-6 right-8 text-right' :
                'bottom-6 left-8 text-left'
              }`}
              style={{ ...(copyrightStyles ? ThemeEngine.getTextStyle(copyrightStyles, 0.6) : { color: '#A0AEC0' }), fontSize: copyrightStyles?.fontSize ? `${Math.max(10, copyrightStyles.fontSize * 0.6)}px` : '16px' }}
            >
              {songOpts?.licenseInfo || 'CCLI License #1234567'}
            </div>
          )}

          {/* Master Logo Splash Mode or Theme Watermark */}
          {!presentationState.isBlack && (
            presentationState.showLogo ? (
              (logoStyles.logoUrl && logoStyles.logoUrl !== backgroundUrl) ? (
                <div className="absolute inset-0 z-30 flex items-center justify-center p-8 pointer-events-none">
                  <img
                    src={logoStyles.logoUrl}
                    alt="Logo"
                    className="max-w-[50%] max-h-[50%] object-contain drop-shadow-2xl"
                    style={{
                      opacity: logoStyles.logoOpacity ?? 1,
                      width: logoStyles.logoSize ? `${logoStyles.logoSize * 2}px` : undefined,
                    }}
                  />
                </div>
              ) : null
            ) : (resolvedStyles.showLogo && resolvedStyles.logoUrl) ? (
              <div 
                className={`absolute z-20 flex items-center gap-2 px-3.5 py-2 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 shadow-lg ${
                  resolvedStyles.logoPosition === 'top-left' ? 'top-8 left-8' :
                  resolvedStyles.logoPosition === 'top-right' ? 'top-8 right-8' :
                  resolvedStyles.logoPosition === 'bottom-left' ? 'bottom-8 left-8' :
                  resolvedStyles.logoPosition === 'top-center' ? 'top-8 left-1/2 -translate-x-1/2' :
                  resolvedStyles.logoPosition === 'bottom-center' ? 'bottom-8 left-1/2 -translate-x-1/2' :
                  'bottom-8 right-8'
                }`}
                style={{ opacity: resolvedStyles.logoOpacity ?? 0.85 }}
              >
                <img src={resolvedStyles.logoUrl} alt="Logo" className="h-7 w-auto object-contain" />
              </div>
            ) : null
          )}

          {/* Slide Annotation Layer (Semi-transparent vector overlay that persists across transitions) */}
          {!presentationState.isBlack && (
            <SlideAnnotationLayer 
              interactive={true} 
              stageWidth={targetWidth}
              stageHeight={targetHeight}
              className="z-35"
            />
          )}

          {/* Marquee Alert Banner */}
          {alert.active && !presentationState.isBlack && (
            <div 
              className="absolute left-0 right-0 z-40 py-4 px-8 overflow-hidden shadow-2xl border-y-2 border-amber-400"
              style={{
                bottom: alert.position === 'bottom' ? 0 : 'auto',
                top: alert.position === 'top' ? 0 : 'auto',
                backgroundColor: alert.backgroundColor || 'rgba(15, 23, 42, 0.96)',
                color: alert.textColor || '#FACC15',
              }}
            >
              <div className="text-2xl font-bold whitespace-nowrap flex items-center gap-4">
                <span className="px-3 py-1 rounded bg-amber-500 text-black text-base font-black uppercase tracking-wider">
                  ALERT
                </span>
                <span>{alert.message}</span>
              </div>
            </div>
          )}

          {/* Camera Live Renderer */}
          {activeItem?.type === 'camera' && activeItem.data?.deviceId && (
            <div 
              className="absolute inset-0 z-25 transition-opacity duration-300 pointer-events-none"
              style={{ opacity: presentationState.isBlack ? 0 : 1 }}
            >
              <CameraLiveRenderer 
                deviceId={activeItem.data.deviceId}
                isBlack={presentationState.isBlack}
                isClear={presentationState.isClear}
                showLogo={presentationState.showLogo}
                logoUrl={systemOptions?.mainOutput?.general?.disableLogoOnLive ? undefined : (resolvedStyles.backgroundImageUrl)}
                isLiveOutput={false}
              />
            </div>
          )}

          {/* Nursery Alert Badge Overlay */}
          {alert.showNursery && (alert.nurseryText || systemOptions?.mainOutput?.alerts?.nursery?.currentCode) && !presentationState.isBlack && (
            <div 
              className={`absolute z-40 px-3 py-1.5 rounded-lg shadow-xl font-bold flex items-center gap-2 border border-white/20 animate-pulse ${
                systemOptions?.mainOutput?.alerts?.nursery?.location === 'Top Left' ? 'top-4 left-4' :
                systemOptions?.mainOutput?.alerts?.nursery?.location === 'Bottom Left' ? 'bottom-4 left-4' :
                systemOptions?.mainOutput?.alerts?.nursery?.location === 'Bottom Right' ? 'bottom-4 right-4' : 'top-4 right-4'
              }`}
              style={{
                backgroundColor: systemOptions?.mainOutput?.alerts?.nursery?.backgroundColor || '#FF0000',
                color: systemOptions?.mainOutput?.alerts?.nursery?.font?.color || '#FFFFFF',
                fontSize: `${Math.min(22, systemOptions?.mainOutput?.alerts?.nursery?.font?.maxSize || 22)}px`,
                fontFamily: systemOptions?.mainOutput?.alerts?.nursery?.font?.family || 'Tahoma, sans-serif'
              }}
            >
              <span className="text-[10px] uppercase tracking-wider bg-black/40 px-1.5 py-0.5 rounded text-white font-mono">NURSERY</span>
              <span>{alert.nurseryText || systemOptions?.mainOutput?.alerts?.nursery?.currentCode}</span>
            </div>
          )}

          {/* Clear State - Text is already hidden above, keep clean display */}

          {/* Blackout Overlay */}
          {presentationState.isBlack && (
            <div className="absolute inset-0 z-50 bg-black transition-opacity duration-200" />
          )}
        </div>

        {/* Resolution & Ratio Indicator Tag */}
        {showResolutionTag && (
          <div className="absolute bottom-1 right-1.5 z-30 pointer-events-none flex items-center gap-1.5">
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/75 text-gray-400 border border-white/10 backdrop-blur-xs">
              {targetWidth}×{targetHeight} ({aspectLabel})
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

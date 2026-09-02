import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { PresentationCore } from '../core/PresentationCore';
import { ThemeEngine } from '../core/ThemeEngine';
import { Sparkles } from 'lucide-react';
import { SimpleWorshipLogo } from './SimpleWorshipLogo';
import { subscribeToBroadcast } from '../utils/broadcastSync';
import { formatVerseNumber } from '../utils/scriptureFormatter';
import { PptxRenderOverlay } from './PptxRenderOverlay';

interface ProjectorViewProps {
  groupId: string;
}

export default function ProjectorView({ groupId }: ProjectorViewProps) {
  const store = useStore();
  const { groupStates, activeSchedule, songsList, themesList, outputGroups, alert, loadAllData, systemOptions } = store;

  useEffect(() => {
    loadAllData();

    // Subscribe to cross-window BroadcastChannel and Storage events for real-time live synchronization
    const unsubscribe = subscribeToBroadcast((msg) => {
      if (msg.type === 'GROUP_STATES_UPDATE' || msg.type === 'GO_LIVE') {
        if (msg.data && msg.data.groupStates) {
          useStore.setState((prev) => ({
            groupStates: { ...prev.groupStates, ...msg.data.groupStates }
          }));
        }
      }
      if (msg.type === 'SCHEDULE_UPDATE' && msg.data && msg.data.activeSchedule) {
        useStore.setState({ activeSchedule: msg.data.activeSchedule });
      }
      if ((msg.type === 'SYSTEM_UPDATE' || msg.type === 'SYSTEM_OPTIONS') && msg.data) {
        if (msg.data.systemOptions) useStore.setState({ systemOptions: msg.data.systemOptions });
        else if (msg.type === 'SYSTEM_OPTIONS') useStore.setState({ systemOptions: msg.data });
        if (msg.data.themesList) useStore.setState({ themesList: msg.data.themesList });
      }
      if (msg.type === 'ALERT_UPDATE' && msg.data && msg.data.alert) {
        useStore.setState({ alert: msg.data.alert });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const transitionSettings = systemOptions?.mainOutput?.transitions || { duration: 500, easing: 'easeInOut' };
  // Fallback map for motion easing values if needed, but motion accepts standard string values like easeInOut
  const fadeDuration = (transitionSettings.duration || 500) / 1000;
  const fadeEasing = transitionSettings.easing || 'easeInOut';

  const group = outputGroups.find(g => g.id === groupId) || outputGroups[0];
  const presentationState = groupStates[groupId] || {
    activeScheduleId: null,
    activeItemId: null,
    activeSlideIndex: 0,
    nextSlideIndex: 1,
    isBlack: false,
    isClear: false,
    showLogo: false,
    timestamp: Date.now(),
  };

  const activeItem = PresentationCore.getActiveContent(activeSchedule, presentationState);
  const slides = activeItem ? PresentationCore.generateSlides(activeItem, songsList, systemOptions) : [];
  const currentSlide = slides[presentationState.activeSlideIndex] || null;

  // Resolve Theme specifically for this output group and content
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

  const generalOpts = systemOptions?.mainOutput?.general;
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

  let isVideo = false;
  let videoSrc = '';
  let backgroundUrl = '';

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
      activeItem?.type === 'image' ||
      (activeItem?.type === 'media' && activeItem.data?.isVideo === false) ||
      (activeItem?.type === 'media' && activeItem.data?.type === 'image')
    );

    const isExplicitVideoItem = (
      activeItem?.type === 'video' ||
      (activeItem?.type === 'media' && activeItem.data?.isVideo === true) ||
      (activeItem?.type === 'media' && (activeItem.data?.type === 'video' || activeItem.data?.type === 'motion'))
    );

    if (slideBgUrl) {
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

  const isGradient = isLogoMode
    ? (logoStyles.backgroundType === 'gradient' && Boolean(logoStyles.backgroundGradient))
    : (resolvedStyles.backgroundType === 'gradient' && Boolean(resolvedStyles.backgroundGradient));

  const gradientVal = isLogoMode
    ? (logoStyles.backgroundGradient || resolvedStyles.backgroundGradient)
    : resolvedStyles.backgroundGradient;

  return (
    <div 
      data-canvas-preview="true"
      className="w-screen h-screen overflow-hidden relative bg-black select-none projector-canvas"
      style={{
        fontFamily: resolvedStyles.fontFamily || 'Montserrat, sans-serif',
        background: isGradient ? gradientVal : (resolvedStyles.backgroundColor || '#000000'),
      }}
    >
      {/* Background Media Layer */}
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
            className="w-full h-full object-cover"
            style={{ filter: (isLogoMode ? logoStyles.backgroundBlur : resolvedStyles.backgroundBlur) ? `blur(${(isLogoMode ? logoStyles.backgroundBlur : resolvedStyles.backgroundBlur)}px)` : 'none' }}
          />
        ) : backgroundUrl ? (
          <div
            className="w-full h-full bg-cover bg-center transition-all duration-300"
            style={{ 
              backgroundImage: `url(${backgroundUrl})`,
              filter: (isLogoMode ? logoStyles.backgroundBlur : resolvedStyles.backgroundBlur) ? `blur(${(isLogoMode ? logoStyles.backgroundBlur : resolvedStyles.backgroundBlur)}px)` : 'none'
            }}
          />
        ) : isGradient ? (
          <div className="w-full h-full" style={{ background: gradientVal }} />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-slate-900 to-black" />
        )}

        {/* Dimmer / Tint Overlay */}
        <div 
          className="absolute inset-0"
          style={{
            backgroundColor: (isLogoMode ? logoStyles.backgroundOverlayColor : resolvedStyles.backgroundOverlayColor) || '#000000',
            opacity: (isLogoMode ? logoStyles.backgroundOverlayOpacity : resolvedStyles.backgroundOverlayOpacity) ?? 0.35
          }}
        />
      </div>

      {/* Top Corner Labels (Song Section Corner Badge or Scripture Reference) */}
      {currentSlide?.title && !presentationState.showLogo && (
        <>
          {/* Scripture Top Corner */}
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
                  className="absolute top-8 right-10 z-20 px-5 py-2 bg-black/50 backdrop-blur-md rounded-lg border border-white/15 drop-shadow-xl font-bold"
                  style={{ ...(labelStyles ? ThemeEngine.getTextStyle(labelStyles, 1) : { color: '#67E8F9', fontWeight: '700' }), fontSize: labelStyles?.fontSize ? `${labelStyles.fontSize}px` : '36px' }}
                >
                  {formatSongLabel(currentSlide.title)}
                </div>
              )}
              {songLabelLoc === 'Top Left' && (
                <div 
                  className="absolute top-8 left-10 z-20 px-5 py-2 bg-black/50 backdrop-blur-md rounded-lg border border-white/15 drop-shadow-xl font-bold"
                  style={{ ...(labelStyles ? ThemeEngine.getTextStyle(labelStyles, 1) : { color: '#67E8F9', fontWeight: '700' }), fontSize: labelStyles?.fontSize ? `${labelStyles.fontSize}px` : '36px' }}
                >
                  {formatSongLabel(currentSlide.title)}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Slide Content Layer */}
      <AnimatePresence>
        {!presentationState.isClear && !presentationState.isBlack && !presentationState.showLogo && currentSlide && !(activeItem?.type === 'presentation' && activeItem.data?.fileBytes) && (
          <motion.div 
            key={currentSlide.id || presentationState.activeSlideIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: fadeDuration, ease: fadeEasing }}
            className="absolute inset-0 z-10 w-full h-full"
            style={ThemeEngine.getContainerAlignmentStyle(resolvedStyles, generalOpts?.margins)}
          >
            <div 
              className={ThemeEngine.getCardStyle(resolvedStyles).className}
              style={ThemeEngine.getCardStyle(resolvedStyles).style}
            >
              {/* Verse / Chorus Label or Scripture Reference Header (Before Each Slide) */}
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
                      : (labelStyles?.fontSize ? `${labelStyles.fontSize}px` : 'clamp(1.2rem, 3vw, 2.2rem)'),
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
                  margins: generalOpts?.margins,
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
                    fontSize: referenceStyles?.fontSize ? `${referenceStyles.fontSize}px` : 'clamp(1rem, 2.5vw, 1.8rem)',
                    fontFamily: referenceStyles?.fontFamily || resolvedStyles.fontFamily,
                    textAlign: (referenceStyles?.textAlign as any) || resolvedStyles.textAlign || 'right',
                  }}
                >
                  {currentSlide.title}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  className="absolute bottom-8 right-10 z-20 px-5 py-2 bg-black/50 backdrop-blur-md rounded-lg border border-white/15 drop-shadow-xl font-bold"
                  style={{ ...(labelStyles ? ThemeEngine.getTextStyle(labelStyles, 1) : { color: '#67E8F9', fontWeight: '700' }), fontSize: labelStyles?.fontSize ? `${labelStyles.fontSize}px` : '36px' }}
                >
                  {formatSongLabel(currentSlide.title)}
                </div>
              )}
              {songLabelLoc === 'Bottom Left' && (
                <div 
                  className="absolute bottom-8 left-10 z-20 px-5 py-2 bg-black/50 backdrop-blur-md rounded-lg border border-white/15 drop-shadow-xl font-bold"
                  style={{ ...(labelStyles ? ThemeEngine.getTextStyle(labelStyles, 1) : { color: '#67E8F9', fontWeight: '700' }), fontSize: labelStyles?.fontSize ? `${labelStyles.fontSize}px` : '36px' }}
                >
                  {formatSongLabel(currentSlide.title)}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Copyright Notice Overlay (Positioned according to copyrightPosition) */}
      {showCopyright && !presentationState.showLogo && (
        <div 
          className={`absolute z-20 px-3 py-1 bg-black/40 backdrop-blur-sm rounded border border-white/5 max-w-xl ${
            copyrightPos === 'Bottom Right' ? 'bottom-6 right-8 text-right' :
            copyrightPos === 'Bottom Center' ? 'bottom-6 left-1/2 -translate-x-1/2 text-center' :
            copyrightPos === 'Top Left' ? 'top-6 left-8 text-left' :
            copyrightPos === 'Top Right' ? 'top-6 right-8 text-right' :
            'bottom-6 left-8 text-left'
          }`}
          style={{ ...(copyrightStyles ? ThemeEngine.getTextStyle(copyrightStyles, 0.6) : { color: '#A0AEC0' }), fontSize: copyrightStyles?.fontSize ? `${Math.max(10, copyrightStyles.fontSize * 0.6)}px` : '12px' }}
        >
          {songOpts?.licenseInfo || 'CCLI License #1234567'}
        </div>
      )}

      {/* Master Logo Splash Mode or Theme Watermark */}
      {!presentationState.isBlack && (
        presentationState.showLogo ? (
          (logoStyles.logoUrl && logoStyles.logoUrl !== backgroundUrl) ? (
            <div className="absolute inset-0 z-30 flex items-center justify-center p-12 pointer-events-none">
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

      {/* Marquee Alert Banner Overlay */}
      {alert.active && !presentationState.isBlack && (
        <div 
          className="absolute left-0 right-0 z-40 py-3 px-8 overflow-hidden shadow-2xl border-y-2 border-amber-400"
          style={{
            bottom: alert.position === 'bottom' ? 0 : 'auto',
            top: alert.position === 'top' ? 0 : 'auto',
            backgroundColor: alert.backgroundColor || 'rgba(15, 23, 42, 0.96)',
            color: alert.textColor || '#FACC15',
          }}
        >
          <div className="text-lg md:text-xl font-bold whitespace-nowrap animate-marquee flex items-center gap-3">
            <span className="px-2.5 py-0.5 rounded bg-amber-500 text-black text-sm font-black uppercase tracking-wider">
              ALERT
            </span>
            <span>{alert.message}</span>
          </div>
        </div>
      )}

      {/* PPTX Native Render Overlay */}
      {activeItem?.type === 'presentation' && activeItem.data?.fileBytes && (
        <div 
          className="absolute inset-0 z-30 pointer-events-none transition-opacity duration-300"
          style={{ 
            opacity: presentationState.showLogo || presentationState.isClear || presentationState.isBlack ? 0 : 1 
          }}
        >
           <PptxRenderOverlay 
              fileBytes={activeItem.data.fileBytes}
              activeSlideIndex={presentationState.activeSlideIndex}
           />
        </div>
      )}

      {/* Nursery Alert Badge Overlay */}
      {(alert.showNursery || systemOptions?.mainOutput?.alerts?.nursery?.enabled) && (alert.nurseryText || systemOptions?.mainOutput?.alerts?.nursery?.currentCode) && !presentationState.isBlack && (
        <div 
          className={`absolute z-40 px-4 py-2 rounded-lg shadow-2xl font-bold flex items-center gap-2 border border-white/20 animate-pulse ${
            systemOptions?.mainOutput?.alerts?.nursery?.location === 'Top Left' ? 'top-6 left-6' :
            systemOptions?.mainOutput?.alerts?.nursery?.location === 'Bottom Left' ? 'bottom-6 left-6' :
            systemOptions?.mainOutput?.alerts?.nursery?.location === 'Bottom Right' ? 'bottom-6 right-6' : 'top-6 right-6'
          }`}
          style={{
            backgroundColor: systemOptions?.mainOutput?.alerts?.nursery?.backgroundColor || '#FF0000',
            color: systemOptions?.mainOutput?.alerts?.nursery?.font?.color || '#FFFFFF',
            fontSize: `${Math.min(32, systemOptions?.mainOutput?.alerts?.nursery?.font?.maxSize || 32)}px`,
            fontFamily: systemOptions?.mainOutput?.alerts?.nursery?.font?.family || 'Tahoma, sans-serif'
          }}
        >
          <span className="text-xs uppercase tracking-wider bg-black/40 px-2 py-0.5 rounded text-white font-mono">NURSERY</span>
          <span>{alert.nurseryText || systemOptions?.mainOutput?.alerts?.nursery?.currentCode}</span>
        </div>
      )}

      {/* Black Screen Layer */}
      <AnimatePresence>
        {presentationState.isBlack && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: fadeDuration, ease: fadeEasing }}
            className="absolute inset-0 z-50 bg-black"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

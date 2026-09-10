import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { PresentationCore } from '../core/PresentationCore';
import { ThemeEngine } from '../core/ThemeEngine';
import { Sparkles, WifiOff, Music, Volume2 } from 'lucide-react';
import { subscribeToBroadcast, broadcastStateChange } from '../utils/broadcastSync';
import { formatVerseNumber } from '../utils/scriptureFormatter';
import { PresentationState } from '../types';
import { PresentationContentResolver } from '../core/PresentationContentResolver';
import { resolveDisplayAssignments } from '../core/DisplayRouter';
import { DisplayManager } from '../core/DisplayManager';
import { useScreens } from '../hooks/useScreens';
import CameraLiveRenderer from './CameraLiveRenderer';
import { PresentationSlideView } from './PresentationSlideView';
import { PptxRenderOverlay } from './PptxRenderOverlay';
import { useSlideRenderCache, getSlideRenderKey } from '../utils/SlideRenderCache';
import { toValidPptxUint8Array } from '../utils/pptxValidator';
import { isValidPptxBinary } from '../utils/pptxValidator';
import { SlideTransitionManager } from '../core/SlideTransitionManager';
import { SlideAnnotationLayer } from './SlideAnnotationLayer';
import { MediaStreamController } from '../core/MediaStreamController';
import { dbApi } from '../db';
import { TelemetryManager } from '../utils/TelemetryManager';
import { resolveGroupResolution, buildRenderFrame } from '../core/RenderFrameBuilder';
import { PresentationCanvas } from './presentation/PresentationCanvas';

interface ProjectorViewProps {
  groupId: string;
  displayId?: string;
}

export default function ProjectorView({ groupId: initialGroupId, displayId }: ProjectorViewProps) {
  const store = useStore();
  const { groupStates, activeSchedule, songsList, themesList, outputGroups, alert, groupAlerts, loadAllData, systemOptions, activeControlGroupId } = store;
  const [routedGroupId, setRoutedGroupId] = React.useState<string>(initialGroupId);
  
  const { screens } = useScreens();
  const [identifyActive, setIdentifyActive] = React.useState(false);

  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let timer: any;
    const handleLocalIdentify = () => {
      setIdentifyActive(true);
      clearTimeout(timer);
      timer = setTimeout(() => {
        setIdentifyActive(false);
      }, 3000);
    };

    window.addEventListener('simpleworship:identify-displays', handleLocalIdentify);
    return () => {
      window.removeEventListener('simpleworship:identify-displays', handleLocalIdentify);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    // Automatically attempt fullscreen for target monitor presentation mirrors
    const attemptFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (e) {
        console.warn('Auto-fullscreen blocked by browser:', e);
      }
    };
    
    // Attempt immediately and also on any first user interaction (to bypass some browser blocks)
    attemptFullscreen();
    const interactionHandler = () => {
      attemptFullscreen();
      window.removeEventListener('click', interactionHandler);
      window.removeEventListener('keydown', interactionHandler);
    };
    window.addEventListener('click', interactionHandler);
    window.addEventListener('keydown', interactionHandler);
    
    return () => {
      window.removeEventListener('click', interactionHandler);
      window.removeEventListener('keydown', interactionHandler);
    };
  }, []);

  useEffect(() => {
    loadAllData();
    broadcastStateChange({ type: 'REQUEST_STATE', data: null });

    const cleanupRouteListener = DisplayManager.listenToProjectorRouteChanged((data) => {
      if (!displayId || data.displayId === displayId) {
        setRoutedGroupId(data.groupId);
      }
    });

    // View-specific broadcast subscription (Global store syncing is handled cleanly by initSync)
    const unsubscribe = subscribeToBroadcast((msg) => {
      if (msg.type === 'IDENTIFY_DISPLAYS') {
        setIdentifyActive(true);
        setTimeout(() => setIdentifyActive(false), 3000);
      }
    });

    return () => {
      cleanupRouteListener();
      unsubscribe();
    };
  }, [displayId]);

  // Find index of this screen in screens list to show the accurate monitor index tag
  const screenIndex = React.useMemo(() => {
    if (!displayId) return 1;
    const matchIdx = screens.findIndex(
      (scr: any, sIdx: number) => {
        const sLabel = String(scr.label || scr.name || scr.id || '').toLowerCase().trim();
        const targetId = String(displayId).toLowerCase().trim();
        if (!sLabel || !targetId) return false;
        if (sLabel === targetId || sLabel.includes(targetId) || targetId.includes(sLabel)) return true;

        // Smart positional index fallbacks
        if (targetId.includes('primary') && scr.isPrimary) return true;
        if ((targetId.includes('2') || targetId.includes('secondary') || targetId.includes('alternate')) && sIdx === 1) return true;
        if ((targetId.includes('3') || targetId.includes('foldback') || targetId.includes('stage')) && sIdx === 2) return true;

        return false;
      }
    );
    if (matchIdx !== -1) return matchIdx + 1;
    
    if (displayId.toLowerCase().includes('foldback')) return 3;
    if (displayId.toLowerCase().includes('alternate')) return 2;
    return 1;
  }, [screens, displayId]);

  // Resolves the single WINNING active group targeting this physical display for STRICT 1:1 Solid Mapping
  const orderedLiveGroupIds = React.useMemo(() => {
    let list: string[] = [];
    if (displayId && outputGroups.length > 0) {
      const assignments = resolveDisplayAssignments(outputGroups, groupStates, activeControlGroupId, [displayId]);
      const match = assignments.get(displayId);
      if (match && match.assignedGroupId) {
        // STRICT 1-TO-1 MAPPING: We only render the single winning assigned group! 
        // We do NOT render multiple transparent overlay layers.
        list = [match.assignedGroupId];
      }
    }

    // FALLBACK: If no live group matched this display (or displayId is not passed/unassigned),
    // mirror the active control group or routed group so target monitor is NEVER black!
    if (list.length === 0) {
      const fallbackGroup = routedGroupId || initialGroupId || activeControlGroupId || outputGroups[0]?.id || 'group-congregation';
      list = [fallbackGroup];
    }
    
    return list;
  }, [displayId, outputGroups, groupStates, activeControlGroupId, routedGroupId, initialGroupId]);

  // Global blackout state (active if the winning target group is black)
  const isBlackoutActive = React.useMemo(() => {
    if (orderedLiveGroupIds.length === 0) return false;
    const winningGroupId = orderedLiveGroupIds[orderedLiveGroupIds.length - 1];
    const winState = groupStates[winningGroupId];
    if (winState && (winState.isBlack || !winState.isLiveEnabled)) {
      return true;
    }
    return false;
  }, [orderedLiveGroupIds, groupStates]);

  const baseGroupObj = outputGroups.find(g => g.id === orderedLiveGroupIds[0]) || outputGroups[0];
  const winningGroup = outputGroups.find(g => g.id === orderedLiveGroupIds[orderedLiveGroupIds.length - 1]) || outputGroups[0];

  const currentAlert = (winningGroup && groupAlerts?.[winningGroup.id]) || alert || { active: false, showNursery: false, message: '', nurseryText: '' };

  // 1. Get current target resolution and aspect ratio configured on the active output route
  const groupRes = React.useMemo(() => {
    return resolveGroupResolution(winningGroup || baseGroupObj, systemOptions);
  }, [winningGroup, baseGroupObj, systemOptions]);

  // 2. Adjust aspect ratio to PowerPoint deck template ratio if active item is a slide deck
  const isPptx = React.useMemo(() => {
    const activeItem = orderedLiveGroupIds.length > 0
      ? PresentationCore.getActiveContent(
          activeSchedule,
          groupStates[orderedLiveGroupIds[orderedLiveGroupIds.length - 1]],
          groupStates[orderedLiveGroupIds[orderedLiveGroupIds.length - 1]]?.directLiveItem
        )
      : null;
    return activeItem?.type === 'presentation' || activeItem?.type === 'ppt';
  }, [orderedLiveGroupIds, activeSchedule, groupStates]);

  const activeItem = React.useMemo(() => {
    if (orderedLiveGroupIds.length === 0) return null;
    const winningGroupId = orderedLiveGroupIds[orderedLiveGroupIds.length - 1];
    return PresentationCore.getActiveContent(
      activeSchedule,
      groupStates[winningGroupId],
      groupStates[winningGroupId]?.directLiveItem
    );
  }, [orderedLiveGroupIds, activeSchedule, groupStates]);

  const slides = React.useMemo(() => {
    return activeItem ? PresentationCore.generateSlides(activeItem, songsList, systemOptions) : [];
  }, [activeItem, songsList, systemOptions]);

  const activeSlideState = orderedLiveGroupIds.length > 0 ? groupStates[orderedLiveGroupIds[orderedLiveGroupIds.length - 1]] : null;
  const currentSlide = React.useMemo(() => {
    return activeSlideState ? slides[activeSlideState.activeSlideIndex] : null;
  }, [activeSlideState, slides]);

  const templateAspectRatio = currentSlide?.aspectRatio || activeItem?.data?.aspectRatio;
  const aspectRatio = (isPptx && templateAspectRatio && templateAspectRatio > 0) ? templateAspectRatio : groupRes.aspectRatio;

  // 3. Compute fitted box dimensions with letterbox/pillarbox inside windowSize
  const { width: fittedWidth } = React.useMemo(() => {
    const availWidth = windowSize.width;
    const availHeight = windowSize.height;
    const containerAspect = availWidth / availHeight;
    
    let w = availWidth;
    let h = availHeight;
    
    if (containerAspect > aspectRatio) {
      // Height is the constraint
      h = availHeight;
      w = Math.round(h * aspectRatio);
    } else {
      // Width is the constraint
      w = availWidth;
      h = Math.round(w / aspectRatio);
    }
    
    return { width: w, height: h };
  }, [windowSize, aspectRatio]);

  const scale = fittedWidth / groupRes.width;

  return (
    <div 
      data-canvas-preview="true"
      className="w-screen h-screen overflow-hidden relative bg-black select-none projector-canvas flex items-center justify-center"
      style={{
        transform: 'translate3d(0, 0, 0)',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
    >
      <div
        className="relative overflow-hidden bg-black select-none shrink-0"
        style={{
          width: groupRes.width,
          height: groupRes.height,
          transform: `scale(${scale}) translate3d(0, 0, 0)`,
          transformOrigin: 'center center',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      >
        {/* 1. Multi-Layer Transparent Presentation Stacking */}
        {orderedLiveGroupIds.map((gId, index) => {
          const isBaseLayer = index === 0;
          const currentGroupObj = outputGroups.find(g => g.id === gId) || outputGroups[0];
          return (
            <ProjectorLayer
              key={gId}
              groupId={gId}
              displayId={displayId}
              isBaseLayer={isBaseLayer}
              group={currentGroupObj}
              songsList={songsList}
              themesList={themesList}
              systemOptions={systemOptions}
              activeSchedule={activeSchedule}
              screens={screens}
            />
          );
        })}

        {/* 2. Slide Annotation Layer */}
        {!isBlackoutActive && orderedLiveGroupIds.length > 0 && (
          <SlideAnnotationLayer 
            groupId={winningGroup?.id}
            interactive={false} 
            className="z-35"
          />
        )}

        {/* 3. Marquee Alert Banner Overlay */}
        {currentAlert.active && !isBlackoutActive && (!currentAlert.targetGroupIds || currentAlert.targetGroupIds.length === 0 || (winningGroup?.id && currentAlert.targetGroupIds.includes(winningGroup.id))) && (
          <div 
            className="absolute left-0 right-0 z-40 py-3 px-8 overflow-hidden shadow-2xl border-y-2 border-amber-400"
            style={{
              bottom: currentAlert.position === 'bottom' ? 0 : 'auto',
              top: currentAlert.position === 'top' ? 0 : 'auto',
              backgroundColor: currentAlert.backgroundColor || 'rgba(15, 23, 42, 0.96)',
              color: currentAlert.textColor || '#FACC15',
            }}
          >
            <div className="text-lg md:text-xl font-bold whitespace-nowrap animate-marquee flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded bg-amber-500 text-black text-sm font-black uppercase tracking-wider">
                ALERT
              </span>
              <span>{currentAlert.message}</span>
            </div>
          </div>
        )}

        {/* 4. Nursery Alert Badge Overlay */}
        {currentAlert.showNursery && (currentAlert.nurseryText || systemOptions?.mainOutput?.alerts?.nursery?.currentCode) && !isBlackoutActive && (!currentAlert.targetGroupIds || currentAlert.targetGroupIds.length === 0 || (winningGroup?.id && currentAlert.targetGroupIds.includes(winningGroup.id))) && (
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
            <span>{currentAlert.nurseryText || systemOptions?.mainOutput?.alerts?.nursery?.currentCode}</span>
          </div>
        )}

        {/* 5. Master Black Screen curtain */}
        <AnimatePresence>
          {isBlackoutActive && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-50 bg-black"
            />
          )}
        </AnimatePresence>
      </div>

      {/* 6. Visual Identification Overlay for connected monitors */}
      <AnimatePresence>
        {identifyActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-[999999] flex items-center justify-center bg-black/60 backdrop-blur-sm select-none pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.85, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 10 }}
              transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              className={`p-10 rounded-2xl border-2 text-center shadow-2xl bg-[#0e1015]/95 backdrop-blur-md max-w-sm ${
                displayId?.toLowerCase().includes('foldback')
                  ? 'border-amber-500 shadow-amber-950/45'
                  : displayId?.toLowerCase().includes('alternate')
                  ? 'border-purple-500 shadow-purple-950/45'
                  : 'border-cyan-500 shadow-cyan-950/45'
              }`}
            >
              <div className="text-[130px] font-black leading-none font-mono tracking-tight text-white select-none">
                {screenIndex}
              </div>
              <div className="mt-3 text-sm font-extrabold uppercase tracking-widest text-gray-300">
                {displayId?.toLowerCase().includes('foldback')
                  ? 'Foldback / Stage Output'
                  : displayId?.toLowerCase().includes('alternate')
                  ? 'Alternate Output'
                  : 'Main Worship Output'}
              </div>
              <div className="mt-2 text-xs font-mono text-cyan-400">
                {window.innerWidth} × {window.innerHeight} Pixels
              </div>
              <div className="mt-4 px-3 py-1.5 rounded bg-black/50 text-[10px] text-gray-400 font-sans tracking-wide">
                Active Display Target: {displayId || 'Primary Display'}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ProjectorLayerProps {
  groupId: string;
  displayId?: string;
  isBaseLayer: boolean;
  group: any;
  songsList: any[];
  themesList: any[];
  systemOptions: any;
  activeSchedule: any;
  screens: any[];
}

function ProjectorLayer({ 
  groupId, 
  displayId, 
  isBaseLayer, 
  group,
  songsList,
  themesList,
  systemOptions,
  activeSchedule,
  screens
}: ProjectorLayerProps) {
  const store = useStore();
  const { groupStates, stagedGroupStates } = store;
  
  const presentationState = groupStates[groupId] || stagedGroupStates[groupId] || ({
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

  const activeItem = PresentationCore.getActiveContent(
    activeSchedule, 
    presentationState, 
    presentationState.directLiveItem
  ) || (presentationState.activeItemId ? songsList.find(s => s.id === presentationState.activeItemId) : null) || null;

  const slides = activeItem ? PresentationCore.generateSlides(activeItem, songsList, systemOptions) : [];
  const currentSlide = slides[presentationState.activeSlideIndex] || null;

  const transitionSettings = systemOptions?.mainOutput?.transitions || { duration: 500, easing: 'easeInOut' };
  const fadeDuration = (transitionSettings.duration || 500) / 1000;
  const fadeEasing = (transitionSettings.easing || 'easeInOut') as any;

  // Direction-aware push animations
  const prevSlideIndexRef = useRef(0);
  const currentSlideIndex = presentationState?.activeSlideIndex || 0;
  const isForward = currentSlideIndex >= prevSlideIndexRef.current;

  useEffect(() => {
    prevSlideIndexRef.current = currentSlideIndex;
  }, [currentSlideIndex]);

  const activeTransition = SlideTransitionManager.resolveTransition(currentSlide, systemOptions);
  const motionConfig = SlideTransitionManager.getMotionConfig(activeTransition, isForward);

  const globalTheme = themesList.find(t => t.type === 'global') || themesList[0];
  const groupTheme = themesList.find(t => t.id === group?.themeId);
  const itemContentType = (activeItem?.type as any) === 'ppt' ? 'presentation' : ((activeItem?.type as any) === 'scripture' ? 'bible' : activeItem?.type);
  const typeTheme = themesList.find(t => t.type === itemContentType || t.type === activeItem?.type || (itemContentType === 'presentation' && t.id === 'theme-presentation') || (itemContentType === 'bible' && t.id === 'theme-scripture') || (itemContentType === 'song' && t.id === 'theme-song') || (itemContentType === 'announcement' && t.id === 'theme-announcement'));

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

  const layerRes = resolveGroupResolution(group, systemOptions);
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

  let isVideo = false;
  let videoSrc = '';
  let backgroundUrl = '';
  let audioSrc = '';

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

  if (isLogoMode) {
    const defaultLogo = (systemOptions as any)?.general?.defaultLogoUrl || (systemOptions as any)?.mainOutput?.general?.defaultLogoUrl || logoStyles.backgroundImageUrl || logoStyles.logoUrl || resolvedStyles.backgroundImageUrl || '';
    if ((logoStyles.backgroundType === 'video' && logoStyles.backgroundVideoUrl) || PresentationContentResolver.isVideoUrl(defaultLogo) || (logoStyles.backgroundVideoUrl && PresentationContentResolver.isVideoUrl(logoStyles.backgroundVideoUrl))) {
      isVideo = true;
      videoSrc = logoStyles.backgroundVideoUrl || defaultLogo;
    } else {
      isVideo = false;
      backgroundUrl = defaultLogo;
    }
  } else {
    const slideBgUrl = currentSlide?.backgroundUrl;
    const slideIsVideo = currentSlide?.isVideo;

    if (contentType === 'pptx' && !slideBgUrl) {
      isVideo = false;
      videoSrc = '';
      backgroundUrl = '';
    } else if (contentType === 'audio') {
      isVideo = false;
      audioSrc = activeItem?.data?.url || activeItem?.customBackgroundUrl || '';
      backgroundUrl = resolvedStyles.backgroundImageUrl || '';
    } else {
      const effectiveBgUrl = slideBgUrl || activeItem?.customBackgroundUrl;

      if (effectiveBgUrl) {
        if (slideIsVideo === true || isExplicitVideoItem || isVideoUrl(effectiveBgUrl) || PresentationContentResolver.isVideoUrl(effectiveBgUrl)) {
          isVideo = true;
          videoSrc = effectiveBgUrl;
        } else {
          isVideo = false;
          backgroundUrl = effectiveBgUrl;
        }
      } else {
        if (!isExplicitImageItem && (resolvedStyles.backgroundType === 'video' || Boolean(resolvedStyles.backgroundVideoUrl))) {
          isVideo = true;
          videoSrc = resolvedStyles.backgroundVideoUrl || '';
        } else {
          isVideo = false;
          backgroundUrl = resolvedStyles.backgroundImageUrl || '';
        }
      }
    }
  }

  const [localBackgroundUrl, setLocalBackgroundUrl] = useState<string>('');
  const [localLogoUrl, setLocalLogoUrl] = useState<string>('');
  const [localAudioSrc, setLocalAudioSrc] = useState<string>('');
  const [managedVideoSrc, setManagedVideoSrc] = useState<string | null>(null);

  const mediaControllerRef = useRef<MediaStreamController | null>(null);
  if (!mediaControllerRef.current) {
    mediaControllerRef.current = new MediaStreamController();
  }
  const mediaController = mediaControllerRef.current;

  useEffect(() => {
    return () => {
      mediaController.dispose();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    // Fast synchronous lookup from assetsList or cache
    const currentAssets = useStore.getState().assetsList || [];
    const matchedAsset = currentAssets.find(a => a.url === backgroundUrl || (a as any)._oldUrl === backgroundUrl || a.id === backgroundUrl || (activeItem?.contentId && a.id === activeItem.contentId));
    if (matchedAsset?.url) {
      setLocalBackgroundUrl(matchedAsset.url);
    } else if (backgroundUrl) {
      setLocalBackgroundUrl(backgroundUrl);
    }

    if (activeItem?.contentId) {
      const cachedAudio = audioSrc && audioSrc.startsWith('blob:') ? dbApi.getCachedUrl(activeItem.contentId) : null;
      if (cachedAudio) setLocalAudioSrc(cachedAudio);
    }
    
    const resolveUrl = async (url: string, contentId?: string): Promise<string> => {
      if (!url) return '';
      const assets = useStore.getState().assetsList || [];
      const directAsset = assets.find(a => a.url === url || (a as any)._oldUrl === url || a.id === url);
      if (directAsset?.url) return directAsset.url;
      if (contentId) {
        const byId = assets.find(a => a.id === contentId);
        if (byId?.url) return byId.url;
        const cached = dbApi.getCachedUrl(contentId);
        if (cached) return cached;
        try {
          const asset = await dbApi.getAsset(contentId);
          if (asset?.url) return asset.url;
        } catch (e) {}
      }
      return url;
    };

    const rawLogoUrl = resolvedStyles.logoUrl || logoStyles.logoUrl || (systemOptions as any)?.general?.defaultLogoUrl || '';
    resolveUrl(backgroundUrl, activeItem?.contentId).then(resolved => {
      if (isMounted && resolved) {
        setLocalBackgroundUrl(resolved);
      }
    });
    if (rawLogoUrl) {
      resolveUrl(rawLogoUrl, undefined).then(resolved => {
        if (isMounted && resolved) {
          setLocalLogoUrl(resolved);
        }
      });
    }
    resolveUrl(audioSrc, activeItem?.contentId).then(resolved => {
      if (isMounted && resolved) {
        setLocalAudioSrc(resolved);
      }
    });

    return () => { 
      isMounted = false; 
    };
  }, [backgroundUrl, audioSrc, activeItem?.contentId, resolvedStyles.logoUrl, logoStyles.logoUrl]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (isVideo && (isExplicitVideoItem ? activeItem?.contentId : videoSrc)) {
      TelemetryManager.mark('projector-video-load-start');
      mediaController.replace(
        isExplicitVideoItem ? activeItem?.contentId : undefined,
        videoSrc
      ).then(url => {
        setManagedVideoSrc(url);
        TelemetryManager.measure('Projector Video Load', 'projector-video-load-start');
        TelemetryManager.recordMediaOperation();
      });
    } else {
      mediaController.dispose();
      setManagedVideoSrc(null);
    }
  }, [isVideo, activeItem?.contentId, videoSrc, isExplicitVideoItem]);

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
    localAudioSrc
  ]);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl || presentationState.videoSeekTime === undefined) return;
    audioEl.currentTime = presentationState.videoSeekTime;
  }, [presentationState.videoSeekTime]);

  const isGradient = isLogoMode
    ? (logoStyles.backgroundType === 'gradient' && Boolean(logoStyles.backgroundGradient))
    : (resolvedStyles.backgroundType === 'gradient' && Boolean(resolvedStyles.backgroundGradient));

  const gradientVal = isLogoMode
    ? (logoStyles.backgroundGradient || resolvedStyles.backgroundGradient)
    : resolvedStyles.backgroundGradient;

  const isLiveActive = Boolean(presentationState.isLiveEnabled);

  const computedRenderFrame = buildRenderFrame(
    groupId,
    presentationState,
    activeSchedule,
    group,
    systemOptions,
    songsList,
    themesList,
    screens
  );

  return (
    <div 
      className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none bg-black"
      style={{
        transform: 'translate3d(0, 0, 0)',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        fontFamily: resolvedStyles.fontFamily || 'Montserrat, sans-serif'
      }}
    >
      {/* Background Media Layer (Only rendered if isBaseLayer is TRUE to allow transparent layering) */}
      {isBaseLayer && (
        <div 
          className="absolute inset-0 z-0 pointer-events-auto"
          style={{
            transform: 'translate3d(0, 0, 0)',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {isVideo && (managedVideoSrc || videoSrc) ? (
            <video
              ref={videoRef}
              src={managedVideoSrc || videoSrc}
              autoPlay
              loop={presentationState.isVideoLooping ?? true}
              muted={presentationState.isVideoMuted ?? false}
              playsInline
              preload="auto"
              className={contentType === 'video' ? "w-full h-full object-contain relative z-10" : "w-full h-full object-cover"}
              style={{ 
                transform: 'translate3d(0, 0, 0)',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                filter: 'none'
              }}
            />
          ) : localBackgroundUrl ? (
            <div
              className="w-full h-full bg-cover bg-center transition-all duration-300"
              style={{ 
                transform: 'translate3d(0, 0, 0)',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                backgroundImage: `url(${localBackgroundUrl})`,
                filter: (isLogoMode ? (logoStyles.backgroundBlur || 0) : (resolvedStyles.backgroundBlur || 0)) > 0
                  ? `blur(${isLogoMode ? logoStyles.backgroundBlur : resolvedStyles.backgroundBlur}px)`
                  : 'none'
              }}
            />
          ) : isGradient ? (
            <div className="w-full h-full" style={{ background: gradientVal }} />
          ) : (
            <div className="w-full h-full bg-black" />
          )}

          {/* Dimmer / Tint Overlay */}
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
      )}

      {/* Top Corner Labels (Song Section Corner Badge or Scripture Reference) */}
      {currentSlide && !presentationState.isClear && !presentationState.isBlack && !presentationState.showLogo && (
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

      {/* Foreground Crisp Image Layer */}
      {contentType === 'image' && !presentationState.isClear && !presentationState.isBlack && !presentationState.showLogo && localBackgroundUrl && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-0 animate-fade-in">
          <img 
            className="w-full h-full object-contain" 
            src={localBackgroundUrl} 
            alt={activeItem?.name || 'Image'}
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* Foreground Audio Presentation Layer */}
      {contentType === 'audio' && !presentationState.isClear && !presentationState.isBlack && !presentationState.showLogo && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8">
          <audio
            ref={audioRef}
            src={localAudioSrc}
            autoPlay
            loop={presentationState.isVideoLooping ?? true}
            muted={presentationState.isVideoMuted ?? false}
          />
          <div className="p-8 rounded-2xl bg-[#0e111a]/95 backdrop-blur-md border border-cyan-500/20 flex flex-col items-center w-full max-w-xl shadow-2xl relative overflow-hidden">
            {presentationState.isVideoPlaying !== false && (
              <div className="absolute -inset-10 flex items-center justify-center pointer-events-none opacity-20">
                <div className="w-[300px] h-[300px] rounded-full border border-cyan-500 animate-ping absolute" style={{ animationDuration: '3s' }} />
                <div className="w-[450px] h-[450px] rounded-full border border-cyan-400 animate-ping absolute" style={{ animationDuration: '4.5s' }} />
              </div>
            )}
            
            <div className="relative w-32 h-32 flex items-center justify-center mb-6">
              <div className={`absolute inset-0 rounded-full bg-cyan-500/10 blur-xl transition-all duration-1000 ${presentationState.isVideoPlaying !== false ? 'scale-125 opacity-100' : 'scale-90 opacity-50'}`} />
              <div className={`w-28 h-28 rounded-full bg-gradient-to-tr from-[#161b26] to-[#0f131c] border-4 border-[#252f44] shadow-2xl flex items-center justify-center relative ${presentationState.isVideoPlaying !== false ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }}>
                <div className="absolute inset-2 rounded-full border border-dashed border-gray-700/40" />
                <div className="absolute inset-4 rounded-full border border-[#1b2333]" />
                <div className="absolute inset-6 rounded-full border border-dashed border-gray-700/20" />
                <div className="absolute inset-8 rounded-full border border-[#1b2333]" />
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600 to-cyan-400 border border-cyan-300/30 flex items-center justify-center shadow-inner z-10">
                  <div className="w-3 h-3 rounded-full bg-[#0a0b0e]" />
                </div>
              </div>

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

      {/* Slide Content Layer */}
      <AnimatePresence>
        {/* Presentation Slide Layer */}
        {!presentationState.isClear && !presentationState.isBlack && !presentationState.showLogo && currentSlide && (contentType === 'pptx' || activeItem?.type === 'presentation' || activeItem?.type === 'ppt') && !activeItem?.data?.isNativeRasterized && (
          <motion.div 
            key={`pptx-deck-${activeItem?.id || activeItem?.contentId || 'deck'}`}
            initial={motionConfig.initial}
            animate={motionConfig.animate}
            exit={motionConfig.exit}
            transition={motionConfig.transition}
            style={{
              transform: 'translate3d(0, 0, 0)',
              willChange: 'transform',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
            className="absolute inset-0 z-10 w-full h-full overflow-hidden"
          >
            <PptxRenderOverlay
              fileBytes={activeItem?.data?.fileBytes}
              contentId={activeItem?.contentId}
              activeSlideIndex={presentationState.activeSlideIndex || 0}
            />
          </motion.div>
        )}

        {/* Worship Text Slide Content Layer */}
        {!presentationState.isClear && !presentationState.isBlack && !presentationState.showLogo && currentSlide && contentType !== 'image' && contentType !== 'video' && contentType !== 'audio' && contentType !== 'pptx' && activeItem?.type !== 'presentation' && activeItem?.type !== 'ppt' && (
          <motion.div 
            key={currentSlide.id || presentationState.activeSlideIndex}
            initial={motionConfig.initial}
            animate={motionConfig.animate}
            exit={motionConfig.exit}
            transition={motionConfig.transition}
            style={{
              transform: 'translate3d(0, 0, 0)',
              willChange: 'transform',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
            className="absolute inset-0 z-10 w-full h-full"
          >
            {computedRenderFrame ? (
              <PresentationCanvas 
                frame={computedRenderFrame}
                scale={1}
                systemOptions={systemOptions}
              />
            ) : (
              <PresentationSlideView
                slide={currentSlide}
                slideIndex={presentationState.activeSlideIndex || 0}
                themeStyles={resolvedStyles}
                mode="full"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Corner Labels */}
      {currentSlide && !presentationState.showLogo && !presentationState.isClear && !presentationState.isBlack && (
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

      {/* Copyright Notice Overlay */}
      {showCopyright && !presentationState.showLogo && !presentationState.isClear && !presentationState.isBlack && (
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
          (!localBackgroundUrl && !videoSrc && !isGradient) ? (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-12 pointer-events-none">
              <div className="flex flex-col items-center justify-center gap-4 text-cyan-400 drop-shadow-2xl animate-in fade-in zoom-in-95 duration-300">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-cyan-600/30 to-cyan-400/20 border-2 border-cyan-400/50 flex items-center justify-center backdrop-blur-md shadow-2xl">
                  <Sparkles className="w-12 h-12 text-cyan-300 animate-pulse" />
                </div>
                <span className="text-2xl font-black tracking-wider uppercase text-white drop-shadow-md">
                  {(systemOptions as any)?.general?.organizationName || 'SimpleWorship'}
                </span>
              </div>
            </div>
          ) : null
        ) : (resolvedStyles.showLogo && localLogoUrl) ? (
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
            <img src={localLogoUrl} alt="Logo" className="h-7 w-auto object-contain" />
          </div>
        ) : null
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
            isLiveOutput={true}
          />
        </div>
      )}
    </div>
  );
}

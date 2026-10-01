import '../utils/initPptxViewer';
import React, { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { SlideCanvas, useViewerBuildingBlocks, PowerPointViewerHandle } from 'pptx-react-viewer';
import { useAnimationPlayback } from 'pptx-react-viewer/internals';
import 'pptx-react-viewer/styles';
import { toValidPptxUint8Array, isValidPptxBinary } from '../utils/pptxValidator';
import { extractFontsFromPptx, ensurePptxFontsLoaded, scanPptxFontsDetailed } from '../utils/pptxFontManager';
import { useStore } from '../store/useStore';
import { Slide, ThemeStyles } from '../types';
import { PresentationSlideView } from './PresentationSlideView';
import { getSlideEntranceElementIds, buildMergedPresentationElementStates } from '../utils/pptxAnimationUtils';
import { PptxBackendSelector, PptxPresentationSession, PptxRenderCacheManager, CanonicalSlideRender } from '../utils/pptxBackend';

interface PptxRenderOverlayProps {
  fileBytes?: Uint8Array | ArrayBuffer | any;
  contentId?: string;
  isThumbnail?: boolean;
  isProjectorMode?: boolean;
  isOverlayLayer?: boolean;
  pptxAction?: 'next' | 'prev' | null;
  pptxActionTimestamp?: number;
  pptxAnimationGroupIndex?: number;
  onAnimationGroupChange?: (index: number) => void;
  onActiveSlideChange?: (index: number) => void;
  activeSlideIndex: number;
  currentSlide?: Slide | null;
  themeStyles?: ThemeStyles;
  targetWidth?: number;
  targetHeight?: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
}
class PptxErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }
  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[PptxRenderOverlay] Caught rendering error gracefully:', error, errorInfo);
  }
  override componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false });
    }
  }
  override render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

interface PptxViewerInnerProps {
  bytes: Uint8Array;
  activeSlideIndex: number;
  contentId?: string;
  isThumbnail?: boolean;
  isProjectorMode?: boolean;
  isOverlayLayer?: boolean;
  pptxAction?: 'next' | 'prev' | null;
  pptxActionTimestamp?: number;
  pptxAnimationGroupIndex?: number;
  onAnimationGroupChange?: (index: number) => void;
  onActiveSlideChange?: (index: number) => void;
  currentSlide?: Slide | null;
  themeStyles?: ThemeStyles;
  targetWidth?: number;
  targetHeight?: number;
}

const PptxViewerInner: React.FC<PptxViewerInnerProps> = React.memo(({ 
  bytes, 
  activeSlideIndex, 
  contentId,
  isThumbnail, 
  isProjectorMode, 
  isOverlayLayer,
  pptxAction, 
  pptxActionTimestamp, 
  pptxAnimationGroupIndex,
  onAnimationGroupChange,
  onActiveSlideChange, 
  currentSlide, 
  themeStyles,
  targetWidth,
  targetHeight,
}) => {
  const handleRef = useRef<PowerPointViewerHandle>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const lastReportedSlideRef = useRef<number>(-1);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>(() => ({
    width: targetWidth || (isThumbnail ? 280 : 1920),
    height: targetHeight || (isThumbnail ? 158 : 1080),
  }));
  const [slideCount, setSlideCount] = useState<number>(1);
  const [allSlidesState, setAllSlidesState] = useState<any[]>([]);
  const [, setFontLoadTick] = useState<number>(0);
  const [powerPointSession, setPowerPointSession] = useState<PptxPresentationSession | null>(() => {
    return PptxRenderCacheManager.getCanonicalSession(contentId || 'deck');
  });
  const pptxEngineMode = useStore(state => state.systemOptions?.mainOutput?.presentations?.pptxEngineMode || 'auto');

  // React to canonical session updates dispatched globally
  useEffect(() => {
    const handleUpdate = () => {
      const session = PptxRenderCacheManager.getCanonicalSession(contentId || 'deck');
      if (session && session.backendUsed === 'powerpoint') {
        setPowerPointSession(session);
      } else if (session && session.backendUsed === 'native') {
        setPowerPointSession(null);
      }
    };
    window.addEventListener('simpleworship:canonical-frame-updated', handleUpdate);
    return () => window.removeEventListener('simpleworship:canonical-frame-updated', handleUpdate);
  }, [contentId]);

  // Proactively check and load presentation via PowerPoint Hardware-Accelerated Backend if configured
  useEffect(() => {
    if (!bytes) return;
    let isSubscribed = true;

    if (pptxEngineMode === 'native') {
      setPowerPointSession(null);
      return;
    }

    PptxBackendSelector.loadPresentation(contentId || 'deck', bytes, pptxEngineMode)
      .then((session) => {
        if (isSubscribed && session && session.backendUsed === 'powerpoint' && session.slides.length > 0) {
          setPowerPointSession(session);
          PptxRenderCacheManager.registerCanonicalSession(session, [contentId || 'deck']);
        } else if (isSubscribed && session && session.backendUsed === 'native') {
          setPowerPointSession(null);
          PptxRenderCacheManager.registerCanonicalSession(session, [contentId || 'deck']);
        }
      })
      .catch((e) => {
        // Safe fallback - native engine will continue
        console.warn('[PptxRenderOverlay] PowerPoint backend load error:', e);
        if (isSubscribed) {
          setPowerPointSession(null);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [bytes, contentId, pptxEngineMode]);

  // Proactively extract and register fonts from PPTX binary (for Canva & custom fonts)
  useEffect(() => {
    if (!bytes) return;
    let isSubscribed = true;
    extractFontsFromPptx(bytes).then((fonts) => {
      if (isSubscribed && fonts.length > 0) {
        ensurePptxFontsLoaded(fonts).catch(() => {});
      }
    }).catch(() => {});

    // Proactively scan for missing fonts and auto-trigger 1-Click installer if opened in active presentation view
    if (!isThumbnail && !isProjectorMode) {
      scanPptxFontsDetailed(bytes).then((fontScan) => {
        if (!isSubscribed) return;
        if (fontScan.missingFonts.length > 0) {
          window.dispatchEvent(new CustomEvent('simpleworship:open-font-installer', {
            detail: {
              presentationName: 'PPTX Presentation',
              scanResult: fontScan,
              autoTriggered: true,
            }
          }));
        }
      }).catch(() => {});
    }

    return () => {
      isSubscribed = false;
    };
  }, [bytes, isThumbnail, isProjectorMode]);

  // Listen for font load completion to trigger repaint
  useEffect(() => {
    const handler = () => {
      setFontLoadTick(t => t + 1);
    };
    window.addEventListener('simpleworship:pptx-fonts-loaded', handler);
    window.addEventListener('simpleworship:fonts-updated', handler);
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(handler).catch(() => {});
    }
    return () => {
      window.removeEventListener('simpleworship:pptx-fonts-loaded', handler);
      window.removeEventListener('simpleworship:fonts-updated', handler);
    };
  }, []);

  const containerCallbackRef = useCallback((el: HTMLDivElement | null) => {
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }
    containerRef.current = el;
    if (!el) return;

    // Immediately measure synchronous client rect to prevent zero-scale rendering
    const rect = el.getBoundingClientRect();
    const w = el.clientWidth || Math.round(rect.width);
    const h = el.clientHeight || Math.round(rect.height);
    if (w > 0 && h > 0) {
      setContainerSize(prev => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    }

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setContainerSize(prev => (prev.width === Math.round(width) && prev.height === Math.round(height) ? prev : { width: Math.round(width), height: Math.round(height) }));
      }
    });

    ro.observe(el);
    roRef.current = ro;
  }, []);

  useEffect(() => {
    return () => {
      if (roRef.current) {
        roRef.current.disconnect();
        roRef.current = null;
      }
    };
  }, []);

  const initialSyncComplete = useRef(false);
  const targetSlideLock = useRef<{ index: number, ts: number } | null>(null);

  const handleSlideChange = useCallback((index: number) => {
    if (!initialSyncComplete.current) return;

    if (targetSlideLock.current) {
      const isStale = Date.now() - targetSlideLock.current.ts > 1000;
      if (index === targetSlideLock.current.index || isStale) {
        // Lock resolved deterministically or timed out
        targetSlideLock.current = null;
      } else {
        // Ignore spurious events from the worker while it is seeking to our target
        return;
      }
    }

    if (lastReportedSlideRef.current === index) return;
    lastReportedSlideRef.current = index;

    if (isProjectorMode) return; // Prevent projector from emitting state back to moderator
    onActiveSlideChange?.(index);
  }, [onActiveSlideChange, isProjectorMode]);

  const handleSlideCountChange = useCallback((count: number) => {
    if (count > 0) {
      setSlideCount(count);
    }
  }, []);

  const blocks = useViewerBuildingBlocks({
    content: bytes,
    canEdit: false,
    onActiveSlideChange: handleSlideChange,
    onSlideCountChange: handleSlideCountChange,
    handle: handleRef,
  });

  // Query and cache all slides from handleRef as soon as loaded
  useEffect(() => {
    if (handleRef.current && typeof handleRef.current.getSlides === 'function') {
      try {
        const hSlides = handleRef.current.getSlides();
        if (Array.isArray(hSlides) && hSlides.length > 0) {
          setAllSlidesState(hSlides);
          setSlideCount(hSlides.length);
        }
      } catch (e) {}
    }
  }, [blocks.loading, bytes]);

  const slides = useMemo(() => {
    if (allSlidesState.length > 0) return allSlidesState;
    if (handleRef.current && typeof handleRef.current.getSlides === 'function') {
      try {
        const hSlides = handleRef.current.getSlides();
        if (Array.isArray(hSlides) && hSlides.length > 0) return hSlides;
      } catch (e) {}
    }
    const canvasAllSlides = (blocks.canvasProps as any)?.allSlides || (blocks.canvasProps as any)?.slides;
    if (Array.isArray(canvasAllSlides) && canvasAllSlides.length > 0) return canvasAllSlides;
    if (blocks.canvasProps?.activeSlide) return [blocks.canvasProps.activeSlide];
    return [];
  }, [allSlidesState, blocks.canvasProps, blocks.loading]);

  // Cache parsed deck data for instant reuse by all thumbnails
  useEffect(() => {
    if (slides.length > 0 && blocks.canvasProps && !blocks.loading && !blocks.error) {
      const cWidth = blocks.canvasProps?.canvasSize?.width || 960;
      const cHeight = blocks.canvasProps?.canvasSize?.height || 540;
      const cachedDeckData: CachedPptxDeck = {
        slides,
        canvasProps: blocks.canvasProps,
        canvasWidth: cWidth,
        canvasHeight: cHeight,
        timestamp: Date.now()
      };
      if (contentId) {
        pptxDeckSharedCache.set(contentId, cachedDeckData);
        window.dispatchEvent(new CustomEvent('simpleworship:pptx-deck-cached', { detail: { contentId } }));
      }
      if (bytes && typeof bytes === 'object') {
        pptxRawDeckCache.set(bytes, cachedDeckData);
      }
    }
  }, [contentId, bytes, slides, blocks.canvasProps, blocks.loading, blocks.error]);

  const {
    presentationElementStates,
    presentationKeyframesCss,
    playNextAnimationGroup,
    runPresentationEntranceAnimations,
    seedSlideAnimations,
    startSlideAnimations,
    clearPresentationTimers,
  } = useAnimationPlayback({
    slides,
    showWithAnimation: !isThumbnail,
    canvasSize: blocks.canvasProps?.canvasSize,
    themeColorMap: (blocks.canvasProps as any)?.themeColorMap
  });

  // Stable playback methods ref to eliminate re-render loops
  const playbackRef = useRef({
    clearPresentationTimers,
    seedSlideAnimations,
    startSlideAnimations,
    playNextAnimationGroup,
  });
  playbackRef.current = {
    clearPresentationTimers,
    seedSlideAnimations,
    startSlideAnimations,
    playNextAnimationGroup,
  };

  const effectiveActiveSlide = useMemo(() => {
    if (slides && slides[activeSlideIndex]) {
      return slides[activeSlideIndex];
    }
    return blocks.canvasProps?.activeSlide;
  }, [slides, activeSlideIndex, blocks.canvasProps?.activeSlide]);

  // Synchronously compute entrance element IDs for the active slide
  const slideEntranceIds = useMemo(() => {
    return getSlideEntranceElementIds(effectiveActiveSlide);
  }, [effectiveActiveSlide]);

  // Merge presentation states: guarantees that from frame 0 of entering a slide,
  // any element with entrance animations is HIDDEN immediately (no flash of text).
  const mergedElementStates = useMemo(() => {
    return buildMergedPresentationElementStates(
      presentationElementStates,
      slideEntranceIds,
      Boolean(isThumbnail)
    );
  }, [presentationElementStates, slideEntranceIds, isThumbnail]);

  // Synchronously seed and schedule slide animations immediately upon slide index change
  useLayoutEffect(() => {
    if (isThumbnail || !slides || slides.length === 0) return;

    try {
      playbackRef.current.clearPresentationTimers();
      playbackRef.current.seedSlideAnimations(activeSlideIndex);

      if (pptxAnimationGroupIndex && pptxAnimationGroupIndex > 0) {
        // Fast-forward to the desired animation group state (e.g. stepping backwards or syncing)
        for (let i = 0; i < pptxAnimationGroupIndex; i++) {
          playbackRef.current.playNextAnimationGroup();
        }
      } else {
        // Auto-play opening withPrevious / afterPrevious groups if authored,
        // while all on-click entrance animations remain guaranteed hidden until user clicks!
        if (typeof playbackRef.current.startSlideAnimations === 'function') {
          playbackRef.current.startSlideAnimations(activeSlideIndex);
        }
      }
    } catch (e) {
      console.warn('[PptxRenderOverlay] seedSlideAnimations error:', e);
    }

    return () => {
      playbackRef.current.clearPresentationTimers();
    };
  }, [activeSlideIndex, isThumbnail, pptxAnimationGroupIndex, slides?.length]);

  // Mouse wheel listener with discrete debounced stepping
  
  const lastProcessedActionTsRef = useRef<number | null>(null);

  // Synchronized animation / slide action handler
  useEffect(() => {
    if (!pptxActionTimestamp || pptxActionTimestamp === lastProcessedActionTsRef.current) return;
    lastProcessedActionTsRef.current = pptxActionTimestamp;

    if (pptxAction === 'next') {
      if (isThumbnail) {
        handleSlideChange(activeSlideIndex + 1);
        return;
      }

      // Step 1: Attempt to trigger next animation/effect group inside current slide
      let playedAnimation = false;
      try {
        playedAnimation = Boolean(playbackRef.current.playNextAnimationGroup());
      } catch (e) {
        console.warn('[PptxRenderOverlay] playNextAnimationGroup error:', e);
        playedAnimation = false;
      }

      if (playedAnimation) {
        // Animation was successfully stepped forward inside current slide
        if (onAnimationGroupChange) {
          onAnimationGroupChange((pptxAnimationGroupIndex || 0) + 1);
        }
        return;
      }

      // Step 2: Walang effects o sagad na ang effects sa slide -> Advance to next slide agad!
      const totalSlides = Math.max(
        slides.length,
        slideCount,
        handleRef.current?.getSlideCount?.() || 1
      );

      if (activeSlideIndex + 1 < totalSlides) {
        handleSlideChange(activeSlideIndex + 1);
      } else {
        const { shortcutSettings } = useStore.getState();
        if (shortcutSettings?.wrapAroundSlides) {
          handleSlideChange(0);
        }
      }
    } else if (pptxAction === 'prev') {
      if (activeSlideIndex > 0) {
        handleSlideChange(activeSlideIndex - 1);
      }
    }
  }, [pptxAction, pptxActionTimestamp, activeSlideIndex, isThumbnail, handleSlideChange, slides.length, slideCount, onAnimationGroupChange, pptxAnimationGroupIndex]);

  // Synchronize viewer mode and active slide index
  useEffect(() => {
    if (handleRef.current && typeof handleRef.current.goTo === 'function') {
      try {
        if (isThumbnail) {
          if (handleRef.current.getMode && handleRef.current.getMode() !== 'present') {
            handleRef.current.setMode('present');
          }
          targetSlideLock.current = { index: activeSlideIndex, ts: Date.now() };
          handleRef.current.goTo(activeSlideIndex);
          initialSyncComplete.current = true;
          return;
        }

        // Wait until fully loaded before setting initialSyncComplete or syncing
        if (blocks.loading || !slides || slides.length === 0 || !slides[activeSlideIndex]) {
          return;
        }

        const isPresent = handleRef.current.getMode && handleRef.current.getMode() === 'present';
        if (!isPresent) {
          handleRef.current.setMode('present');
        }

        if (lastReportedSlideRef.current !== activeSlideIndex || !initialSyncComplete.current) {
          targetSlideLock.current = { index: activeSlideIndex, ts: Date.now() };
          handleRef.current.goTo(activeSlideIndex);
          lastReportedSlideRef.current = activeSlideIndex;
        }
        initialSyncComplete.current = true;
      } catch (e) {
        console.warn('[PptxViewerInner] goTo slide index error:', e);
      }
    }
  }, [activeSlideIndex, blocks.loading, isThumbnail, slides]);

  const canvasWidth = blocks.canvasProps?.canvasSize?.width || 960;
  const canvasHeight = blocks.canvasProps?.canvasSize?.height || 540;

  const effectiveContainerW = targetWidth || (containerSize.width > 0 ? containerSize.width : (isThumbnail ? 280 : 1920));
  const effectiveContainerH = targetHeight || (containerSize.height > 0 ? containerSize.height : (isThumbnail ? 158 : 1080));

  const customZoom = useMemo(() => {
    let scale = 1;
    if (effectiveContainerW > 0 && effectiveContainerH > 0 && canvasWidth > 0 && canvasHeight > 0) {
      scale = Math.min(effectiveContainerW / canvasWidth, effectiveContainerH / canvasHeight);
    }
    
    if (!blocks.canvasProps?.zoom) return { editorScale: scale } as any;
    return { ...blocks.canvasProps.zoom, editorScale: scale };
  }, [blocks.canvasProps?.zoom, effectiveContainerW, effectiveContainerH, canvasWidth, canvasHeight]);

  const lastGoodCanvasPropsRef = useRef<any>(null);
  if (blocks.canvasProps && !blocks.loading && !blocks.error) {
    lastGoodCanvasPropsRef.current = blocks.canvasProps;
  }
  const effectiveCanvasProps = (blocks.canvasProps && !blocks.error) ? blocks.canvasProps : lastGoodCanvasPropsRef.current;

  return (
    <div 
      ref={containerCallbackRef} 
      className={`w-full h-full overflow-hidden relative flex flex-col items-center justify-center select-none pptx-strict-typography cursor-pointer ${isProjectorMode ? 'bg-transparent' : 'bg-black'}`}
      style={{
        contain: 'strict',
        transform: 'translateZ(0)',
      }}
      onClickCapture={(e) => {
        // Prevent PPTX viewer from handling the click internally
        e.stopPropagation();
        
        // If we are in the moderator preview panel (not projector, not thumbnail), trigger next step
        if (!isProjectorMode && !isThumbnail) {
          window.dispatchEvent(new CustomEvent('simpleworship:pptx-click'));
        }
      }}
    >
      {(() => {
        // 1. PRIMARY ENGINE: High-fidelity interactive vector canvas with full animations, effects, and typography
        if (effectiveCanvasProps && effectiveActiveSlide) {
          return (
            <SlideCanvas 
              {...effectiveCanvasProps} 
              activeSlide={effectiveActiveSlide}
              presentationElementStates={!isThumbnail ? mergedElementStates : undefined}
              presentationKeyframesCss={!isThumbnail ? presentationKeyframesCss : undefined}
              zoom={customZoom} 
              mode="present"
              showRulers={false} 
              showGrid={false} 
              canEdit={false} 
            />
          );
        }

        // 2. Fallback to rasterized frame if vector canvas is unavailable or PowerPoint COM explicitly requested
        const canonical = PptxRenderCacheManager.getCanonicalFrame(contentId, activeSlideIndex);
        const effectiveDataUrl = canonical?.dataUrl || powerPointSession?.slides?.[activeSlideIndex]?.dataUrl;

        if (effectiveDataUrl) {
          return (
            <div className="w-full h-full relative flex items-center justify-center bg-black overflow-hidden pointer-events-none">
              <img 
                src={effectiveDataUrl} 
                alt={`Slide ${activeSlideIndex + 1}`}
                className="w-full h-full object-contain pointer-events-none select-none"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                }}
              />
            </div>
          );
        }

        // 3. Fallback to native PresentationSlideView with vector DrawingML shapes & typography
        if (currentSlide && ((currentSlide.objects && currentSlide.objects.length > 0) || (currentSlide.elements && currentSlide.elements.length > 0) || currentSlide.backgroundUrl || currentSlide.text)) {
          return (
            <PresentationSlideView 
              slide={currentSlide} 
              slideIndex={activeSlideIndex} 
              themeStyles={themeStyles} 
              targetWidth={targetWidth}
              targetHeight={targetHeight}
              isProjectorMode={isProjectorMode}
              isOverlayLayer={isOverlayLayer}
              mode={isThumbnail ? 'thumbnail' : 'full'}
              presentationElementStates={!isThumbnail ? mergedElementStates : undefined}
            />
          );
        }

        return (
          <div className={`w-full h-full flex items-center justify-center text-white/40 font-mono text-xs select-none ${isProjectorMode ? 'bg-transparent' : 'bg-black'}`}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span>Rendering Presentation Slide...</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.activeSlideIndex === nextProps.activeSlideIndex && 
    (prevProps.bytes === nextProps.bytes || (prevProps.bytes?.byteLength === nextProps.bytes?.byteLength && prevProps.contentId === nextProps.contentId)) &&
    prevProps.contentId === nextProps.contentId &&
    prevProps.isThumbnail === nextProps.isThumbnail &&
    prevProps.isProjectorMode === nextProps.isProjectorMode &&
    prevProps.isOverlayLayer === nextProps.isOverlayLayer &&
    prevProps.targetWidth === nextProps.targetWidth &&
    prevProps.targetHeight === nextProps.targetHeight &&
    prevProps.pptxAction === nextProps.pptxAction &&
    prevProps.pptxActionTimestamp === nextProps.pptxActionTimestamp &&
    prevProps.pptxAnimationGroupIndex === nextProps.pptxAnimationGroupIndex &&
    prevProps.themeStyles === nextProps.themeStyles &&
    prevProps.currentSlide === nextProps.currentSlide
  );
});

class LRUCache<K, V> {
  private max: number;
  private cache: Map<K, V>;

  constructor(max = 5) {
    this.max = max;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      const val = this.cache.get(key)!;
      this.cache.delete(key);
      this.cache.set(key, val);
      return val;
    }
    return undefined;
  }

  set(key: K, val: V) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.max) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, val);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }
}

const pptxBytesCache = new LRUCache<string, Uint8Array>(5);
const rawBytesCache = new WeakMap<object, Uint8Array>();

export interface CachedPptxDeck {
  slides: any[];
  canvasProps: any;
  canvasWidth: number;
  canvasHeight: number;
  timestamp: number;
}

export const pptxDeckSharedCache = new Map<string, CachedPptxDeck>();
export const pptxRawDeckCache = new WeakMap<object, CachedPptxDeck>();

const PptxDirectThumbnail: React.FC<{
  cachedDeck: CachedPptxDeck;
  slideIndex: number;
  contentId?: string;
  targetWidth?: number;
  targetHeight?: number;
  currentSlide?: Slide | null;
  themeStyles?: ThemeStyles;
}> = React.memo(({ cachedDeck, slideIndex, contentId, targetWidth, targetHeight, currentSlide, themeStyles }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>(() => ({
    width: targetWidth || 280,
    height: targetHeight || 158,
  }));

  const containerCallbackRef = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const w = el.clientWidth || Math.round(rect.width);
    const h = el.clientHeight || Math.round(rect.height);
    if (w > 0 && h > 0) {
      setContainerSize(prev => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      if (w > 0 && h > 0) {
        setContainerSize(prev => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const targetSlide = (cachedDeck.slides && cachedDeck.slides[slideIndex]) || cachedDeck.slides?.[0] || cachedDeck.canvasProps?.activeSlide;
  const cWidth = cachedDeck.canvasWidth || 960;
  const cHeight = cachedDeck.canvasHeight || 540;

  const effectiveContainerW = targetWidth || (containerSize.width > 0 ? containerSize.width : 280);
  const effectiveContainerH = targetHeight || (containerSize.height > 0 ? containerSize.height : 158);

  const customZoom = useMemo(() => {
    let scale = 0.3;
    if (effectiveContainerW > 0 && effectiveContainerH > 0 && cWidth > 0 && cHeight > 0) {
      scale = Math.min(effectiveContainerW / cWidth, effectiveContainerH / cHeight);
    }
    if (!cachedDeck.canvasProps?.zoom) return { editorScale: scale } as any;
    return { ...cachedDeck.canvasProps.zoom, editorScale: scale };
  }, [cachedDeck.canvasProps?.zoom, effectiveContainerW, effectiveContainerH, cWidth, cHeight]);

  // 1. Native OpenXML vector canvas render when ready
  if (cachedDeck.canvasProps && targetSlide) {
    return (
      <div
        ref={containerCallbackRef}
        className="w-full h-full bg-black overflow-hidden relative flex flex-col items-center justify-center select-none pointer-events-none pptx-strict-typography"
        style={{
          contain: 'strict',
          transform: 'translateZ(0)',
        }}
      >
        <SlideCanvas
          {...cachedDeck.canvasProps}
          activeSlide={targetSlide}
          zoom={customZoom}
          mode="present"
          showRulers={false}
          showGrid={false}
          canEdit={false}
        />
      </div>
    );
  }

  // 2. Authoritative check: If PowerPoint COM or rasterized canonical frame is available, render exact image!
  const canonical = PptxRenderCacheManager.getCanonicalFrame(contentId, slideIndex);
  if (canonical?.dataUrl) {
    return (
      <div className="w-full h-full relative flex items-center justify-center bg-black overflow-hidden pointer-events-none">
        <img 
          src={canonical.dataUrl} 
          alt={`Slide ${slideIndex + 1}`}
          className="w-full h-full object-contain pointer-events-none select-none"
          style={{ maxWidth: '100%', maxHeight: '100%' }}
        />
      </div>
    );
  }

  // 3. Fallback only if genuinely necessary
  if (currentSlide && ((currentSlide.objects && currentSlide.objects.length > 0) || (currentSlide.elements && currentSlide.elements.length > 0) || currentSlide.backgroundUrl)) {
    return (
      <PresentationSlideView
        slide={currentSlide}
        slideIndex={slideIndex}
        themeStyles={themeStyles}
        targetWidth={targetWidth}
        targetHeight={targetHeight}
        mode="thumbnail"
      />
    );
  }

  return (
    <div className="w-full h-full bg-black flex items-center justify-center text-white/40 font-mono text-xs select-none">
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <span>Slide {slideIndex + 1}</span>
      </div>
    </div>
  );
});

export const PptxRenderOverlay: React.FC<PptxRenderOverlayProps> = React.memo(({ fileBytes, contentId, activeSlideIndex, isThumbnail, isProjectorMode, isOverlayLayer, pptxAction, pptxActionTimestamp, pptxAnimationGroupIndex, onAnimationGroupChange, onActiveSlideChange, currentSlide, themeStyles, targetWidth, targetHeight }) => {
  const [cachedDeck, setCachedDeck] = useState<CachedPptxDeck | null>(() => {
    if (contentId && pptxDeckSharedCache.has(contentId)) {
      return pptxDeckSharedCache.get(contentId)!;
    }
    if (fileBytes && typeof fileBytes === 'object' && pptxRawDeckCache.has(fileBytes)) {
      return pptxRawDeckCache.get(fileBytes)!;
    }
    return null;
  });

  useEffect(() => {
    if (contentId && pptxDeckSharedCache.has(contentId)) {
      setCachedDeck(pptxDeckSharedCache.get(contentId)!);
      return;
    }
    if (fileBytes && typeof fileBytes === 'object' && pptxRawDeckCache.has(fileBytes)) {
      setCachedDeck(pptxRawDeckCache.get(fileBytes)!);
      return;
    }

    const handleDeckCached = (e: Event) => {
      const customEvent = e as CustomEvent<{ contentId: string }>;
      if (contentId && customEvent.detail?.contentId === contentId) {
        if (pptxDeckSharedCache.has(contentId)) {
          setCachedDeck(pptxDeckSharedCache.get(contentId)!);
        }
      }
    };
    window.addEventListener('simpleworship:pptx-deck-cached', handleDeckCached);
    return () => {
      window.removeEventListener('simpleworship:pptx-deck-cached', handleDeckCached);
    };
  }, [contentId, fileBytes]);

  const [localBytes, setLocalBytes] = useState<Uint8Array | null>(() => {
    if (contentId && pptxBytesCache.has(contentId)) {
      return pptxBytesCache.get(contentId)!;
    }
    if (fileBytes && typeof fileBytes === 'object' && rawBytesCache.has(fileBytes)) {
      return rawBytesCache.get(fileBytes)!;
    }
    if (fileBytes && isValidPptxBinary(fileBytes)) {
      const valid = toValidPptxUint8Array(fileBytes);
      rawBytesCache.set(fileBytes, valid);
      if (contentId) pptxBytesCache.set(contentId, valid);
      return valid;
    }
    return null;
  });

  useEffect(() => {
    let isMounted = true;
    if (contentId && pptxBytesCache.has(contentId)) {
      setLocalBytes(pptxBytesCache.get(contentId)!);
      return;
    }
    if (fileBytes) {
      if (typeof fileBytes === 'object' && rawBytesCache.has(fileBytes)) {
        setLocalBytes(rawBytesCache.get(fileBytes)!);
        return;
      }
      if (isValidPptxBinary(fileBytes)) {
        const valid = toValidPptxUint8Array(fileBytes);
        if (valid) {
          if (typeof fileBytes === 'object') rawBytesCache.set(fileBytes, valid);
          if (contentId) pptxBytesCache.set(contentId, valid);
          setLocalBytes(valid);
          return;
        }
      } else if (fileBytes instanceof Blob) {
        fileBytes.arrayBuffer().then((buf: ArrayBuffer) => {
          if (isValidPptxBinary(buf)) {
            const valid = toValidPptxUint8Array(buf);
            if (valid && isMounted) {
              if (contentId) pptxBytesCache.set(contentId, valid);
              setLocalBytes(valid);
            }
          }
        }).catch(() => {});
        return;
      }
    }
    if (contentId) {
      import('../db/presentations').then(({ getPptxFileBytes }) => {
        getPptxFileBytes(contentId).then((bytes) => {
          if (bytes && isValidPptxBinary(bytes)) {
            const valid = toValidPptxUint8Array(bytes);
            if (valid && isMounted) {
              pptxBytesCache.set(contentId, valid);
              setLocalBytes(valid);
            }
          }
        }).catch(e => console.error('[PptxRenderOverlay] Error loading PPTX from DB', e));
      });
    }
    return () => { isMounted = false; };
  }, [fileBytes, contentId]);

  const [, setCanonicalFrameTick] = useState(0);
  useEffect(() => {
    const handleFrameUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ presentationId: string; aliases?: string[] }>;
      if (
        !contentId ||
        customEvent.detail?.presentationId === contentId ||
        customEvent.detail?.aliases?.includes(contentId)
      ) {
        setCanonicalFrameTick(t => t + 1);
      }
    };
    window.addEventListener('simpleworship:canonical-frame-updated', handleFrameUpdate);
    return () => window.removeEventListener('simpleworship:canonical-frame-updated', handleFrameUpdate);
  }, [contentId]);

  // 1. If this is a thumbnail and we have the shared deck cached, render PptxDirectThumbnail
  if (isThumbnail && cachedDeck) {
    return (
      <PptxDirectThumbnail
        cachedDeck={cachedDeck}
        slideIndex={activeSlideIndex}
        contentId={contentId}
        targetWidth={targetWidth}
        targetHeight={targetHeight}
        currentSlide={currentSlide}
        themeStyles={themeStyles}
      />
    );
  }

  // 2. If local binary bytes are available, render interactive PptxViewerInner with full animations & typography
  if (localBytes) {
    const fallbackView = currentSlide ? (
      <PresentationSlideView 
        slide={currentSlide} 
        slideIndex={activeSlideIndex} 
        themeStyles={themeStyles} 
        targetWidth={targetWidth}
        targetHeight={targetHeight}
        isProjectorMode={isProjectorMode}
        isOverlayLayer={isOverlayLayer}
        mode={isThumbnail ? 'thumbnail' : 'full'}
      />
    ) : undefined;

    return (
      <PptxErrorBoundary fallback={fallbackView}>
        <PptxViewerInner 
          bytes={localBytes} 
          activeSlideIndex={activeSlideIndex} 
          contentId={contentId} 
          isThumbnail={isThumbnail} 
          isProjectorMode={isProjectorMode} 
          isOverlayLayer={isOverlayLayer}
          pptxAction={pptxAction} 
          pptxActionTimestamp={pptxActionTimestamp} 
          pptxAnimationGroupIndex={pptxAnimationGroupIndex}
          onAnimationGroupChange={onAnimationGroupChange}
          onActiveSlideChange={onActiveSlideChange}
          currentSlide={currentSlide}
          themeStyles={themeStyles}
          targetWidth={targetWidth}
          targetHeight={targetHeight}
        />
      </PptxErrorBoundary>
    );
  }

  // 3. Fallback: If canonical frame image is available in memory/disk, render
  const canonicalFrame = PptxRenderCacheManager.getCanonicalFrame(contentId, activeSlideIndex);
  if (canonicalFrame?.dataUrl) {
    return (
      <div className="w-full h-full relative flex items-center justify-center bg-black overflow-hidden pointer-events-none">
        <img 
          src={canonicalFrame.dataUrl} 
          alt={`Slide ${activeSlideIndex + 1}`}
          className="w-full h-full object-contain pointer-events-none select-none"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        />
      </div>
    );
  }

  if (cachedDeck && cachedDeck.canvasProps) {
    return (
      <PptxDirectThumbnail
        cachedDeck={cachedDeck}
        slideIndex={activeSlideIndex}
        contentId={contentId}
        targetWidth={targetWidth}
        targetHeight={targetHeight}
        currentSlide={currentSlide}
        themeStyles={themeStyles}
      />
    );
  }

  // 4. Fallback to vector PresentationSlideView
  if (currentSlide && ((currentSlide.objects && currentSlide.objects.length > 0) || (currentSlide.elements && currentSlide.elements.length > 0) || currentSlide.backgroundUrl || currentSlide.backgroundColor || currentSlide.text || currentSlide.title || (currentSlide as any).isPptx)) {
    return (
      <PresentationSlideView 
        slide={currentSlide} 
        slideIndex={activeSlideIndex} 
        themeStyles={themeStyles} 
        targetWidth={targetWidth}
        targetHeight={targetHeight}
        isProjectorMode={isProjectorMode}
        isOverlayLayer={isOverlayLayer}
        mode={isThumbnail ? 'thumbnail' : 'full'}
      />
    );
  }

  return (
    <div className={`w-full h-full flex items-center justify-center text-white/40 font-mono text-xs select-none ${isProjectorMode ? 'bg-transparent' : 'bg-black'}`}>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <span>Loading Presentation Deck...</span>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.activeSlideIndex === nextProps.activeSlideIndex &&
    prevProps.contentId === nextProps.contentId &&
    prevProps.fileBytes === nextProps.fileBytes &&
    prevProps.isThumbnail === nextProps.isThumbnail &&
    prevProps.isProjectorMode === nextProps.isProjectorMode &&
    prevProps.isOverlayLayer === nextProps.isOverlayLayer &&
    prevProps.targetWidth === nextProps.targetWidth &&
    prevProps.targetHeight === nextProps.targetHeight &&
    prevProps.pptxAction === nextProps.pptxAction &&
    prevProps.pptxActionTimestamp === nextProps.pptxActionTimestamp &&
    prevProps.pptxAnimationGroupIndex === nextProps.pptxAnimationGroupIndex &&
    prevProps.themeStyles === nextProps.themeStyles &&
    prevProps.currentSlide === nextProps.currentSlide
  );
});

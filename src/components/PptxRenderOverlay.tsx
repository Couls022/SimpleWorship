import '../utils/initPptxViewer';
import React, { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { SlideCanvas, useViewerBuildingBlocks, PowerPointViewerHandle } from 'pptx-react-viewer';
import { useAnimationPlayback } from 'pptx-react-viewer/internals';
import 'pptx-react-viewer/styles';
import { toValidPptxUint8Array, isValidPptxBinary } from '../utils/pptxValidator';
import { useStore } from '../store/useStore';
import { Slide, ThemeStyles } from '../types';
import { PresentationSlideView } from './PresentationSlideView';

interface PptxRenderOverlayProps {
  fileBytes?: Uint8Array | ArrayBuffer | any;
  contentId?: string;
  isThumbnail?: boolean;
  isProjectorMode?: boolean;
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

  const handleSlideChange = useCallback((index: number) => {
    lastReportedSlideRef.current = index;
    if (handleRef.current && typeof handleRef.current.goTo === 'function') {
      try {
        handleRef.current.goTo(index);
      } catch (e) {
        console.warn('[PptxViewerInner] goTo error:', e);
      }
    }
    onActiveSlideChange?.(index);
  }, [onActiveSlideChange]);

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
    clearPresentationTimers,
  } = useAnimationPlayback({
    slides,
    showWithAnimation: !isThumbnail,
    canvasSize: blocks.canvasProps?.canvasSize,
    themeColorMap: (blocks.canvasProps as any)?.themeColorMap
  });

  const renderedSlideId = blocks.canvasProps?.activeSlide?.id;
  
  const actualRenderedIndex = useMemo(() => {
    if (!renderedSlideId || !slides || slides.length === 0) return -1;
    return slides.findIndex(s => s.id === renderedSlideId);
  }, [renderedSlideId, slides]);

  // Track slide transition and seed entrance animations ONLY when the renderer has caught up
  useLayoutEffect(() => {
    if (isThumbnail || !slides || slides.length === 0) return;
    if (actualRenderedIndex !== activeSlideIndex) return; // Wait until blocks.canvasProps is updated
    
    let isCancelled = false;
    let rAF1: number;
    let rAF2: number;
    let retryCount = 0;
    const maxRetries = 20; // Bound the retry loop to ~333ms
    let mutationObserver: MutationObserver | null = null;
    let hasSuccessfullySeeded = false;

    const finalizeAnimations = () => {
      if (isCancelled || hasSuccessfullySeeded) return;
      hasSuccessfullySeeded = true;
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }
      
      // Allow browser to paint the seeded (hidden) state before triggering entrance animations
      rAF1 = requestAnimationFrame(() => {
        if (isCancelled) return;
        rAF2 = requestAnimationFrame(() => {
          if (isCancelled) return;
          try {
            runPresentationEntranceAnimations(activeSlideIndex);
            
            // Fast-forward to the desired animation group state if needed
            if (pptxAnimationGroupIndex && pptxAnimationGroupIndex > 0) {
              for (let i = 0; i < pptxAnimationGroupIndex; i++) {
                playNextAnimationGroup();
              }
            }
          } catch (e) {
            console.warn('[PptxRenderOverlay] runPresentationEntranceAnimations error:', e);
          }
        });
      });
    };

    const attemptSeed = () => {
      if (isCancelled || hasSuccessfullySeeded) return;
      
      try {
        clearPresentationTimers();
        seedSlideAnimations(activeSlideIndex);
      } catch (e) {
        console.warn('[PptxRenderOverlay] seedSlideAnimations error:', e);
      }
      
      const container = containerRef.current;
      // Check if slide DOM is populated
      const hasContent = container && (
        container.querySelector('[data-element-id]') !== null ||
        container.querySelector('[data-shape-id]') !== null ||
        container.querySelector('.slide-layer') !== null
      );
      
      if (hasContent) {
        finalizeAnimations();
        return;
      }
      
      retryCount++;
      if (retryCount >= maxRetries) {
        // Fallback: conclude no targets exist (e.g. blank slide or static image slide)
        finalizeAnimations();
      }
    };
    
    // Initial attempt
    attemptSeed();
    
    // If not successful immediately, set up observers
    if (!hasSuccessfullySeeded && containerRef.current) {
      mutationObserver = new MutationObserver(() => {
        attemptSeed();
      });
      mutationObserver.observe(containerRef.current, { childList: true, subtree: true });
      
      // Also setup a bounded RAF loop as fallback
      const loop = () => {
        if (isCancelled || hasSuccessfullySeeded) return;
        attemptSeed();
        if (!hasSuccessfullySeeded) {
          rAF1 = requestAnimationFrame(loop);
        }
      };
      rAF1 = requestAnimationFrame(loop);
    }
    
    return () => {
      isCancelled = true;
      if (rAF1) cancelAnimationFrame(rAF1);
      if (rAF2) cancelAnimationFrame(rAF2);
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      clearPresentationTimers();
    };
  }, [actualRenderedIndex, activeSlideIndex, isThumbnail, slides, seedSlideAnimations, runPresentationEntranceAnimations, clearPresentationTimers]);

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
        playedAnimation = Boolean(playNextAnimationGroup());
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
  }, [pptxAction, pptxActionTimestamp, activeSlideIndex, isThumbnail, playNextAnimationGroup, handleSlideChange, slides.length, slideCount, onAnimationGroupChange, pptxAnimationGroupIndex]);

  // Synchronize viewer mode and active slide index
  useEffect(() => {
    if (handleRef.current && typeof handleRef.current.goTo === 'function') {
      try {
        if (isThumbnail) {
          if (handleRef.current.getMode && handleRef.current.getMode() !== 'present') {
            handleRef.current.setMode('present');
          }
          handleRef.current.goTo(activeSlideIndex);
          return;
        }

        const isPresent = handleRef.current.getMode && handleRef.current.getMode() === 'present';
        if (!isPresent) {
          handleRef.current.setMode('present');
        }

        if (lastReportedSlideRef.current !== activeSlideIndex) {
          handleRef.current.goTo(activeSlideIndex);
          lastReportedSlideRef.current = activeSlideIndex;
        }
      } catch (e) {
        console.warn('[PptxViewerInner] goTo slide index error:', e);
      }
    }
  }, [activeSlideIndex, blocks.loading, isThumbnail]);

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

  const effectiveActiveSlide = useMemo(() => {
    if (slides && slides[activeSlideIndex]) {
      return slides[activeSlideIndex];
    }
    return blocks.canvasProps?.activeSlide;
  }, [slides, activeSlideIndex, blocks.canvasProps?.activeSlide]);

  return (
    <div 
      ref={containerCallbackRef} 
      className="w-full h-full bg-black overflow-hidden relative flex flex-col items-center justify-center select-none pptx-strict-typography cursor-pointer"
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
      {blocks.loading || blocks.error || !blocks.canvasProps ? (
        currentSlide ? (
          <PresentationSlideView 
            slide={currentSlide} 
            slideIndex={activeSlideIndex} 
            themeStyles={themeStyles} 
          />
        ) : (
          <div className="w-full h-full bg-black flex items-center justify-center text-white/40 font-mono text-xs select-none">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span>Rendering Presentation Slide...</span>
            </div>
          </div>
        )
      ) : (
        <SlideCanvas 
          {...blocks.canvasProps} 
          activeSlide={effectiveActiveSlide}
          presentationElementStates={!isThumbnail ? presentationElementStates : undefined}
          presentationKeyframesCss={!isThumbnail ? presentationKeyframesCss : undefined}
          zoom={customZoom} 
          mode="present"
          showRulers={false} 
          showGrid={false} 
          canEdit={false} 
        />
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.activeSlideIndex === nextProps.activeSlideIndex && 
    prevProps.bytes === nextProps.bytes &&
    prevProps.isThumbnail === nextProps.isThumbnail &&
    prevProps.isProjectorMode === nextProps.isProjectorMode &&
    prevProps.targetWidth === nextProps.targetWidth &&
    prevProps.targetHeight === nextProps.targetHeight &&
    prevProps.pptxAction === nextProps.pptxAction &&
    prevProps.pptxActionTimestamp === nextProps.pptxActionTimestamp
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
  targetWidth?: number;
  targetHeight?: number;
  currentSlide?: Slide | null;
  themeStyles?: ThemeStyles;
}> = React.memo(({ cachedDeck, slideIndex, targetWidth, targetHeight, currentSlide, themeStyles }) => {
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

  if (!targetSlide) {
    if (currentSlide) {
      return (
        <PresentationSlideView
          slide={currentSlide}
          slideIndex={slideIndex}
          themeStyles={themeStyles}
        />
      );
    }
    return null;
  }

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
});

export const PptxRenderOverlay: React.FC<PptxRenderOverlayProps> = React.memo(({ fileBytes, contentId, activeSlideIndex, isThumbnail, isProjectorMode, pptxAction, pptxActionTimestamp, pptxAnimationGroupIndex, onAnimationGroupChange, onActiveSlideChange, currentSlide, themeStyles, targetWidth, targetHeight }) => {
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
        if (typeof fileBytes === 'object') rawBytesCache.set(fileBytes, valid);
        if (contentId) pptxBytesCache.set(contentId, valid);
        setLocalBytes(valid);
        return;
      }
    }
    if (contentId) {
      import('../db').then(({ getDB }) => {
        getDB().then(db => db.get('assets', contentId)).then(asset => {
          if (asset?.data?.fileBytes && isValidPptxBinary(asset.data.fileBytes)) {
            const bytes = toValidPptxUint8Array(asset.data.fileBytes);
            pptxBytesCache.set(contentId, bytes);
            if (isMounted) setLocalBytes(bytes);
          }
        }).catch(e => console.error('[PptxRenderOverlay] Error loading PPTX from DB', e));
      });
    }
    return () => { isMounted = false; };
  }, [fileBytes, contentId]);

  // If this is a thumbnail and we have the shared deck cached, render PptxDirectThumbnail
  if (isThumbnail && cachedDeck) {
    return (
      <PptxDirectThumbnail
        cachedDeck={cachedDeck}
        slideIndex={activeSlideIndex}
        targetWidth={targetWidth}
        targetHeight={targetHeight}
        currentSlide={currentSlide}
        themeStyles={themeStyles}
      />
    );
  }

  if (!localBytes) {
    if (currentSlide) {
      return (
        <PresentationSlideView 
          slide={currentSlide} 
          slideIndex={activeSlideIndex} 
          themeStyles={themeStyles} 
        />
      );
    }
    return null;
  }

  const fallbackView = currentSlide ? (
    <PresentationSlideView 
      slide={currentSlide} 
      slideIndex={activeSlideIndex} 
      themeStyles={themeStyles} 
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
}, (prevProps, nextProps) => {
  return (
    prevProps.activeSlideIndex === nextProps.activeSlideIndex &&
    prevProps.contentId === nextProps.contentId &&
    prevProps.fileBytes === nextProps.fileBytes &&
    prevProps.isThumbnail === nextProps.isThumbnail &&
    prevProps.isProjectorMode === nextProps.isProjectorMode &&
    prevProps.targetWidth === nextProps.targetWidth &&
    prevProps.targetHeight === nextProps.targetHeight &&
    prevProps.pptxAction === nextProps.pptxAction &&
    prevProps.pptxActionTimestamp === nextProps.pptxActionTimestamp &&
    prevProps.currentSlide === nextProps.currentSlide
  );
});

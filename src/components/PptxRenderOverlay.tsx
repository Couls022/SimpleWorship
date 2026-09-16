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
  onActiveSlideChange?: (index: number) => void;
  activeSlideIndex: number;
  currentSlide?: Slide | null;
  themeStyles?: ThemeStyles;
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
  onActiveSlideChange?: (index: number) => void;
  currentSlide?: Slide | null;
  themeStyles?: ThemeStyles;
}

const PptxViewerInner: React.FC<PptxViewerInnerProps> = React.memo(({ bytes, activeSlideIndex, isThumbnail, isProjectorMode, pptxAction, pptxActionTimestamp, onActiveSlideChange, currentSlide, themeStyles }) => {
  const handleRef = useRef<PowerPointViewerHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastReportedSlideRef = useRef<number>(-1);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 1920, height: 1080 });
  const [slideCount, setSlideCount] = useState<number>(1);
  const [allSlidesState, setAllSlidesState] = useState<any[]>([]);

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
    const canvasAllSlides = (blocks.canvasProps as any)?.allSlides;
    if (Array.isArray(canvasAllSlides) && canvasAllSlides.length > 0) return canvasAllSlides;
    if (blocks.canvasProps?.activeSlide) return [blocks.canvasProps.activeSlide];
    return [];
  }, [allSlidesState, blocks.canvasProps, blocks.loading]);

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

    try {
      clearPresentationTimers();
      seedSlideAnimations(activeSlideIndex);
      
      // Allow browser to paint the seeded (hidden) state before triggering entrance animations
      rAF1 = requestAnimationFrame(() => {
        if (isCancelled) return;
        rAF2 = requestAnimationFrame(() => {
          if (isCancelled) return;
          runPresentationEntranceAnimations(activeSlideIndex);
        });
      });
    } catch (e) {
      console.warn('[PptxRenderOverlay] seedSlideAnimations error:', e);
    }
    
    return () => {
      isCancelled = true;
      if (rAF1) cancelAnimationFrame(rAF1);
      if (rAF2) cancelAnimationFrame(rAF2);
      clearPresentationTimers();
    };
  }, [actualRenderedIndex, activeSlideIndex, isThumbnail, slides, seedSlideAnimations, runPresentationEntranceAnimations, clearPresentationTimers]);

  // Mouse wheel listener with discrete debounced stepping
  useEffect(() => {
    const el = containerRef.current;
    if (!el || isThumbnail || isProjectorMode) return;

    let lastWheelTime = 0;
    const handleWheel = (e: WheelEvent) => {
      // Prevent browser default scroll and handle presentation step
      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      if (now - lastWheelTime < 250) return; // 250ms debounce threshold

      if (Math.abs(e.deltaY) < 10) return; // Filter micro jitters

      lastWheelTime = now;
      if (e.deltaY > 0) {
        useStore.getState().goLiveNext();
      } else {
        useStore.getState().goLivePrev();
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [isThumbnail, isProjectorMode]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let animationFrameId: number | null = null;

    const getUnscaledDimensions = () => {
      const rect = el.getBoundingClientRect();
      let width = rect.width;
      let height = rect.height;
      if (!width || !height) {
        let parent = el.parentElement;
        while (parent && (!width || !height)) {
          const prect = parent.getBoundingClientRect();
          width = prect.width;
          height = prect.height;
          parent = parent.parentElement;
        }
      }
      return { width: width > 0 ? width : 1920, height: height > 0 ? height : 1080 };
    };

    const updateSize = (entries?: ResizeObserverEntry[]) => {
      if (animationFrameId !== null) return;
      animationFrameId = requestAnimationFrame(() => {
        animationFrameId = null;
        if (!el) return;
        
        let dims = { width: 0, height: 0 };
        if (entries && entries.length > 0 && entries[0].contentRect.width > 0) {
          dims = { 
            width: entries[0].contentRect.width, 
            height: entries[0].contentRect.height 
          };
        } else {
          dims = getUnscaledDimensions();
        }

        if (dims.width > 0 && dims.height > 0) {
          setContainerSize(prev => (Math.abs(prev.width - dims.width) < 1 && Math.abs(prev.height - dims.height) < 1 ? prev : dims));
        }
      });
    };

    const ro = new ResizeObserver((entries) => updateSize(entries));
    ro.observe(el);
    updateSize();

    return () => {
      ro.disconnect();
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

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
  }, [pptxAction, pptxActionTimestamp, activeSlideIndex, isThumbnail, playNextAnimationGroup, handleSlideChange, slides.length, slideCount]);

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

  const targetScale = useMemo(() => {
    const targetW = containerSize.width;
    const targetH = containerSize.height;
    if (!targetW || !targetH || !canvasWidth || !canvasHeight) return 1;
    const scale = Math.min(targetW / canvasWidth, targetH / canvasHeight);
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  }, [containerSize.width, containerSize.height, canvasWidth, canvasHeight]);

  const customZoom = useMemo(() => {
    if (!blocks.canvasProps?.zoom) return undefined;
    if (isThumbnail) {
      return blocks.canvasProps.zoom;
    }
    return { ...blocks.canvasProps.zoom, editorScale: targetScale };
  }, [blocks.canvasProps?.zoom, targetScale, isThumbnail]);

  const effectiveActiveSlide = useMemo(() => {
    if (slides && slides[activeSlideIndex]) {
      return slides[activeSlideIndex];
    }
    return blocks.canvasProps?.activeSlide;
  }, [slides, activeSlideIndex, blocks.canvasProps?.activeSlide]);

  if (blocks.loading || blocks.error || !blocks.canvasProps) {
    if (currentSlide) {
      return (
        <PresentationSlideView 
          slide={currentSlide} 
          slideIndex={activeSlideIndex} 
          themeStyles={themeStyles} 
        />
      );
    }
    return (
      <div className="w-full h-full bg-black flex items-center justify-center text-white/40 font-mono text-xs select-none">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span>Rendering Presentation Slide...</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full bg-black overflow-hidden relative flex items-center justify-center select-none pptx-strict-typography cursor-pointer"
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
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.activeSlideIndex === nextProps.activeSlideIndex && 
    prevProps.bytes === nextProps.bytes &&
    prevProps.isThumbnail === nextProps.isThumbnail &&
    prevProps.isProjectorMode === nextProps.isProjectorMode &&
    prevProps.pptxAction === nextProps.pptxAction &&
    prevProps.pptxActionTimestamp === nextProps.pptxActionTimestamp
  );
});

const pptxBytesCache = new Map<string, Uint8Array>();
const rawBytesCache = new WeakMap<object, Uint8Array>();

export const PptxRenderOverlay: React.FC<PptxRenderOverlayProps> = React.memo(({ fileBytes, contentId, activeSlideIndex, isThumbnail, isProjectorMode, pptxAction, pptxActionTimestamp, onActiveSlideChange, currentSlide, themeStyles }) => {
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
        onActiveSlideChange={onActiveSlideChange}
        currentSlide={currentSlide}
        themeStyles={themeStyles}
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
    prevProps.pptxAction === nextProps.pptxAction &&
    prevProps.pptxActionTimestamp === nextProps.pptxActionTimestamp &&
    prevProps.currentSlide === nextProps.currentSlide
  );
});

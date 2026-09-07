import '../utils/initPptxViewer';
import React, { useEffect, useRef, useState, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { SlideCanvas, useViewerBuildingBlocks, PowerPointViewerHandle } from 'pptx-react-viewer';
import 'pptx-react-viewer/styles';
import { toValidPptxUint8Array, isValidPptxBinary } from '../utils/pptxValidator';

interface PptxRenderOverlayProps {
  fileBytes?: Uint8Array | ArrayBuffer | any;
  contentId?: string;
  activeSlideIndex: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
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
      return null;
    }
    return this.props.children;
  }
}

interface PptxViewerInnerProps {
  bytes: Uint8Array;
  activeSlideIndex: number;
  contentId?: string;
}

const PptxViewerInner: React.FC<PptxViewerInnerProps> = React.memo(({ bytes, activeSlideIndex }) => {
  const handleRef = useRef<PowerPointViewerHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 1920, height: 1080 });

  const blocks = useViewerBuildingBlocks({
    content: bytes,
    canEdit: false,
    handle: handleRef,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let animationFrameId: number | null = null;

    const getUnscaledDimensions = () => {
      let width = el.clientWidth || el.offsetWidth;
      let height = el.clientHeight || el.offsetHeight;
      if (!width || !height) {
        let parent = el.parentElement;
        while (parent && (!width || !height)) {
          width = parent.clientWidth || parent.offsetWidth;
          height = parent.clientHeight || parent.offsetHeight;
          parent = parent.parentElement;
        }
      }
      return { width: width > 0 ? width : 1920, height: height > 0 ? height : 1080 };
    };

    const updateSize = () => {
      if (animationFrameId !== null) return;
      animationFrameId = requestAnimationFrame(() => {
        animationFrameId = null;
        if (!el) return;
        const dims = getUnscaledDimensions();
        if (dims.width > 0 && dims.height > 0) {
          setContainerSize(prev => (prev.width === dims.width && prev.height === dims.height ? prev : dims));
        }
      });
    };

    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    updateSize();

    return () => {
      ro.disconnect();
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  useEffect(() => {
    if (handleRef.current && typeof handleRef.current.goTo === 'function') {
      try {
        handleRef.current.goTo(activeSlideIndex);
      } catch (e) {
        console.warn('[PptxViewerInner] goTo slide index error:', e);
      }
    }
  }, [activeSlideIndex, blocks.loading]);

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
    return { ...blocks.canvasProps.zoom, editorScale: 1 };
  }, [blocks.canvasProps?.zoom]);

  if (blocks.loading || blocks.error || !blocks.canvasProps) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center text-white/40 font-mono text-xs select-none">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span>Rendering Presentation Slide...</span>
        </div>
      </div>
    );
  }

  const currentSlide = (blocks as any).slides?.[activeSlideIndex] || blocks.canvasProps?.activeSlide;

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full bg-black overflow-hidden relative flex items-center justify-center select-none"
      style={{
        contain: 'strict',
        transform: 'translateZ(0)',
      }}
    >
      <div 
        className="flex items-center justify-center pointer-events-none select-none origin-center shrink-0 overflow-hidden"
        style={{
          width: `${canvasWidth}px`,
          height: `${canvasHeight}px`,
          transform: `scale(${targetScale}) translateZ(0)`,
          transformOrigin: 'center center',
          willChange: 'transform',
          contain: 'layout size style paint',
        }}
      >
        <SlideCanvas 
          {...blocks.canvasProps} 
          {...(currentSlide ? { activeSlide: currentSlide } : {})}
          activeSlideIndex={activeSlideIndex}
          zoom={customZoom || blocks.canvasProps.zoom} 
          showRulers={false} 
          showGrid={false} 
          canEdit={false} 
        />
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.activeSlideIndex === nextProps.activeSlideIndex && prevProps.bytes === nextProps.bytes;
});

const pptxBytesCache = new Map<string, Uint8Array>();
const rawBytesCache = new WeakMap<object, Uint8Array>();

export const PptxRenderOverlay: React.FC<PptxRenderOverlayProps> = React.memo(({ fileBytes, contentId, activeSlideIndex }) => {
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

  if (!localBytes) return null;

  return (
    <PptxErrorBoundary>
      <PptxViewerInner bytes={localBytes} activeSlideIndex={activeSlideIndex} contentId={contentId} />
    </PptxErrorBoundary>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.activeSlideIndex === nextProps.activeSlideIndex &&
    prevProps.contentId === nextProps.contentId &&
    prevProps.fileBytes === nextProps.fileBytes
  );
});

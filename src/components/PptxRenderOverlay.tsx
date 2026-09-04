import '../utils/initPptxViewer';
import React, { useEffect, useRef, useState, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { SlideCanvas, useViewerBuildingBlocks, PowerPointViewerHandle } from 'pptx-react-viewer';
import 'pptx-react-viewer/styles';
import { toValidPptxUint8Array } from '../utils/pptxValidator';
import { useOffscreenPptxCache } from '../utils/initPptxViewer';

interface PptxRenderOverlayProps {
  fileBytes: Uint8Array | ArrayBuffer | any;
  activeSlideIndex: number;
  fallbackContent?: ReactNode;
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
  fallbackContent?: ReactNode;
}

const PptxViewerInner: React.FC<PptxViewerInnerProps> = ({ bytes, activeSlideIndex, fallbackContent }) => {
  const handleRef = useRef<PowerPointViewerHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 1920, height: 1080 });

  // Unique key for off-screen canvas caching
  const bytesKey = useMemo(() => {
    if (!bytes) return '';
    const len = bytes.length;
    const sample = bytes.slice(0, 32).join('_');
    return `pptx_bytes_${len}_${sample}`;
  }, [bytes]);

  const { cachedFrame, registerRenderedFrame } = useOffscreenPptxCache(bytesKey, activeSlideIndex);

  const blocks = useViewerBuildingBlocks({
    content: bytes,
    canEdit: false,
    handle: handleRef,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

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

      return {
        width: width > 0 ? width : 1920,
        height: height > 0 ? height : 1080
      };
    };

    const updateSize = () => {
      const dims = getUnscaledDimensions();
      if (dims.width > 0 && dims.height > 0) {
        setContainerSize(dims);
      }
    };

    const ro = new ResizeObserver(() => {
      const dims = getUnscaledDimensions();
      if (dims.width > 0 && dims.height > 0) {
        setContainerSize(dims);
      }
    });

    ro.observe(el);
    updateSize();

    return () => ro.disconnect();
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

  // Capture rendered canvas into off-screen buffer
  useEffect(() => {
    if (!blocks.loading && containerRef.current) {
      const timer = setTimeout(() => {
        if (containerRef.current) {
          registerRenderedFrame(containerRef.current);
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [blocks.loading, activeSlideIndex, registerRenderedFrame]);

  const canvasWidth = blocks.canvasProps?.canvasSize?.width || 960;
  const canvasHeight = blocks.canvasProps?.canvasSize?.height || 540;

  const fitScale = useMemo(() => {
    const targetW = containerSize.width || 1920;
    const targetH = containerSize.height || 1080;
    const scaleX = targetW / canvasWidth;
    const scaleY = targetH / canvasHeight;
    const scale = Math.min(scaleX, scaleY);
    return scale > 0 ? scale : 1;
  }, [containerSize.width, containerSize.height, canvasWidth, canvasHeight]);

  const customZoom = useMemo(() => {
    if (!blocks.canvasProps?.zoom) return undefined;
    return {
      ...blocks.canvasProps.zoom,
      editorScale: fitScale,
    };
  }, [blocks.canvasProps?.zoom, fitScale]);

  // If loading or switching slides, check off-screen canvas buffer first
  if (blocks.loading) {
    if (cachedFrame?.dataUrl) {
      return (
        <div className="w-full h-full bg-black flex items-center justify-center relative overflow-hidden select-none">
          <img src={cachedFrame.dataUrl} alt="" className="w-full h-full object-contain pointer-events-none" />
        </div>
      );
    }

    if (fallbackContent) {
      return (
        <div className="w-full h-full relative overflow-hidden">
          {fallbackContent}
        </div>
      );
    }

    return (
      <div className="w-full h-full bg-black flex items-center justify-center text-white/40 font-mono text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span>Synchronizing Presentation Slide...</span>
        </div>
      </div>
    );
  }

  if (blocks.error || !blocks.canvasProps) {
    if (cachedFrame?.dataUrl) {
      return (
        <div className="w-full h-full bg-black flex items-center justify-center relative overflow-hidden select-none">
          <img src={cachedFrame.dataUrl} alt="" className="w-full h-full object-contain pointer-events-none" />
        </div>
      );
    }
    return fallbackContent ? <>{fallbackContent}</> : null;
  }

  return (
    <div 
      ref={containerRef}
      data-pptx-fullscreen-stage="true"
      className="w-full h-full bg-black overflow-hidden relative flex items-center justify-center select-none"
    >
      <SlideCanvas
        {...blocks.canvasProps}
        zoom={customZoom || blocks.canvasProps.zoom}
        showRulers={false}
        showGrid={false}
        canEdit={false}
      />
    </div>
  );
};

export const PptxRenderOverlay: React.FC<PptxRenderOverlayProps> = ({ fileBytes, activeSlideIndex, fallbackContent }) => {
  const validBytes = useMemo(() => toValidPptxUint8Array(fileBytes), [fileBytes]);

  if (!validBytes) {
    return fallbackContent ? <>{fallbackContent}</> : null;
  }

  return (
    <PptxErrorBoundary fallback={fallbackContent}>
      <PptxViewerInner bytes={validBytes} activeSlideIndex={activeSlideIndex} fallbackContent={fallbackContent} />
    </PptxErrorBoundary>
  );
};

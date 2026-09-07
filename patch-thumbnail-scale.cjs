const fs = require('fs');
let code = fs.readFileSync('src/components/PptxSlideThumbnail.tsx', 'utf8');

const newCode = `import '../utils/initPptxViewer';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Slide, PresentationItem, ThemeStyles } from '../types';
import { toValidPptxUint8Array, isValidPptxBinary } from '../utils/pptxValidator';
import { useViewerBuildingBlocks, SlideCanvas } from 'pptx-react-viewer';

interface PptxSlideThumbnailProps {
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  liveItem: PresentationItem | null;
  themeStyles?: ThemeStyles;
}

const pptxBytesCache = new Map<string, Uint8Array>();

export const PptxSlideThumbnail: React.FC<PptxSlideThumbnailProps> = ({
  slide,
  slideIndex,
  totalSlides,
  liveItem,
  themeStyles,
}) => {
  const [localBytes, setLocalBytes] = useState<Uint8Array | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 200, height: 112 });

  useEffect(() => {
    let isMounted = true;
    const slideBytes = (slide as any).fileBytes || liveItem?.data?.fileBytes;
    const contentId = liveItem?.contentId || liveItem?.id;

    if (slideBytes && isValidPptxBinary(slideBytes)) {
      setLocalBytes(toValidPptxUint8Array(slideBytes));
    } else if (contentId) {
      if (pptxBytesCache.has(contentId)) {
        setLocalBytes(pptxBytesCache.get(contentId)!);
        return;
      }
      import('../db').then(({ getDB }) => {
        getDB().then(db => db.get('assets', contentId)).then(asset => {
          if (asset?.data?.fileBytes && isValidPptxBinary(asset.data.fileBytes)) {
            const bytes = toValidPptxUint8Array(asset.data.fileBytes);
            pptxBytesCache.set(contentId, bytes);
            if (isMounted) setLocalBytes(bytes);
          }
        }).catch(e => console.error('[PptxSlideThumbnail] Error loading PPTX', e));
      });
    }
    return () => { isMounted = false; };
  }, [slide, liveItem]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setContainerSize({ width: w, height: h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const blocks = useViewerBuildingBlocks({
    content: localBytes || new Uint8Array(),
    canEdit: false,
  });

  const canvasWidth = blocks.canvasProps?.canvasSize?.width || 960;
  const canvasHeight = blocks.canvasProps?.canvasSize?.height || 540;

  const fitScale = useMemo(() => {
    const targetW = containerSize.width || 200;
    const targetH = containerSize.height || 112;
    const scale = Math.min(targetW / canvasWidth, targetH / canvasHeight);
    return scale > 0 ? scale : 0.2;
  }, [containerSize.width, containerSize.height, canvasWidth, canvasHeight]);

  const customZoom = useMemo(() => {
    if (!blocks.canvasProps?.zoom) return undefined;
    return { ...blocks.canvasProps.zoom, editorScale: fitScale }; 
  }, [blocks.canvasProps?.zoom, fitScale]);

  if (!localBytes || blocks.loading || !blocks.canvasProps) {
    return (
      <div className="w-full h-full bg-[#1a1a24] relative flex flex-col items-center justify-center border border-white/5">
        {slide.backgroundUrl && (
           <img src={slide.backgroundUrl} className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm pointer-events-none" />
        )}
        <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin z-10 mb-2" />
      </div>
    );
  }

  if (blocks.error) {
    return (
      <div className="w-full h-full bg-[#1a1a24] relative flex items-center justify-center border border-white/5">
        <span className="text-[9px] font-mono text-red-400 z-10">Render failed</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full bg-black relative overflow-hidden select-none flex items-center justify-center">
      <SlideCanvas 
        {...blocks.canvasProps} 
        slideId={slideIndex + 1} 
        zoom={customZoom}
        showRulers={false} 
        showGrid={false} 
        canEdit={false} 
      />
      <div className="absolute bottom-1 right-2 px-1.5 py-0.5 bg-black/80 rounded text-[9px] font-mono text-amber-300 border border-amber-500/30 pointer-events-none z-10">
        Slide {slideIndex + 1}
      </div>
    </div>
  );
};
`;

fs.writeFileSync('src/components/PptxSlideThumbnail.tsx', newCode);

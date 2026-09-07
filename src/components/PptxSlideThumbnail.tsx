import React, { useRef, useState, useEffect } from 'react';
import { Slide, PresentationItem, ThemeStyles } from '../types';
import { PresentationSlideView } from './PresentationSlideView';
import { PptxRenderOverlay } from './PptxRenderOverlay';

interface PptxSlideThumbnailProps {
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  liveItem?: PresentationItem | null;
  themeStyles?: ThemeStyles;
}

export const PptxSlideThumbnail: React.FC<PptxSlideThumbnailProps> = React.memo(({
  slide,
  slideIndex,
  totalSlides,
  liveItem,
  themeStyles,
}) => {
  const fileBytes = liveItem?.data?.fileBytes;
  const contentId = liveItem?.contentId || liveItem?.id;

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(0.2);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let animationFrameId: number | null = null;

    const updateScale = () => {
      if (animationFrameId !== null) return;
      animationFrameId = requestAnimationFrame(() => {
        animationFrameId = null;
        if (!el) return;
        const w = el.clientWidth || el.offsetWidth || 300;
        const h = el.clientHeight || el.offsetHeight || 168;
        const s = Math.min(w / 1920, h / 1080);
        setScale(prev => (Math.abs(prev - s) < 0.001 ? prev : (s > 0 ? s : 0.2)));
      });
    };

    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    updateScale();

    return () => {
      ro.disconnect();
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-black relative overflow-hidden select-none flex items-center justify-center pointer-events-none"
      style={{
        contain: 'strict',
        transform: 'translateZ(0)',
      }}
    >
      <div 
        className="relative overflow-hidden flex items-center justify-center shrink-0 pointer-events-none select-none"
        style={{
          width: '1920px',
          height: '1080px',
          transform: `scale(${scale}) translateZ(0)`,
          transformOrigin: 'center center',
          willChange: 'transform',
          contain: 'layout size style paint',
        }}
      >
        {(fileBytes || contentId) ? (
          <PptxRenderOverlay 
            fileBytes={fileBytes} 
            contentId={contentId} 
            activeSlideIndex={slideIndex} 
          />
        ) : (
          <PresentationSlideView 
            slide={slide} 
            slideIndex={slideIndex} 
            totalSlides={totalSlides} 
            mode="thumbnail" 
            themeStyles={themeStyles} 
          />
        )}
      </div>
      <div className="absolute bottom-1 right-2 px-1.5 py-0.5 bg-black/80 rounded text-[9px] font-mono text-amber-300 border border-amber-500/30 pointer-events-none z-20">
        Slide {slideIndex + 1}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.slideIndex === nextProps.slideIndex &&
    prevProps.totalSlides === nextProps.totalSlides &&
    prevProps.liveItem?.id === nextProps.liveItem?.id &&
    prevProps.liveItem?.contentId === nextProps.liveItem?.contentId &&
    prevProps.liveItem?.data?.fileBytes === nextProps.liveItem?.data?.fileBytes &&
    prevProps.slide === nextProps.slide
  );
});
